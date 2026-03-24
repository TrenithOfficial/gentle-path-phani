package main

import (
	"io"
	"log"
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

// DB table:
// healing_sheets(id uuid pk, phase_id int null, user_id uuid null, name text null, file_path text not null, uploaded_at timestamptz default now())

type HealingSheetRow struct {
	ID         string    `json:"id"`
	Scope      string    `json:"scope"` // "phase" or "personal" (derived)
	PhaseID    *int      `json:"phaseId,omitempty"`
	UserID     *string   `json:"userId,omitempty"`
	Name       *string   `json:"name,omitempty"`
	URL        string    `json:"url"`        // maps to file_path in DB
	UploadedAt time.Time `json:"uploadedAt"` // maps to uploaded_at
}

func scopeFromRow(phaseID *int, userID *string) string {
	if userID != nil && strings.TrimSpace(*userID) != "" {
		return "personal"
	}
	return "phase"
}

func publicURLForFile(filename string) string {
	return "/uploads/healing-sheets/" + filename
}

func objectPathFromFilename(filename string) string {
	return "healing-sheets/" + filename
}

// RegisterUploadsRoutes serves /uploads/healing-sheets/* using the provided UploadStore.
// Call this in main.go (router level, NOT under /api).
func RegisterUploadsRoutes(r *gin.Engine, store UploadStore) {
	r.GET("/uploads/healing-sheets/:filename", func(c *gin.Context) {
		filename := strings.TrimSpace(c.Param("filename"))
		if filename == "" {
			c.Status(http.StatusNotFound)
			return
		}

		objectPath := objectPathFromFilename(filename)

		rc, ct, err := store.Open(c.Request.Context(), objectPath)
		if err != nil {
			log.Printf("UPLOAD OPEN FAILED filename=%s path=%s err=%v", filename, objectPath, err)
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}
		defer rc.Close()

		if ct == "" {
			ext := strings.ToLower(filepath.Ext(filename))
			ct = mime.TypeByExtension(ext)
		}
		if ct == "" {
			ct = "application/octet-stream"
		}

		c.Header("Content-Type", ct)
		c.Header("Content-Disposition", "inline; filename="+strconv.Quote(filename))
		c.Status(http.StatusOK)

		if _, err := io.Copy(c.Writer, rc); err != nil {
			c.Error(err)
		}
	})
}

// -------------------- CLIENT ROUTES --------------------

func RegisterHealingSheetRoutes(api *gin.RouterGroup) {
	// Client: list sheets available to this user (phase sheets up to current phase + personal assigned)
	// GET /api/healing-sheets
	api.GET("/healing-sheets", func(c *gin.Context) {
		u, ok := authedUser(c)
		if !ok {
			return
		}

		// Load user's start_date to compute current phase
		var startDate *time.Time
		if err := DB.QueryRow(c.Request.Context(), `
			SELECT start_date
			FROM users
			WHERE id = $1
		`, u.ID).Scan(&startDate); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user start date"})
			return
		}

		// Compute current day number since start_date (1-based)
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

		// Map day -> current phase (1..6)
		const daysPerPhase = 15
		currentPhaseID := ((dayNumber - 1) / daysPerPhase) + 1
		if currentPhaseID < 1 {
			currentPhaseID = 1
		}
		if currentPhaseID > 6 {
			currentPhaseID = 6
		}

		rows, err := DB.Query(c.Request.Context(), `
			SELECT id, phase_id, user_id, name, file_path, uploaded_at
			FROM healing_sheets
			WHERE
				(user_id = $1)
				OR
				(user_id IS NULL AND phase_id IS NOT NULL AND phase_id <= $2)
			ORDER BY uploaded_at DESC
			LIMIT 500
		`, u.ID, currentPhaseID)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load healing sheets"})
			return
		}
		defer rows.Close()

		out := make([]HealingSheetRow, 0, 50)
		for rows.Next() {
			var (
				id         string
				phaseID    *int
				userID     *string
				name       *string
				filePath   string
				uploadedAt time.Time
			)

			if err := rows.Scan(&id, &phaseID, &userID, &name, &filePath, &uploadedAt); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read healing sheets"})
				return
			}

			out = append(out, HealingSheetRow{
				ID:         id,
				Scope:      scopeFromRow(phaseID, userID),
				PhaseID:    phaseID,
				UserID:     userID,
				Name:       name,
				URL:        filePath,
				UploadedAt: uploadedAt,
			})
		}

		if err := rows.Err(); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read healing sheets"})
			return
		}

		c.JSON(http.StatusOK, out)
	})
}

// -------------------- ADMIN ROUTES --------------------

