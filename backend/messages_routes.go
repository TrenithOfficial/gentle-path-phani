package main

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Client + Admin message endpoints backed by the `messages` table.

type MessageRow struct {
	ID         string     `json:"id"`
	UserID     string     `json:"userId"`
	Email      string     `json:"email"`
	Subject    string     `json:"subject"`
	Content    string     `json:"content"`
	IsRead     bool       `json:"isRead"`
	AdminReply *string    `json:"adminReply"`
	CreatedAt  time.Time  `json:"createdAt"` // maps to messages.sent_at
	RepliedAt  *time.Time `json:"repliedAt"`
}

type CreateMessageRequest struct {
	Subject string `json:"subject"`
	Content string `json:"content"`
}

type ReplyMessageRequest struct {
	Reply string `json:"reply"`
}

// Ensures the authenticated Firebase user exists in Postgres users table,
// then returns the AppUser (and therefore a valid users.id for FK usage).
func authedUser(c *gin.Context) (*AppUser, bool) {
	uid := strings.TrimSpace(c.GetString("uid"))
	if uid == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return nil, false
	}

	// Role from token claims (set by your system). Default to "client".
	role := "client"
	if claimsAny, ok := c.Get("claims"); ok {
		if claims, ok := claimsAny.(map[string]interface{}); ok {
			if r, ok := claims["role"].(string); ok && strings.TrimSpace(r) != "" {
				role = strings.TrimSpace(r)
			}
		}
	}

	// Pull email/name from Firebase (source of truth).
	fu, err := FirebaseAuth.GetUser(c.Request.Context(), uid)
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load firebase user"})
		return nil, false
	}

	email := strings.TrimSpace(fu.Email)
	name := strings.TrimSpace(fu.DisplayName)

	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email is required on your account"})
		return nil, false
	}

	appUser, err := upsertUser(c.Request.Context(), uid, email, name, role)
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upsert user"})
		return nil, false
	}

	return appUser, true
}

func RegisterMessageRoutes(api *gin.RouterGroup) {
	// LIST: GET /api/messages
	api.GET("/messages", func(c *gin.Context) {
		u, ok := authedUser(c)
		if !ok {
			return
		}

		rows, err := DB.Query(c.Request.Context(), `
      SELECT
        m.id, m.user_id, u.email,
        COALESCE(m.subject, ''), COALESCE(m.content, ''),
        m.is_read, m.admin_reply, m.sent_at, m.replied_at
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.user_id = $1
      ORDER BY m.sent_at DESC
      LIMIT 200
    `, u.ID)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load messages"})
			return
		}
		defer rows.Close()

		out := make([]MessageRow, 0, 50)
		for rows.Next() {
			var r MessageRow
			if err := rows.Scan(
				&r.ID,
				&r.UserID,
				&r.Email,
				&r.Subject,
				&r.Content,
				&r.IsRead,
				&r.AdminReply,
				&r.CreatedAt, // <- sent_at
				&r.RepliedAt,
			); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read messages"})
				return
			}
			out = append(out, r)
		}
		if err := rows.Err(); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read messages"})
			return
		}

		c.JSON(http.StatusOK, out)
	})

	// CREATE: POST /api/messages
	api.POST("/messages", func(c *gin.Context) {
		u, ok := authedUser(c)
		if !ok {
			return
		}

		var req CreateMessageRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}

		subject := strings.TrimSpace(req.Subject)
		content := strings.TrimSpace(req.Content)
		if content == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "content is required"})
			return
		}

		id := uuid.New()
		_, err := DB.Exec(c.Request.Context(), `
      INSERT INTO messages (id, user_id, subject, content, is_read)
      VALUES ($1, $2, $3, $4, false)
    `, id, u.ID, subject, content)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create message"})
			return
		}

		// Return success only (frontend shows the success screen)
		c.Status(http.StatusCreated)
	})

	// MARK READ: POST /api/messages/:id/read
	api.POST("/messages/:id/read", func(c *gin.Context) {
		u, ok := authedUser(c)
		if !ok {
			return
		}

		id := strings.TrimSpace(c.Param("id"))
		if id == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing id"})
			return
		}

		cmd, err := DB.Exec(c.Request.Context(), `
      UPDATE messages
      SET is_read = true
      WHERE id = $1 AND user_id = $2
    `, id, u.ID)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update message"})
			return
		}
		if cmd.RowsAffected() == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "message not found"})
			return
		}
		c.Status(http.StatusNoContent)
	})
}

