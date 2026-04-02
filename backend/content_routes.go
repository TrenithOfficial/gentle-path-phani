package main

import (
	"mime"
	"net/http"
	"path/filepath"
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
	PhaseID     int     `json:"phaseId"`
	Day         int     `json:"day"`
	Title       string  `json:"title"`
	Content     string  `json:"content"`
	AudioURL    *string `json:"audioUrl"`
	RemoveAudio bool    `json:"removeAudio"`
}

type TodayGuidanceResponse struct {
	PhaseID  int          `json:"phaseId"`
	Day      int          `json:"day"`
	Guidance *GuidanceRow `json:"guidance"`
}

func guidanceAudioPublicURL(filename string) string {
	return "/uploads/guidance-audio/" + filename
}

func guidanceAudioObjectPath(filename string) string {
	return "guidance-audio/" + filename
}

func guidanceAudioFilenameFromURL(fileURL string) string {
	v := strings.TrimSpace(fileURL)
	v = strings.TrimPrefix(v, "/")
	v = strings.TrimPrefix(v, "uploads/")
	v = strings.TrimPrefix(v, "guidance-audio/")
	return v
}

func deleteGuidanceAudioBestEffort(c *gin.Context, store UploadStore, audioURL *string) {
	if store == nil || audioURL == nil {
		return
	}

	filename := guidanceAudioFilenameFromURL(*audioURL)
	if filename == "" {
		return
	}

	_ = store.Delete(c.Request.Context(), guidanceAudioObjectPath(filename))
}

func RegisterGuidanceAudioUploadsRoutes(r *gin.Engine, store UploadStore) {
	r.GET("/uploads/guidance-audio/:filename", func(c *gin.Context) {
		filename := strings.TrimSpace(c.Param("filename"))
		if filename == "" {
			c.Status(http.StatusNotFound)
			return
		}

		rc, ct, err := store.Open(c.Request.Context(), guidanceAudioObjectPath(filename))
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		defer rc.Close()

		if ct == "" {
			ct = mime.TypeByExtension(strings.ToLower(filepath.Ext(filename)))
		}
		if ct != "" {
			ct = "application/octet-stream"
		}

		c.Header("Content-Type", ct)
		c.Header("Content-Disposition", "inline; filename="+filename)
		c.Header("Cache-Control", "public, max-age=3600")
		c.DataFromReader(http.StatusOK, -1, ct, rc, nil)
	})
}

func RegisterContentRoutes(api *gin.RouterGroup) {
	api.GET("/guidance", func(c *gin.Context) {
		u, ok := authedUser(c)
		if !ok {
			return
		}
		_ = u

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

	api.GET("/guidance/today", func(c *gin.Context) {
		u, ok := authedUser(c)
		if !ok {
			return
		}

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
					PhaseID:  phaseID,
					Day:      dayInPhase,
					Guidance: nil,
				})
				return
			}
			c.Error(qerr)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load guidance"})
			return
		}

		c.JSON(http.StatusOK, TodayGuidanceResponse{
			PhaseID:  phaseID,
			Day:      dayInPhase,
			Guidance: &r,
		})
	})
}

