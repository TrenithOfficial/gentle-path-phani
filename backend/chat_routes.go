package main

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Chat-style messaging (WhatsApp-like) backed by chat_messages.
// Thread = all messages for a given client user_id.

type ChatMessageRow struct {
	ID           string     `json:"id"`
	ThreadUser   string     `json:"threadUserId"` // client user_id
	SenderRole   string     `json:"senderRole"`   // "client" | "admin"
	Body         string     `json:"body"`
	CreatedAt    time.Time  `json:"createdAt"`
	DeliveredAt  time.Time  `json:"deliveredAt"`
	ReadAtClient *time.Time `json:"readAtClient"`
	ReadAtAdmin  *time.Time `json:"readAtAdmin"`
}

type ChatSendRequest struct {
	Body string `json:"body"`
}

type ChatThreadSummary struct {
	UserID       string     `json:"userId"`
	Email        string     `json:"email"`
	Name         *string    `json:"name"`
	StartDate    *time.Time `json:"startDate"`
	LastBody     *string    `json:"lastBody"`
	LastAt       *time.Time `json:"lastAt"`
	UnreadAdmin  int        `json:"unreadAdmin"`  // unread for admin (client messages not read by admin)
	UnreadClient int        `json:"unreadClient"` // unread for client (admin messages not read by client)
}