func RegisterAdminMessageRoutes(api *gin.RouterGroup) {
	// LIST: GET /api/admin/messages?status=unread|all
	api.GET("/admin/messages", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		status := strings.ToLower(strings.TrimSpace(c.Query("status")))
		where := ""
		if status == "unread" {
			where = "WHERE m.is_read = false"
		}

		rows, err := DB.Query(c.Request.Context(), `
      SELECT
        m.id, m.user_id, u.email,
        COALESCE(m.subject, ''), COALESCE(m.content, ''),
        m.is_read, m.admin_reply, m.sent_at, m.replied_at
      FROM messages m
      JOIN users u ON u.id = m.user_id
      `+where+`
      ORDER BY m.sent_at DESC
      LIMIT 500
    `)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load messages"})
			return
		}
		defer rows.Close()

		out := make([]MessageRow, 0, 100)
		for rows.Next() {
			var r MessageRow
			if err := rows.Scan(
				&r.ID,
				&r.UserID,
				&r.Email,
				&r.Subject,
				&r.Content,
				&r.IsRead,
				&r.AdminReply,
				&r.CreatedAt, // <- sent_at
				&r.RepliedAt,
			); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read messages"})
				return
			}
			out = append(out, r)
		}
		if err := rows.Err(); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read messages"})
			return
		}

		c.JSON(http.StatusOK, out)
	})

	// DETAIL: GET /api/admin/messages/:id
	api.GET("/admin/messages/:id", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		id := strings.TrimSpace(c.Param("id"))
		if id == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing id"})
			return
		}

		var r MessageRow
		err := DB.QueryRow(c.Request.Context(), `
      SELECT
        m.id, m.user_id, u.email,
        COALESCE(m.subject, ''), COALESCE(m.content, ''),
        m.is_read, m.admin_reply, m.sent_at, m.replied_at
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.id = $1
    `, id).Scan(
			&r.ID,
			&r.UserID,
			&r.Email,
			&r.Subject,
			&r.Content,
			&r.IsRead,
			&r.AdminReply,
			&r.CreatedAt, // <- sent_at
			&r.RepliedAt,
		)

		if err != nil {
			if err == pgx.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "message not found"})
				return
			}
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load message"})
			return
		}

		c.JSON(http.StatusOK, r)
	})

	// REPLY: POST /api/admin/messages/:id/reply
	api.POST("/admin/messages/:id/reply", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		id := strings.TrimSpace(c.Param("id"))
		if id == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing id"})
			return
		}

		var req ReplyMessageRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}
		reply := strings.TrimSpace(req.Reply)
		if reply == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "reply is required"})
			return
		}

		now := time.Now().UTC()
		cmd, err := DB.Exec(c.Request.Context(), `
      UPDATE messages
      SET admin_reply = $2,
          replied_at = $3,
          is_read = true
      WHERE id = $1
    `, id, reply, now)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reply"})
			return
		}
		if cmd.RowsAffected() == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "message not found"})
			return
		}

		c.Status(http.StatusNoContent)
	})

	// MARK READ: POST /api/admin/messages/:id/read
	api.POST("/admin/messages/:id/read", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		id := strings.TrimSpace(c.Param("id"))
		if id == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing id"})
			return
		}

		cmd, err := DB.Exec(c.Request.Context(), `
      UPDATE messages
      SET is_read = true
      WHERE id = $1
    `, id)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update message"})
			return
		}
		if cmd.RowsAffected() == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "message not found"})
			return
		}
		c.Status(http.StatusNoContent)
	})
}