func RegisterAdminContentRoutes(api *gin.RouterGroup, store UploadStore) {
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

	api.POST("/admin/guidance", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		var req UpsertGuidanceRequest
		var uploadedAudioURL *string
		var uploadedAudioObjectPath string
		var uploadedAudioFilename string

		contentType := strings.ToLower(strings.TrimSpace(c.ContentType()))
		if strings.HasPrefix(contentType, "multipart/form-data") {
			req.PhaseID, _ = strconv.Atoi(strings.TrimSpace(c.PostForm("phaseId")))
			req.Day, _ = strconv.Atoi(strings.TrimSpace(c.PostForm("day")))
			req.Title = strings.TrimSpace(c.PostForm("title"))
			req.Content = strings.TrimSpace(c.PostForm("content"))

			removeAudioRaw := strings.ToLower(strings.TrimSpace(c.PostForm("removeAudio")))
			req.RemoveAudio = removeAudioRaw == "true" || removeAudioRaw == "1" || removeAudioRaw == "yes"

			fh, err := c.FormFile("audio")
			if err == nil && fh != nil {
				ext := strings.ToLower(filepath.Ext(fh.Filename))
				if ext == "" {
					ext = ".bin"
				}

				uploadedAudioFilename = uuid.New().String() + ext
				uploadedAudioObjectPath = guidanceAudioObjectPath(uploadedAudioFilename)

				f, ferr := fh.Open()
				if ferr != nil {
					c.Error(ferr)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to open audio file"})
					return
				}
				defer f.Close()

				ct := fh.Header.Get("Content-Type")
				if ct == "" {
					ct = mime.TypeByExtension(ext)
				}

				if err := store.Save(c.Request.Context(), uploadedAudioObjectPath, f, ct); err != nil {
					c.Error(err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload audio"})
					return
				}

				v := guidanceAudioPublicURL(uploadedAudioFilename)
				uploadedAudioURL = &v
			}
		} else {
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
				return
			}
			req.Title = strings.TrimSpace(req.Title)
			req.Content = strings.TrimSpace(req.Content)

			if req.AudioURL != nil {
				v := strings.TrimSpace(*req.AudioURL)
				if v == "" {
					req.AudioURL = nil
				} else {
					req.AudioURL = &v
				}
			}
		}

		if req.PhaseID <= 0 || req.Day <= 0 {
			if uploadedAudioObjectPath != "" {
				_ = store.Delete(c.Request.Context(), uploadedAudioObjectPath)
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": "phaseId and day are required"})
			return
		}
		if req.Title == "" || req.Content == "" {
			if uploadedAudioObjectPath != "" {
				_ = store.Delete(c.Request.Context(), uploadedAudioObjectPath)
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": "title and content are required"})
			return
		}

		var existingAudioURL *string
		err := DB.QueryRow(c.Request.Context(), `
			SELECT audio_url
			FROM daily_guidance
			WHERE phase_id = $1 AND day = $2
			LIMIT 1
		`, req.PhaseID, req.Day).Scan(&existingAudioURL)
		if err != nil && err != pgx.ErrNoRows {
			if uploadedAudioObjectPath != "" {
				_ = store.Delete(c.Request.Context(), uploadedAudioObjectPath)
			}
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load existing guidance"})
			return
		}

		finalAudioURL := existingAudioURL
		if req.RemoveAudio {
			finalAudioURL = nil
		}
		if req.AudioURL != nil {
			finalAudioURL = req.AudioURL
		}
		if uploadedAudioURL != nil {
			finalAudioURL = uploadedAudioURL
		}

		newID := uuid.New().String()
		var out GuidanceRow

		err = DB.QueryRow(c.Request.Context(), `
			INSERT INTO daily_guidance (id, phase_id, day, title, content, audio_url)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (phase_id, day)
			DO UPDATE SET
				title = EXCLUDED.title,
				content = EXCLUDED.content,
				audio_url = EXCLUDED.audio_url
			RETURNING id, phase_id, day, title, content, audio_url, created_at
		`, newID, req.PhaseID, req.Day, req.Title, req.Content, finalAudioURL).Scan(
			&out.ID, &out.PhaseID, &out.Day, &out.Title, &out.Content, &out.AudioURL, &out.CreatedAt,
		)

		if err != nil {
			if uploadedAudioObjectPath != "" {
				_ = store.Delete(c.Request.Context(), uploadedAudioObjectPath)
			}
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save guidance"})
			return
		}

		if existingAudioURL != nil {
			oldURL := strings.TrimSpace(*existingAudioURL)
			newURL := ""
			if out.AudioURL != nil {
				newURL = strings.TrimSpace(*out.AudioURL)
			}
			if oldURL != "" && oldURL != newURL {
				deleteGuidanceAudioBestEffort(c, store, existingAudioURL)
			}
		}

		c.JSON(http.StatusOK, out)
	})

	api.DELETE("/admin/guidance/:id", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		id := strings.TrimSpace(c.Param("id"))
		if id == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing id"})
			return
		}

		var audioURL *string
		err := DB.QueryRow(c.Request.Context(), `
			SELECT audio_url
			FROM daily_guidance
			WHERE id = $1
		`, id).Scan(&audioURL)
		if err != nil {
			if err == pgx.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "guidance not found"})
				return
			}
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load guidance"})
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

		deleteGuidanceAudioBestEffort(c, store, audioURL)
		c.Status(http.StatusNoContent)
	})
}