func RegisterAdminHealingSheetRoutes(api *gin.RouterGroup, store UploadStore) {
	// Admin list
	api.GET("/admin/healing-sheets", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		rows, err := DB.Query(c.Request.Context(), `
			SELECT id, phase_id, user_id, name, file_path, uploaded_at
			FROM healing_sheets
			ORDER BY uploaded_at DESC
			LIMIT 2000
		`)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load healing sheets"})
			return
		}
		defer rows.Close()

		out := make([]HealingSheetRow, 0, 200)
		for rows.Next() {
			var (
				id         string
				phaseID    *int
				userID     *string
				name       *string
				filePath   string
				uploadedAt time.Time
			)

			if err := rows.Scan(&id, &phaseID, &userID, &name, &filePath, &uploadedAt); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read healing sheets"})
				return
			}

			out = append(out, HealingSheetRow{
				ID:         id,
				Scope:      scopeFromRow(phaseID, userID),
				PhaseID:    phaseID,
				UserID:     userID,
				Name:       name,
				URL:        filePath,
				UploadedAt: uploadedAt,
			})
		}

		if err := rows.Err(); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read healing sheets"})
			return
		}

		c.JSON(http.StatusOK, out)
	})

	// Admin upload
	api.POST("/admin/healing-sheets/upload", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		scope := strings.ToLower(strings.TrimSpace(c.PostForm("scope")))
		if scope != "phase" && scope != "personal" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "scope must be phase or personal"})
			return
		}

		var phaseID *int
		var userID *string

		if scope == "phase" {
			phaseIdStr := strings.TrimSpace(c.PostForm("phaseId"))
			n, err := strconv.Atoi(phaseIdStr)
			if err != nil || n <= 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "phaseId is required for phase sheets"})
				return
			}
			phaseID = &n
		}

		if scope == "personal" {
			userIdStr := strings.TrimSpace(c.PostForm("userId"))
			if userIdStr == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "userId is required for personal sheets"})
				return
			}
			if _, err := uuid.Parse(userIdStr); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "userId must be a valid uuid"})
				return
			}
			userID = &userIdStr
		}

		var name *string
		if v := strings.TrimSpace(c.PostForm("name")); v != "" {
			name = &v
		}

		fh, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
			return
		}

		ext := strings.ToLower(filepath.Ext(fh.Filename))
		if ext == "" {
			ext = ".bin"
		}

		id := uuid.New().String()
		filename := id + ext
		objectPath := objectPathFromFilename(filename)

		f, err := fh.Open()
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to open file"})
			return
		}
		defer f.Close()

		ct := fh.Header.Get("Content-Type")
		if ct == "" {
			ct = mime.TypeByExtension(ext)
		}

		if err := store.Save(c.Request.Context(), objectPath, f, ct); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload file"})
			return
		}

		filePath := publicURLForFile(filename)

		var (
			dbPhaseID *int
			dbUserID  *string
			dbName    *string
			uploaded  time.Time
		)

		err = DB.QueryRow(c.Request.Context(), `
			INSERT INTO healing_sheets (id, phase_id, user_id, name, file_path)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING phase_id, user_id, name, uploaded_at
		`, id, phaseID, userID, name, filePath).Scan(&dbPhaseID, &dbUserID, &dbName, &uploaded)

		if err != nil {
			_ = store.Delete(c.Request.Context(), objectPath) // best-effort rollback
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save sheet"})
			return
		}

		c.JSON(http.StatusCreated, HealingSheetRow{
			ID:         id,
			Scope:      scopeFromRow(dbPhaseID, dbUserID),
			PhaseID:    dbPhaseID,
			UserID:     dbUserID,
			Name:       dbName,
			URL:        filePath,
			UploadedAt: uploaded,
		})
	})

	// Admin delete
	api.DELETE("/admin/healing-sheets/:id", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		id := strings.TrimSpace(c.Param("id"))
		if id == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing id"})
			return
		}

		var filePath string
		err := DB.QueryRow(c.Request.Context(), `SELECT file_path FROM healing_sheets WHERE id = $1`, id).Scan(&filePath)
		if err != nil {
			if err == pgx.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "sheet not found"})
				return
			}
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load sheet"})
			return
		}

		cmd, err := DB.Exec(c.Request.Context(), `DELETE FROM healing_sheets WHERE id = $1`, id)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete sheet"})
			return
		}
		if cmd.RowsAffected() == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "sheet not found"})
			return
		}

		filename := strings.TrimPrefix(strings.TrimSpace(filePath), "/uploads/healing-sheets/")
		filename = strings.TrimPrefix(filename, "uploads/healing-sheets/")
		_ = store.Delete(c.Request.Context(), objectPathFromFilename(filename))

		c.Status(http.StatusNoContent)
	})
}