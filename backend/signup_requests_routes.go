package main

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type SignupRequestRow struct {
	ID         uuid.UUID  `json:"id"`
	Email      string     `json:"email"`
	Name       string     `json:"name"`
	Status     string     `json:"status"`
	CreatedAt  time.Time  `json:"createdAt"`
	ReviewedAt *time.Time `json:"reviewedAt,omitempty"`

	FirstName *string `json:"firstName"`
	LastName  *string `json:"lastName"`
	Age       *int    `json:"age"`
	Gender    *string `json:"gender"`

	PhoneCountryCode *string `json:"phoneCountryCode"`
	PhoneNumber      *string `json:"phoneNumber"`

	Timezone *string `json:"timezone"`
	Address  *string `json:"address"`

	EmergencyContactName             *string `json:"emergencyContactName"`
	EmergencyContactPhoneCountryCode *string `json:"emergencyContactPhoneCountryCode"`
	EmergencyContactPhoneNumber      *string `json:"emergencyContactPhoneNumber"`

	Notes *string `json:"notes"`
}

type PublicSignupRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`

	FirstName *string `json:"firstName"`
	LastName  *string `json:"lastName"`
	Age       *int    `json:"age"`
	Gender    *string `json:"gender"`

	PhoneCountryCode *string `json:"phoneCountryCode"`
	PhoneNumber      *string `json:"phoneNumber"`

	Timezone *string `json:"timezone"`
	Address  *string `json:"address"`

	EmergencyContactName             *string `json:"emergencyContactName"`
	EmergencyContactPhoneCountryCode *string `json:"emergencyContactPhoneCountryCode"`
	EmergencyContactPhoneNumber      *string `json:"emergencyContactPhoneNumber"`

	Notes *string `json:"notes"`
}

func RegisterSignupRequestRoutes(r *gin.Engine, api *gin.RouterGroup) {
	r.POST("/api/signup-requests", func(c *gin.Context) {
		var req PublicSignupRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}

		email := strings.ToLower(strings.TrimSpace(req.Email))
		name := strings.TrimSpace(req.Name)
		password := strings.TrimSpace(req.Password)

		if email == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "email is required"})
			return
		}
		if password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "password is required"})
			return
		}

		var existingUserCount int
		if err := DB.QueryRow(c.Request.Context(), `
			SELECT COUNT(*)
			FROM users
			WHERE LOWER(email) = LOWER($1)
		`, email).Scan(&existingUserCount); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check existing user"})
			return
		}
		if existingUserCount > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "user already exists"})
			return
		}

		var existingPendingCount int
		if err := DB.QueryRow(c.Request.Context(), `
			SELECT COUNT(*)
			FROM signup_requests
			WHERE LOWER(email) = LOWER($1)
			  AND status = 'pending'
		`, email).Scan(&existingPendingCount); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check pending request"})
			return
		}
		if existingPendingCount > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "signup request already pending"})
			return
		}

		id := uuid.New()

		_, err := DB.Exec(c.Request.Context(), `
			INSERT INTO signup_requests (
				id, email, name, password,
				status,
				first_name, last_name, age, gender,
				phone_country_code, phone_number,
				timezone, address,
				emergency_contact_name,
				emergency_contact_phone_country_code,
				emergency_contact_phone_number,
				notes
			) VALUES (
				$1, $2, $3, $4,
				'pending',
				$5, $6, $7, $8,
				$9, $10,
				$11, $12,
				$13, $14, $15,
				$16
			)
		`,
			id, email, name, password,
			req.FirstName, req.LastName, req.Age, req.Gender,
			req.PhoneCountryCode, req.PhoneNumber,
			req.Timezone, req.Address,
			req.EmergencyContactName,
			req.EmergencyContactPhoneCountryCode,
			req.EmergencyContactPhoneNumber,
			req.Notes,
		)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create signup request"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"ok":      true,
			"message": "signup request submitted",
			"id":      id,
		})
	})

	api.GET("/admin/signup-requests", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		rows, err := DB.Query(c.Request.Context(), `
			SELECT
				id,
				email,
				COALESCE(name, ''),
				status,
				created_at,
				reviewed_at,
				first_name,
				last_name,
				age,
				gender,
				phone_country_code,
				phone_number,
				timezone,
				address,
				emergency_contact_name,
				emergency_contact_phone_country_code,
				emergency_contact_phone_number,
				notes
			FROM signup_requests
			WHERE status = 'pending'
			ORDER BY created_at DESC
			LIMIT 500
		`)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load signup requests"})
			return
		}
		defer rows.Close()

		out := make([]SignupRequestRow, 0, 100)
		for rows.Next() {
			var item SignupRequestRow
			if err := rows.Scan(
				&item.ID,
				&item.Email,
				&item.Name,
				&item.Status,
				&item.CreatedAt,
				&item.ReviewedAt,
				&item.FirstName,
				&item.LastName,
				&item.Age,
				&item.Gender,
				&item.PhoneCountryCode,
				&item.PhoneNumber,
				&item.Timezone,
				&item.Address,
				&item.EmergencyContactName,
				&item.EmergencyContactPhoneCountryCode,
				&item.EmergencyContactPhoneNumber,
				&item.Notes,
			); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read signup requests"})
				return
			}
			out = append(out, item)
		}

		if err := rows.Err(); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read signup requests"})
			return
		}

		c.JSON(http.StatusOK, out)
	})

	api.DELETE("/admin/signup-requests/:id", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
			return
		}

		tag, err := DB.Exec(c.Request.Context(), `
			UPDATE signup_requests
			SET status = 'deleted', reviewed_at = now()
			WHERE id = $1 AND status = 'pending'
		`, id)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete signup request"})
			return
		}

		if tag.RowsAffected() == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "signup request not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	api.POST("/admin/signup-requests/:id/accept", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
			return
		}

		var req SignupRequestRow
		var password string

		err = DB.QueryRow(c.Request.Context(), `
			SELECT
				id,
				email,
				COALESCE(name, ''),
				status,
				created_at,
				reviewed_at,
				first_name,
				last_name,
				age,
				gender,
				phone_country_code,
				phone_number,
				timezone,
				address,
				emergency_contact_name,
				emergency_contact_phone_country_code,
				emergency_contact_phone_number,
				notes,
				password
			FROM signup_requests
			WHERE id = $1
		`, id).Scan(
			&req.ID,
			&req.Email,
			&req.Name,
			&req.Status,
			&req.CreatedAt,
			&req.ReviewedAt,
			&req.FirstName,
			&req.LastName,
			&req.Age,
			&req.Gender,
			&req.PhoneCountryCode,
			&req.PhoneNumber,
			&req.Timezone,
			&req.Address,
			&req.EmergencyContactName,
			&req.EmergencyContactPhoneCountryCode,
			&req.EmergencyContactPhoneNumber,
			&req.Notes,
			&password,
		)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				c.JSON(http.StatusNotFound, gin.H{"error": "signup request not found"})
				return
			}
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load signup request"})
			return
		}

		if req.Status != "pending" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "signup request already processed"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"ok":      true,
			"message": "accept endpoint ready",
			"request": req,
		})
	})
}
