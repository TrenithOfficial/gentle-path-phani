package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type AdminCheckInRow struct {
	ID                string     `json:"id"`
	UserID            string     `json:"userId"`
	Email             string     `json:"email"`
	Day               int        `json:"day"`
	Mood              *int       `json:"mood"`
	Energy            *int       `json:"energy"`
	Notes             string     `json:"notes"`
	IsTravelDay       bool       `json:"isTravelDay"`
	MissedProtocol    bool       `json:"missedProtocol"`
	TravelStartDate   *string    `json:"travelStartDate"`
	TravelReturnDate  *string    `json:"travelReturnDate"`
	MissedProtocolNote string    `json:"missedProtocolNote"`
	CreatedAt         time.Time  `json:"createdAt"`
}

func RegisterAdminCheckInRoutes(api *gin.RouterGroup) {
	// LIST: GET /api/admin/checkins
	api.GET("/admin/checkins", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		rows, err := DB.Query(c.Request.Context(), `
			SELECT
				ci.id, ci.user_id, u.email,
				ci.day, ci.mood, ci.energy, COALESCE(ci.notes, ''),
				ci.is_travel_day, ci.missed_protocol,
				to_char(ci.travel_start_date, 'YYYY-MM-DD'),
				to_char(ci.travel_return_date, 'YYYY-MM-DD'),
				COALESCE(ci.missed_protocol_note, ''),
				ci.created_at
			FROM check_ins ci
			JOIN users u ON u.id = ci.user_id
			ORDER BY ci.created_at DESC
			LIMIT 100
		`)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load check-ins"})
			return
		}
		defer rows.Close()

		out := make([]AdminCheckInRow, 0, 100)
		for rows.Next() {
			var r AdminCheckInRow
			if err := rows.Scan(
				&r.ID,
				&r.UserID,
				&r.Email,
				&r.Day,
				&r.Mood,
				&r.Energy,
				&r.Notes,
				&r.IsTravelDay,
				&r.MissedProtocol,
				&r.TravelStartDate,
				&r.TravelReturnDate,
				&r.MissedProtocolNote,
				&r.CreatedAt,
			); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read check-ins"})
				return
			}
			out = append(out, r)
		}

		if err := rows.Err(); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read check-ins"})
			return
		}

		c.JSON(http.StatusOK, out)
	})

	// LIST BY USER: GET /api/admin/user-checkins/:userId
	api.GET("/admin/user-checkins/:userId", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		userID := c.Param("userId")
		if userID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing userId"})
			return
		}

		rows, err := DB.Query(c.Request.Context(), `
			SELECT
				ci.id, ci.user_id, u.email,
				ci.day, ci.mood, ci.energy, COALESCE(ci.notes, ''),
				ci.is_travel_day, ci.missed_protocol,
				to_char(ci.travel_start_date, 'YYYY-MM-DD'),
				to_char(ci.travel_return_date, 'YYYY-MM-DD'),
				COALESCE(ci.missed_protocol_note, ''),
				ci.created_at
			FROM check_ins ci
			JOIN users u ON u.id = ci.user_id
			WHERE ci.user_id = $1
			ORDER BY ci.created_at DESC
			LIMIT 200
		`, userID)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load check-ins"})
			return
		}
		defer rows.Close()

		out := make([]AdminCheckInRow, 0, 200)
		for rows.Next() {
			var r AdminCheckInRow
			if err := rows.Scan(
				&r.ID,
				&r.UserID,
				&r.Email,
				&r.Day,
				&r.Mood,
				&r.Energy,
				&r.Notes,
				&r.IsTravelDay,
				&r.MissedProtocol,
				&r.TravelStartDate,
				&r.TravelReturnDate,
				&r.MissedProtocolNote,
				&r.CreatedAt,
			); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read check-ins"})
				return
			}
			out = append(out, r)
		}

		if err := rows.Err(); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read check-ins"})
			return
		}

		c.JSON(http.StatusOK, out)
	})

	// DETAIL: GET /api/admin/checkins/:id
	api.GET("/admin/checkins/:id", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		id := c.Param("id")
		if id == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing id"})
			return
		}

		var r AdminCheckInRow
		err := DB.QueryRow(c.Request.Context(), `
			SELECT
				ci.id, ci.user_id, u.email,
				ci.day, ci.mood, ci.energy, COALESCE(ci.notes, ''),
				ci.is_travel_day, ci.missed_protocol,
				to_char(ci.travel_start_date, 'YYYY-MM-DD'),
				to_char(ci.travel_return_date, 'YYYY-MM-DD'),
				COALESCE(ci.missed_protocol_note, ''),
				ci.created_at
			FROM check_ins ci
			JOIN users u ON u.id = ci.user_id
			WHERE ci.id = $1
		`, id).Scan(
			&r.ID,
			&r.UserID,
			&r.Email,
			&r.Day,
			&r.Mood,
			&r.Energy,
			&r.Notes,
			&r.IsTravelDay,
			&r.MissedProtocol,
			&r.TravelStartDate,
			&r.TravelReturnDate,
			&r.MissedProtocolNote,
			&r.CreatedAt,
		)

		if err != nil {
			if err == pgx.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "check-in not found"})
				return
			}
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load check-in"})
			return
		}

		c.JSON(http.StatusOK, r)
	})
}

func requireAdmin(c *gin.Context) bool {
	claimsAny, ok := c.Get("claims")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return false
	}

	claims, _ := claimsAny.(map[string]interface{})
	role, _ := claims["role"].(string)
	if role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return false
	}
	return true
}
