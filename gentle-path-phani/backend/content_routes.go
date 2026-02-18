package main

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type GuidanceRow struct {
	ID        string    `json:"id"`
	PhaseID   int       `json:"phaseId"`
	Day       int       `json:"day"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	AudioURL  *string   `json:"audioUrl"`
	CreatedAt time.Time `json:"createdAt"`
}

type UpsertGuidanceRequest struct {
	PhaseID  int     `json:"phaseId"`
	Day      int     `json:"day"`
	Title    string  `json:"title"`
	Content  string  `json:"content"`
	AudioURL *string `json:"audioUrl"`
}

type TodayGuidanceResponse struct {
	PhaseID int         `json:"phaseId"`
	Day     int         `json:"day"`
	Guidance *GuidanceRow `json:"guidance"`
}

func RegisterContentRoutes(api *gin.RouterGroup) {
	// Client: get guidance by phase/day
	api.GET("/guidance", func(c *gin.Context) {
		u, ok := authedUser(c)
		if !ok {
			return
		}
		_ = u // just to ensure authed user exists

		phaseID, _ := strconv.Atoi(strings.TrimSpace(c.Query("phaseId")))
		day, _ := strconv.Atoi(strings.TrimSpace(c.Query("day")))
		if phaseID <= 0 || day <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "phaseId and day are required"})
			return
		}

		var r GuidanceRow
		err := DB.QueryRow(c.Request.Context(), `
			SELECT id, phase_id, day, title, content, audio_url, created_at
			FROM daily_guidance
			WHERE phase_id = $1 AND day = $2
			LIMIT 1
		`, phaseID, day).Scan(
			&r.ID, &r.PhaseID, &r.Day, &r.Title, &r.Content, &r.AudioURL, &r.CreatedAt,
		)

		if err != nil {
			if err == pgx.ErrNoRows {
				c.JSON(http.StatusOK, gin.H{"guidance": nil})
				return
			}
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load guidance"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"guidance": r})
	})

	// Client: get guidance for "today" based on user's start_date
	api.GET("/guidance/today", func(c *gin.Context) {
		u, ok := authedUser(c)
		if !ok {
			return
		}

		// Pull start_date from users table
		var startDate *time.Time
		err := DB.QueryRow(c.Request.Context(), `
			SELECT start_date
			FROM users
			WHERE id = $1
		`, u.ID).Scan(&startDate)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user start date"})
			return
		}

		// If start_date not set, treat as day 1
		now := time.Now().UTC()
		dayNumber := 1
		if startDate != nil {
			diff := now.Sub(startDate.UTC())
			if diff < 0 {
				dayNumber = 1
			} else {
				dayNumber = int(diff.Hours()/24) + 1
				if dayNumber < 1 {
					dayNumber = 1
				}
			}
		}

		// 6 phases, 15 days each (matches your UI)
		const daysPerPhase = 15
		phaseID := ((dayNumber - 1) / daysPerPhase) + 1
		if phaseID < 1 {
			phaseID = 1
		}
		if phaseID > 6 {
			phaseID = 6
		}
		dayInPhase := ((dayNumber - 1) % daysPerPhase) + 1

		var r GuidanceRow
		qerr := DB.QueryRow(c.Request.Context(), `
			SELECT id, phase_id, day, title, content, audio_url, created_at
			FROM daily_guidance
			WHERE phase_id = $1 AND day = $2
			LIMIT 1
		`, phaseID, dayInPhase).Scan(
			&r.ID, &r.PhaseID, &r.Day, &r.Title, &r.Content, &r.AudioURL, &r.CreatedAt,
		)

		if qerr != nil {
			if qerr == pgx.ErrNoRows {
				c.JSON(http.StatusOK, TodayGuidanceResponse{
					PhaseID: phaseID,
					Day: dayInPhase,
					Guidance: nil,
				})
				return
			}
			c.Error(qerr)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load guidance"})
			return
		}

		c.JSON(http.StatusOK, TodayGuidanceResponse{
			PhaseID: phaseID,
			Day: dayInPhase,
			Guidance: &r,
		})
	})
}

func RegisterAdminContentRoutes(api *gin.RouterGroup) {
	// Admin: list guidance (optionally filter by phaseId)
	api.GET("/admin/guidance", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		phaseIDStr := strings.TrimSpace(c.Query("phaseId"))
		args := []any{}
		where := ""
		if phaseIDStr != "" {
			phaseID, _ := strconv.Atoi(phaseIDStr)
			if phaseID > 0 {
				where = "WHERE phase_id = $1"
				args = append(args, phaseID)
			}
		}

		rows, err := DB.Query(c.Request.Context(), `
			SELECT id, phase_id, day, title, content, audio_url, created_at
			FROM daily_guidance
			`+where+`
			ORDER BY phase_id ASC, day ASC
			LIMIT 2000
		`, args...)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load guidance"})
			return
		}
		defer rows.Close()

		out := make([]GuidanceRow, 0, 200)
		for rows.Next() {
			var r GuidanceRow
			if err := rows.Scan(&r.ID, &r.PhaseID, &r.Day, &r.Title, &r.Content, &r.AudioURL, &r.CreatedAt); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read guidance"})
				return
			}
			out = append(out, r)
		}
		if err := rows.Err(); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read guidance"})
			return
		}

		c.JSON(http.StatusOK, out)
	})

	// Admin: upsert guidance by (phase_id, day)
	api.POST("/admin/guidance", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		var req UpsertGuidanceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}

		req.Title = strings.TrimSpace(req.Title)
		req.Content = strings.TrimSpace(req.Content)

		if req.PhaseID <= 0 || req.Day <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "phaseId and day are required"})
			return
		}
		if req.Title == "" || req.Content == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "title and content are required"})
			return
		}

		// If audioUrl is blank string, treat as null
		if req.AudioURL != nil {
			v := strings.TrimSpace(*req.AudioURL)
			if v == "" {
				req.AudioURL = nil
			} else {
				req.AudioURL = &v
			}
		}

		newID := uuid.New().String()
		var out GuidanceRow

		err := DB.QueryRow(c.Request.Context(), `
			INSERT INTO daily_guidance (id, phase_id, day, title, content, audio_url)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (phase_id, day)
			DO UPDATE SET
				title = EXCLUDED.title,
				content = EXCLUDED.content,
				audio_url = EXCLUDED.audio_url
			RETURNING id, phase_id, day, title, content, audio_url, created_at
		`, newID, req.PhaseID, req.Day, req.Title, req.Content, req.AudioURL).Scan(
			&out.ID, &out.PhaseID, &out.Day, &out.Title, &out.Content, &out.AudioURL, &out.CreatedAt,
		)

		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save guidance"})
			return
		}

		c.JSON(http.StatusOK, out)
	})

	// Admin: delete guidance by id
	api.DELETE("/admin/guidance/:id", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		id := strings.TrimSpace(c.Param("id"))
		if id == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing id"})
			return
		}

		cmd, err := DB.Exec(c.Request.Context(), `DELETE FROM daily_guidance WHERE id = $1`, id)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete guidance"})
			return
		}
		if cmd.RowsAffected() == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "guidance not found"})
			return
		}

		c.Status(http.StatusNoContent)
	})
}
