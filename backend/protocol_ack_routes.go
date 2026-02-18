package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ProtocolAckRow struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Day       int       `json:"day"`
	CreatedAt time.Time `json:"createdAt"`
}

type CreateAckRequest struct {
	Day int `json:"day"`
}

// Client routes
func RegisterProtocolAckRoutes(api *gin.RouterGroup) {

	// ✅ Client: GET /api/protocols/acks
	// Used by UI to persist "confirmed" after refresh
	api.GET("/protocols/acks", func(c *gin.Context) {
		u, ok := authedUser(c)
		if !ok {
			return
		}

		rows, err := DB.Query(c.Request.Context(), `
			SELECT id, user_id, day, created_at
			FROM protocol_acknowledgements
			WHERE user_id = $1
			ORDER BY day DESC
			LIMIT 365
		`, u.ID)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load acknowledgements"})
			return
		}
		defer rows.Close()

		out := make([]ProtocolAckRow, 0, 30)
		for rows.Next() {
			var r ProtocolAckRow
			if err := rows.Scan(&r.ID, &r.UserID, &r.Day, &r.CreatedAt); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read acknowledgements"})
				return
			}
			out = append(out, r)
		}

		c.JSON(http.StatusOK, out)
	})

	// ✅ Client: POST /api/protocols/ack
	api.POST("/protocols/ack", func(c *gin.Context) {
		u, ok := authedUser(c)
		if !ok {
			return
		}

		var req CreateAckRequest
		if err := c.ShouldBindJSON(&req); err != nil || req.Day <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}

		var out ProtocolAckRow
		err := DB.QueryRow(c.Request.Context(), `
			INSERT INTO protocol_acknowledgements (id, user_id, day)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, day)
			DO UPDATE SET user_id = EXCLUDED.user_id
			RETURNING id, user_id, day, created_at
		`, uuid.NewString(), u.ID, req.Day).Scan(&out.ID, &out.UserID, &out.Day, &out.CreatedAt)

		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save acknowledgement"})
			return
		}

		c.JSON(http.StatusCreated, out)
	})
}

// Admin: GET /api/admin/users/:id/protocol-acks
func RegisterAdminProtocolAckRoutes(api *gin.RouterGroup) {
	api.GET("/admin/users/:id/protocol-acks", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		userID, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
			return
		}

		rows, err := DB.Query(c.Request.Context(), `
			SELECT id, user_id, day, created_at
			FROM protocol_acknowledgements
			WHERE user_id = $1
			ORDER BY day DESC
			LIMIT 365
		`, userID.String())
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load acknowledgements"})
			return
		}
		defer rows.Close()

		out := make([]ProtocolAckRow, 0, 30)
		for rows.Next() {
			var r ProtocolAckRow
			if err := rows.Scan(&r.ID, &r.UserID, &r.Day, &r.CreatedAt); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read acknowledgements"})
				return
			}
			out = append(out, r)
		}

		c.JSON(http.StatusOK, out)
	})
}
