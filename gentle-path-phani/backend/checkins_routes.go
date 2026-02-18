package main

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
)

type CreateCheckInReq struct {
	Day              int     `json:"day" binding:"required"`
	Mood             *int    `json:"mood"`
	Energy           *int    `json:"energy"`
	Notes            string  `json:"notes"`
	IsTravelDay      bool    `json:"isTravelDay"`
	MissedProtocol   bool    `json:"missedProtocol"`
	TravelStartDate  *string `json:"travelStartDate"`  // YYYY-MM-DD (only if isTravelDay=true)
	TravelReturnDate *string `json:"travelReturnDate"` // YYYY-MM-DD (only if isTravelDay=true)
	MissedNote       string  `json:"missedProtocolNote"`
}

func RegisterCheckInRoutes(api *gin.RouterGroup) {
	api.POST("/checkins", func(c *gin.Context) {
		var req CreateCheckInReq
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
			return
		}

		// Day basic validation
		if req.Day < 1 || req.Day > 90 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "day must be between 1 and 90"})
			return
		}

		// Validate travel dates if travel day
		var travelStart *time.Time
		var travelReturn *time.Time

		if req.IsTravelDay {
			if req.TravelStartDate == nil || strings.TrimSpace(*req.TravelStartDate) == "" ||
				req.TravelReturnDate == nil || strings.TrimSpace(*req.TravelReturnDate) == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "travelStartDate and travelReturnDate are required when isTravelDay is true"})
				return
			}

			start, err := time.Parse("2006-01-02", strings.TrimSpace(*req.TravelStartDate))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "travelStartDate must be YYYY-MM-DD"})
				return
			}
			ret, err := time.Parse("2006-01-02", strings.TrimSpace(*req.TravelReturnDate))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "travelReturnDate must be YYYY-MM-DD"})
				return
			}
			if ret.Before(start) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "travelReturnDate cannot be before travelStartDate"})
				return
			}

			travelStart = &start
			travelReturn = &ret
		}

		// Validate missed protocol note if missed protocol
		var missedNotePtr *string
		if req.MissedProtocol {
			note := strings.TrimSpace(req.MissedNote)
			if note == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "missedProtocolNote is required when missedProtocol is true"})
				return
			}
			missedNotePtr = &note
		}

		uid := c.GetString("uid")

		// Load app user (ensures user exists and gives us users.id)
		u, err := FirebaseAuth.GetUser(c.Request.Context(), uid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load firebase user"})
			return
		}

		claimsAny, _ := c.Get("claims")
		claims, _ := claimsAny.(map[string]interface{})
		role := "client"
		if v, ok := claims["role"].(string); ok && v != "" {
			role = v
		}

		me, err := upsertUser(c.Request.Context(), uid, u.Email, u.DisplayName, role)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upsert user"})
			return
		}

		// Insert check-in (now includes the new columns)
		row := DB.QueryRow(c.Request.Context(), `
		  INSERT INTO check_ins (
				user_id, day, mood, energy, notes,
				is_travel_day, missed_protocol,
				travel_start_date, travel_return_date, missed_protocol_note
			)
		  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		  RETURNING id, created_at
		`, me.ID, req.Day, req.Mood, req.Energy, req.Notes, req.IsTravelDay, req.MissedProtocol, travelStart, travelReturn, missedNotePtr)

		var id string
		var createdAt time.Time

		if err := row.Scan(&id, &createdAt); err != nil {
			// Unique constraint violation: user already checked-in for this day
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				c.JSON(http.StatusConflict, gin.H{"error": "You already checked in today"})
				return
			}

			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"id":        id,
			"createdAt": createdAt,
		})
	})
}
