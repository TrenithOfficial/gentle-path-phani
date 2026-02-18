package main

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type ProtocolRow struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Name      string    `json:"name"`
	Dosage    string    `json:"dosage"`
	Timing    string    `json:"timing"`
	Notes     string    `json:"notes"`
	ShopURL   string    `json:"shopUrl"`
	CreatedAt time.Time `json:"createdAt"`
}

type AdminCreateProtocolRequest struct {
	UserID  string `json:"userId"`
	Name    string `json:"name"`
	Dosage  string `json:"dosage"`
	Timing  string `json:"timing"`
	Notes   string `json:"notes"`
	ShopURL string `json:"shopUrl"`
}

type AdminUpdateProtocolRequest struct {
	Name    *string `json:"name"`
	Dosage  *string `json:"dosage"`
	Timing  *string `json:"timing"`
	Notes   *string `json:"notes"`
	ShopURL *string `json:"shopUrl"`
}

// Client endpoints: current user's protocols
func RegisterProtocolRoutes(api *gin.RouterGroup) {
	// GET /api/protocols
	api.GET("/protocols", func(c *gin.Context) {
		u, ok := authedUser(c)
		if !ok {
			return
		}

		rows, err := DB.Query(c.Request.Context(), `
			SELECT id, user_id, name,
			       COALESCE(dosage, ''), COALESCE(timing, ''),
			       COALESCE(notes, ''), COALESCE(shop_url, ''),
			       created_at
			FROM protocols
			WHERE user_id = $1
			ORDER BY created_at DESC
			LIMIT 500
		`, u.ID)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load protocols"})
			return
		}
		defer rows.Close()

		out := make([]ProtocolRow, 0, 50)
		for rows.Next() {
			var r ProtocolRow
			if err := rows.Scan(&r.ID, &r.UserID, &r.Name, &r.Dosage, &r.Timing, &r.Notes, &r.ShopURL, &r.CreatedAt); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read protocols"})
				return
			}
			out = append(out, r)
		}
		if err := rows.Err(); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read protocols"})
			return
		}

		c.JSON(http.StatusOK, out)
	})
}

// Admin endpoints: manage protocols for any client
func RegisterAdminProtocolRoutes(api *gin.RouterGroup) {
	// LIST for a user: GET /api/admin/users/:id/protocols
	api.GET("/admin/users/:id/protocols", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		userID, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
			return
		}

		rows, err := DB.Query(c.Request.Context(), `
			SELECT id, user_id, name,
			       COALESCE(dosage, ''), COALESCE(timing, ''),
			       COALESCE(notes, ''), COALESCE(shop_url, ''),
			       created_at
			FROM protocols
			WHERE user_id = $1
			ORDER BY created_at DESC
			LIMIT 500
		`, userID)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load protocols"})
			return
		}
		defer rows.Close()

		out := make([]ProtocolRow, 0, 50)
		for rows.Next() {
			var r ProtocolRow
			if err := rows.Scan(&r.ID, &r.UserID, &r.Name, &r.Dosage, &r.Timing, &r.Notes, &r.ShopURL, &r.CreatedAt); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read protocols"})
				return
			}
			out = append(out, r)
		}
		if err := rows.Err(); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read protocols"})
			return
		}

		c.JSON(http.StatusOK, out)
	})

	// CREATE: POST /api/admin/protocols
	api.POST("/admin/protocols", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		var req AdminCreateProtocolRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}

		userID, err := uuid.Parse(strings.TrimSpace(req.UserID))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid userId"})
			return
		}

		name := strings.TrimSpace(req.Name)
		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
			return
		}

		id := uuid.New()

		var out ProtocolRow
		err = DB.QueryRow(c.Request.Context(), `
			INSERT INTO protocols (id, user_id, name, dosage, timing, notes, shop_url)
			VALUES ($1,$2,$3,$4,$5,$6,$7)
			RETURNING id, user_id, name,
			          COALESCE(dosage, ''), COALESCE(timing, ''),
			          COALESCE(notes, ''), COALESCE(shop_url, ''),
			          created_at
		`, id, userID, name, strings.TrimSpace(req.Dosage), strings.TrimSpace(req.Timing), strings.TrimSpace(req.Notes), strings.TrimSpace(req.ShopURL)).
			Scan(&out.ID, &out.UserID, &out.Name, &out.Dosage, &out.Timing, &out.Notes, &out.ShopURL, &out.CreatedAt)

		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create protocol"})
			return
		}

		c.JSON(http.StatusCreated, out)
	})

	// UPDATE: PATCH /api/admin/protocols/:id
	api.PATCH("/admin/protocols/:id", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		protocolID, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid protocol id"})
			return
		}

		var req AdminUpdateProtocolRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}

		// Load current
		var cur ProtocolRow
		err = DB.QueryRow(c.Request.Context(), `
			SELECT id, user_id, name,
			       COALESCE(dosage, ''), COALESCE(timing, ''),
			       COALESCE(notes, ''), COALESCE(shop_url, ''),
			       created_at
			FROM protocols
			WHERE id = $1
		`, protocolID).Scan(&cur.ID, &cur.UserID, &cur.Name, &cur.Dosage, &cur.Timing, &cur.Notes, &cur.ShopURL, &cur.CreatedAt)

		if err != nil {
			if err == pgx.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "protocol not found"})
				return
			}
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load protocol"})
			return
		}

		// Apply patch values
		name := cur.Name
		dosage := cur.Dosage
		timing := cur.Timing
		notes := cur.Notes
		shopURL := cur.ShopURL

		if req.Name != nil {
			name = strings.TrimSpace(*req.Name)
		}
		if req.Dosage != nil {
			dosage = strings.TrimSpace(*req.Dosage)
		}
		if req.Timing != nil {
			timing = strings.TrimSpace(*req.Timing)
		}
		if req.Notes != nil {
			notes = strings.TrimSpace(*req.Notes)
		}
		if req.ShopURL != nil {
			shopURL = strings.TrimSpace(*req.ShopURL)
		}

		if strings.TrimSpace(name) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name cannot be empty"})
			return
		}

		var out ProtocolRow
		err = DB.QueryRow(c.Request.Context(), `
			UPDATE protocols
			SET name=$2, dosage=$3, timing=$4, notes=$5, shop_url=$6
			WHERE id=$1
			RETURNING id, user_id, name,
			          COALESCE(dosage, ''), COALESCE(timing, ''),
			          COALESCE(notes, ''), COALESCE(shop_url, ''),
			          created_at
		`, protocolID, name, dosage, timing, notes, shopURL).
			Scan(&out.ID, &out.UserID, &out.Name, &out.Dosage, &out.Timing, &out.Notes, &out.ShopURL, &out.CreatedAt)

		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update protocol"})
			return
		}

		c.JSON(http.StatusOK, out)
	})

	// DELETE: DELETE /api/admin/protocols/:id
	api.DELETE("/admin/protocols/:id", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		protocolID, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid protocol id"})
			return
		}

		ct, err := DB.Exec(c.Request.Context(), `DELETE FROM protocols WHERE id = $1`, protocolID)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete protocol"})
			return
		}
		if ct.RowsAffected() == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "protocol not found"})
			return
		}

		c.Status(http.StatusNoContent)
	})
}