func RegisterChatRoutes(api *gin.RouterGroup) {
	// CLIENT: list messages in own thread
	api.GET("/chat/messages", func(c *gin.Context) {
		u, ok := authedUser(c)
		if !ok {
			return
		}

		rows, err := DB.Query(c.Request.Context(), `
      SELECT id, user_id, sender_role, body, created_at, delivered_at, read_at_client, read_at_admin
      FROM chat_messages
      WHERE user_id = $1
      ORDER BY created_at ASC
      LIMIT 1000
    `, u.ID)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load chat"})
			return
		}
		defer rows.Close()

		out := make([]ChatMessageRow, 0, 100)
		for rows.Next() {
			var r ChatMessageRow
			if err := rows.Scan(&r.ID, &r.ThreadUser, &r.SenderRole, &r.Body, &r.CreatedAt, &r.DeliveredAt, &r.ReadAtClient, &r.ReadAtAdmin); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read chat"})
				return
			}
			out = append(out, r)
		}
		if err := rows.Err(); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read chat"})
			return
		}

		c.JSON(http.StatusOK, out)
	})

	// CLIENT: send message
	api.POST("/chat/messages", func(c *gin.Context) {
		u, ok := authedUser(c)
		if !ok {
			return
		}

		var req ChatSendRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}
		body := strings.TrimSpace(req.Body)
		if body == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "body is required"})
			return
		}

		id := uuid.New().String()
		now := time.Now().UTC()
		_, err := DB.Exec(c.Request.Context(), `
      INSERT INTO chat_messages (id, user_id, sender_role, body, created_at, delivered_at)
      VALUES ($1, $2, 'client', $3, $4, $4)
    `, id, u.ID, body, now)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"id": id, "createdAt": now})
	})

	// CLIENT: mark admin messages read (when user opens chat)
	api.POST("/chat/read", func(c *gin.Context) {
		u, ok := authedUser(c)
		if !ok {
			return
		}

		now := time.Now().UTC()
		_, err := DB.Exec(c.Request.Context(), `
      UPDATE chat_messages
      SET read_at_client = $2
      WHERE user_id = $1
        AND sender_role = 'admin'
        AND read_at_client IS NULL
    `, u.ID, now)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark read"})
			return
		}

		c.Status(http.StatusNoContent)
	})

	// ADMIN: list threads (clients) with unread counts + last message
	api.GET("/admin/chat/threads", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		if DB == nil {
        	c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database not initialized"})
        	return
    	}


		// Optional status filter: all|active|inactive
		status := strings.ToLower(strings.TrimSpace(c.Query("status")))
		whereUser := ""
		if status == "active" {
			whereUser = "WHERE u.start_date IS NOT NULL"
		} else if status == "inactive" {
			whereUser = "WHERE u.start_date IS NULL"
		}

		rows, err := DB.Query(c.Request.Context(), `
      WITH last_msg AS (
        SELECT DISTINCT ON (m.user_id)
          m.user_id,
          m.body AS last_body,
          m.created_at AS last_at
        FROM chat_messages m
        ORDER BY m.user_id, m.created_at DESC
      ),
      unread_admin AS (
        SELECT user_id, COUNT(*)::int AS cnt
        FROM chat_messages
        WHERE sender_role = 'client' AND read_at_admin IS NULL
        GROUP BY user_id
      ),
      unread_client AS (
        SELECT user_id, COUNT(*)::int AS cnt
        FROM chat_messages
        WHERE sender_role = 'admin' AND read_at_client IS NULL
        GROUP BY user_id
      )
      SELECT
        u.id,
        u.email,
        NULLIF(TRIM(u.name), '') AS name,
        u.start_date,
        lm.last_body,
        lm.last_at,
        COALESCE(ua.cnt, 0) AS unread_admin,
        COALESCE(uc.cnt, 0) AS unread_client
      FROM users u
      LEFT JOIN last_msg lm ON lm.user_id = u.id
      LEFT JOIN unread_admin ua ON ua.user_id = u.id
      LEFT JOIN unread_client uc ON uc.user_id = u.id
      `+whereUser+`
      ORDER BY COALESCE(lm.last_at, u.created_at) DESC
      LIMIT 1000
    `)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load threads"})
			return
		}
		defer rows.Close()

		out := make([]ChatThreadSummary, 0, 100)
		for rows.Next() {
			var r ChatThreadSummary
			if err := rows.Scan(&r.UserID, &r.Email, &r.Name, &r.StartDate, &r.LastBody, &r.LastAt, &r.UnreadAdmin, &r.UnreadClient); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read threads"})
				return
			}
			out = append(out, r)
		}
		if err := rows.Err(); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read threads"})
			return
		}
		c.JSON(http.StatusOK, out)
	})

	// ADMIN: load thread messages for a user
	api.GET("/admin/chat/threads/:userId/messages", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}
		userId := strings.TrimSpace(c.Param("userId"))
		if userId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing userId"})
			return
		}

		rows, err := DB.Query(c.Request.Context(), `
      SELECT id, user_id, sender_role, body, created_at, delivered_at, read_at_client, read_at_admin
      FROM chat_messages
      WHERE user_id = $1
      ORDER BY created_at ASC
      LIMIT 2000
    `, userId)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load chat"})
			return
		}
		defer rows.Close()

		out := make([]ChatMessageRow, 0, 100)
		for rows.Next() {
			var r ChatMessageRow
			if err := rows.Scan(&r.ID, &r.ThreadUser, &r.SenderRole, &r.Body, &r.CreatedAt, &r.DeliveredAt, &r.ReadAtClient, &r.ReadAtAdmin); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read chat"})
				return
			}
			out = append(out, r)
		}
		if err := rows.Err(); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read chat"})
			return
		}

		c.JSON(http.StatusOK, out)
	})

	// ADMIN: send message to a user
	api.POST("/admin/chat/threads/:userId/messages", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		if DB == nil {
        	c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database not initialized"})
        	return
    	}
		userId := strings.TrimSpace(c.Param("userId"))
		if userId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing userId"})
			return
		}

		var req ChatSendRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}
		body := strings.TrimSpace(req.Body)
		if body == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "body is required"})
			return
		}

		id := uuid.New().String()
		now := time.Now().UTC()
		_, err := DB.Exec(c.Request.Context(), `
      INSERT INTO chat_messages (id, user_id, sender_role, body, created_at, delivered_at)
      VALUES ($1, $2, 'admin', $3, $4, $4)
    `, id, userId, body, now)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"id": id, "createdAt": now})
	})

	// ADMIN: mark client messages read (when admin opens chat)
	api.POST("/admin/chat/threads/:userId/read", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}
		if DB == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database not initialized"})
			return
		}

		userId := strings.TrimSpace(c.Param("userId"))
		if userId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing userId"})
			return
		}

		now := time.Now().UTC()
		_, err := DB.Exec(c.Request.Context(), `
      UPDATE chat_messages
      SET read_at_admin = $2
      WHERE user_id = $1
        AND sender_role = 'client'
        AND read_at_admin IS NULL
    `, userId, now)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark read"})
			return
		}
		c.Status(http.StatusNoContent)
	})
}
