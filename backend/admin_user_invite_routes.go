package main

import (
	"net/http"
	"os"
	"strings"
	"time"

	fbauth "firebase.google.com/go/v4/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AdminInviteUserRequest struct {
	Email  string `json:"email"`
	Name   string `json:"name"`
	Active *bool  `json:"active"`
}

type AdminInviteUserResponse struct {
	Email       string `json:"email"`
	FirebaseUID string `json:"firebaseUid"`
	ResetLink   string `json:"resetLink"`
}

func generatePasswordResetLinkAdminSDK(c *gin.Context, email string) (string, error) {
	continueURL := strings.TrimSpace(os.Getenv("FRONTEND_ORIGIN"))
	if continueURL == "" {
		continueURL = "http://localhost:8080"
	}
	continueURL = strings.TrimRight(continueURL, "/") + "/login"

	acs := &fbauth.ActionCodeSettings{
		URL:             continueURL,
		HandleCodeInApp: false,
	}

	link, err := FirebaseAuth.PasswordResetLinkWithSettings(c.Request.Context(), email, acs)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(link) == "" {
		return "", &envError{msg: "Firebase did not return reset link"}
	}
	return link, nil
}

func RegisterAdminUserInviteRoutes(api *gin.RouterGroup) {
	api.POST("/admin/users/invite", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		var req AdminInviteUserRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}

		email := strings.ToLower(strings.TrimSpace(req.Email))
		name := strings.TrimSpace(req.Name)
		if email == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "email is required"})
			return
		}

		active := true
		if req.Active != nil {
			active = *req.Active
		}

		ctx := c.Request.Context()

		// 1) Create or fetch Firebase user
		u, err := FirebaseAuth.GetUserByEmail(ctx, email)
		if err != nil {
			if fbauth.IsUserNotFound(err) {
				toCreate := (&fbauth.UserToCreate{}).Email(email)
				if name != "" {
					toCreate = toCreate.DisplayName(name)
				}
				u, err = FirebaseAuth.CreateUser(ctx, toCreate)
				if err != nil {
					c.Error(err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create firebase user"})
					return
				}
			} else {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup firebase user"})
				return
			}
		} else if name != "" && u.DisplayName != name {
			_, _ = FirebaseAuth.UpdateUser(ctx, u.UID, (&fbauth.UserToUpdate{}).DisplayName(name))
		}

		// 2) Set custom role claim
		if err := FirebaseAuth.SetCustomUserClaims(ctx, u.UID, map[string]interface{}{"role": "client"}); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to set user role"})
			return
		}

		// 3) Ensure DB user exists
		var startDate *time.Time
		if active {
			t := time.Now().UTC()
			startDate = &t
		}

		newID := uuid.New()
		_, err = DB.Exec(ctx, `
			INSERT INTO users (id, email, name, role, start_date)
			VALUES ($1, $2, $3, 'client', $4)
			ON CONFLICT (email) DO UPDATE SET
				name = EXCLUDED.name,
				role = 'client',
				start_date = EXCLUDED.start_date
		`, newID, email, name, startDate)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upsert db user"})
			return
		}

		// 4) Generate invite link
		link, err := generatePasswordResetLinkAdminSDK(c, email)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "failed to generate invite link",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, AdminInviteUserResponse{
			Email:       email,
			FirebaseUID: u.UID,
			ResetLink:   link,
		})
	})
}
