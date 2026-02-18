package main

import (
	"errors"
	"net/http"
	"strings"
	"time"

	fbauth "firebase.google.com/go/v4/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func RegisterAdminUserRoutes(api *gin.RouterGroup) {

	// LIST: GET /api/admin/users?status=active|inactive|all
	api.GET("/admin/users", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		status := strings.ToLower(strings.TrimSpace(c.Query("status")))
		if status == "" {
			status = "active"
		}

		var (
			rows pgx.Rows
			err  error
		)

		switch status {
		case "active":
			rows, err = DB.Query(c.Request.Context(), `
				SELECT id, email, COALESCE(name, ''), role, start_date, created_at
				FROM users
				WHERE role = 'client' AND start_date IS NOT NULL
				ORDER BY created_at DESC
				LIMIT 500
			`)
		case "inactive":
			rows, err = DB.Query(c.Request.Context(), `
				SELECT id, email, COALESCE(name, ''), role, start_date, created_at
				FROM users
				WHERE role = 'client' AND start_date IS NULL
				ORDER BY created_at DESC
				LIMIT 500
			`)
		case "all":
			rows, err = DB.Query(c.Request.Context(), `
				SELECT id, email, COALESCE(name, ''), role, start_date, created_at
				FROM users
				WHERE role = 'client'
				ORDER BY created_at DESC
				LIMIT 500
			`)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "status must be active, inactive, or all"})
			return
		}

		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load users"})
			return
		}
		defer rows.Close()

		out := make([]AdminUserRow, 0, 200)
		for rows.Next() {
			var u AdminUserRow
			if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.StartDate, &u.CreatedAt); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read users"})
				return
			}
			out = append(out, u)
		}

		if err := rows.Err(); err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read users"})
			return
		}

		c.JSON(http.StatusOK, out)
	})

	// DETAIL: GET /api/admin/users/:id  (NOW returns full profile for edit prefilling)
	api.GET("/admin/users/:id", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		idStr := strings.TrimSpace(c.Param("id"))
		id, err := uuid.Parse(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
			return
		}

		var out AdminUserDetailRow
		err = DB.QueryRow(c.Request.Context(), `
			SELECT
				id,
				email,
				COALESCE(name, ''),
				role,
				start_date,
				created_at,

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
			FROM users
			WHERE id = $1 AND role = 'client'
		`, id).Scan(
			&out.ID,
			&out.Email,
			&out.Name,
			&out.Role,
			&out.StartDate,
			&out.CreatedAt,

			&out.FirstName,
			&out.LastName,
			&out.Age,
			&out.Gender,

			&out.PhoneCountryCode,
			&out.PhoneNumber,

			&out.Timezone,
			&out.Address,

			&out.EmergencyContactName,
			&out.EmergencyContactPhoneCountryCode,
			&out.EmergencyContactPhoneNumber,

			&out.Notes,
		)

		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
				return
			}
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user"})
			return
		}

		c.JSON(http.StatusOK, out)
	})

	// CREATE: POST /api/admin/users
	api.POST("/admin/users", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		var req AdminCreateUserRequest
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

		var startDate *time.Time
		if active {
			if strings.TrimSpace(req.StartDate) == "" {
				t := time.Now().UTC()
				startDate = &t
			} else {
				parsed, err := time.Parse("2006-01-02", strings.TrimSpace(req.StartDate))
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "startDate must be YYYY-MM-DD"})
					return
				}
				t := parsed.UTC()
				startDate = &t
			}
		} else {
			startDate = nil
		}

		trimOrNil := func(s *string) *string {
			if s == nil {
				return nil
			}
			t := strings.TrimSpace(*s)
			if t == "" {
				return nil
			}
			return &t
		}

		firstName := trimOrNil(req.FirstName)
		lastName := trimOrNil(req.LastName)
		gender := trimOrNil(req.Gender)

		phoneCC := trimOrNil(req.PhoneCountryCode)
		phoneNum := trimOrNil(req.PhoneNumber)

		tz := trimOrNil(req.Timezone)
		addr := trimOrNil(req.Address)

		ecName := trimOrNil(req.EmergencyContactName)
		ecCC := trimOrNil(req.EmergencyContactPhoneCountryCode)
		ecNum := trimOrNil(req.EmergencyContactPhoneNumber)

		notes := trimOrNil(req.Notes)

		if strings.TrimSpace(name) == "" {
			fn := ""
			ln := ""
			if firstName != nil {
				fn = *firstName
			}
			if lastName != nil {
				ln = *lastName
			}
			built := strings.TrimSpace(strings.TrimSpace(fn) + " " + strings.TrimSpace(ln))
			name = built
		}

		id := uuid.New()

		var out AdminUserRow
		err := DB.QueryRow(c.Request.Context(), `
			INSERT INTO users (
				id, email, name, role, start_date,
				first_name, last_name, age, gender,
				phone_country_code, phone_number,
				timezone, address,
				emergency_contact_name, emergency_contact_phone_country_code, emergency_contact_phone_number,
				notes
			)
			VALUES (
				$1, $2, $3, 'client', $4,
				$5, $6, $7, $8,
				$9, $10,
				$11, $12,
				$13, $14, $15,
				$16
			)
			ON CONFLICT (email) DO UPDATE SET
				name = EXCLUDED.name,
				start_date = EXCLUDED.start_date,
				role = 'client',

				first_name = EXCLUDED.first_name,
				last_name = EXCLUDED.last_name,
				age = EXCLUDED.age,
				gender = EXCLUDED.gender,

				phone_country_code = EXCLUDED.phone_country_code,
				phone_number = EXCLUDED.phone_number,

				timezone = EXCLUDED.timezone,
				address = EXCLUDED.address,

				emergency_contact_name = EXCLUDED.emergency_contact_name,
				emergency_contact_phone_country_code = EXCLUDED.emergency_contact_phone_country_code,
				emergency_contact_phone_number = EXCLUDED.emergency_contact_phone_number,

				notes = EXCLUDED.notes
			RETURNING id, email, COALESCE(name, ''), role, start_date, created_at
		`, id, email, name, startDate,
			firstName, lastName, req.Age, gender,
			phoneCC, phoneNum,
			tz, addr,
			ecName, ecCC, ecNum,
			notes,
		).Scan(
			&out.ID, &out.Email, &out.Name, &out.Role, &out.StartDate, &out.CreatedAt,
		)

		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
			return
		}

		c.JSON(http.StatusCreated, out)
	})

	// UPDATE: PATCH /api/admin/users/:id
	api.PATCH("/admin/users/:id", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		idStr := strings.TrimSpace(c.Param("id"))
		id, err := uuid.Parse(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
			return
		}

		var req AdminUpdateUserRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}

		ctx := c.Request.Context()

		// Load current DB user + profile fields so we can "keep old value" when omitted
		var (
			cur AdminUserRow

			curFirstName *string
			curLastName  *string
			curAge       *int
			curGender    *string

			curPhoneCC  *string
			curPhoneNum *string

			curTz   *string
			curAddr *string

			curECName *string
			curECCC   *string
			curECNum  *string

			curNotes *string
		)

		err = DB.QueryRow(ctx, `
			SELECT
				id, email, COALESCE(name, ''), role, start_date, created_at,
				first_name, last_name, age, gender,
				phone_country_code, phone_number,
				timezone, address,
				emergency_contact_name, emergency_contact_phone_country_code, emergency_contact_phone_number,
				notes
			FROM users
			WHERE id = $1 AND role = 'client'
		`, id).Scan(
			&cur.ID, &cur.Email, &cur.Name, &cur.Role, &cur.StartDate, &cur.CreatedAt,
			&curFirstName, &curLastName, &curAge, &curGender,
			&curPhoneCC, &curPhoneNum,
			&curTz, &curAddr,
			&curECName, &curECCC, &curECNum,
			&curNotes,
		)

		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
				return
			}
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user"})
			return
		}

		trimOrNil := func(s *string) *string {
			if s == nil {
				return nil
			}
			t := strings.TrimSpace(*s)
			if t == "" {
				return nil
			}
			return &t
		}

		// email/name/active
		newEmail := cur.Email
		if req.Email != nil {
			newEmail = strings.ToLower(strings.TrimSpace(*req.Email))
			if newEmail == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "email cannot be empty"})
				return
			}
		}

		newName := cur.Name
		if req.Name != nil {
			newName = strings.TrimSpace(*req.Name)
		}

		var newStartDate *time.Time = cur.StartDate
		if req.Active != nil {
			if *req.Active {
				if newStartDate == nil {
					t := time.Now().UTC()
					newStartDate = &t
				}
			} else {
				newStartDate = nil
			}
		}

		// profile fields: keep existing if omitted; allow clearing string fields by sending ""
		newFirstName := curFirstName
		if req.FirstName != nil {
			newFirstName = trimOrNil(req.FirstName)
		}

		newLastName := curLastName
		if req.LastName != nil {
			newLastName = trimOrNil(req.LastName)
		}

		newGender := curGender
		if req.Gender != nil {
			newGender = trimOrNil(req.Gender)
		}

		newAge := curAge
		if req.Age != nil {
			newAge = req.Age
		}

		newPhoneCC := curPhoneCC
		if req.PhoneCountryCode != nil {
			newPhoneCC = trimOrNil(req.PhoneCountryCode)
		}
		newPhoneNum := curPhoneNum
		if req.PhoneNumber != nil {
			newPhoneNum = trimOrNil(req.PhoneNumber)
		}

		newTz := curTz
		if req.Timezone != nil {
			newTz = trimOrNil(req.Timezone)
		}
		newAddr := curAddr
		if req.Address != nil {
			newAddr = trimOrNil(req.Address)
		}

		newECName := curECName
		if req.EmergencyContactName != nil {
			newECName = trimOrNil(req.EmergencyContactName)
		}
		newECCC := curECCC
		if req.EmergencyContactPhoneCountryCode != nil {
			newECCC = trimOrNil(req.EmergencyContactPhoneCountryCode)
		}
		newECNum := curECNum
		if req.EmergencyContactPhoneNumber != nil {
			newECNum = trimOrNil(req.EmergencyContactPhoneNumber)
		}

		newNotes := curNotes
		if req.Notes != nil {
			newNotes = trimOrNil(req.Notes)
		}

		// If email is changing, enforce DB uniqueness
		if newEmail != cur.Email {
			var exists bool
			_ = DB.QueryRow(ctx, `
				SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND id <> $2)
			`, newEmail, cur.ID).Scan(&exists)
			if exists {
				c.JSON(http.StatusConflict, gin.H{"error": "email already exists"})
				return
			}
		}

		// Firebase: update existing firebase user email (do NOT create a new firebase user)
		if newEmail != cur.Email {
			fbUser, fbErr := FirebaseAuth.GetUserByEmail(ctx, cur.Email)
			if fbErr == nil && fbUser != nil {
				other, otherErr := FirebaseAuth.GetUserByEmail(ctx, newEmail)
				if otherErr == nil && other != nil && other.UID != fbUser.UID {
					c.JSON(http.StatusConflict, gin.H{"error": "firebase email already exists"})
					return
				}

				upd := (&fbauth.UserToUpdate{}).Email(newEmail)
				if newName != "" {
					upd = upd.DisplayName(newName)
				}

				if _, err := FirebaseAuth.UpdateUser(ctx, fbUser.UID, upd); err != nil {
					c.Error(err)
					c.JSON(http.StatusInternalServerError, gin.H{
						"error":   "failed to update firebase user",
						"details": err.Error(),
					})
					return
				}

				_ = FirebaseAuth.RevokeRefreshTokens(ctx, fbUser.UID)
			}
		} else if req.Name != nil {
			fbUser, fbErr := FirebaseAuth.GetUserByEmail(ctx, cur.Email)
			if fbErr == nil && fbUser != nil {
				_, _ = FirebaseAuth.UpdateUser(ctx, fbUser.UID, (&fbauth.UserToUpdate{}).DisplayName(newName))
			}
		}

		// Update DB (including profile fields)
		var out AdminUserRow
		err = DB.QueryRow(ctx, `
			UPDATE users
			SET
				email = $2,
				name = $3,
				start_date = $4,
				role = 'client',

				first_name = $5,
				last_name = $6,
				age = $7,
				gender = $8,

				phone_country_code = $9,
				phone_number = $10,

				timezone = $11,
				address = $12,

				emergency_contact_name = $13,
				emergency_contact_phone_country_code = $14,
				emergency_contact_phone_number = $15,

				notes = $16
			WHERE id = $1
			RETURNING id, email, COALESCE(name, ''), role, start_date, created_at
		`, cur.ID, newEmail, newName, newStartDate,
			newFirstName, newLastName, newAge, newGender,
			newPhoneCC, newPhoneNum,
			newTz, newAddr,
			newECName, newECCC, newECNum,
			newNotes,
		).Scan(
			&out.ID, &out.Email, &out.Name, &out.Role, &out.StartDate, &out.CreatedAt,
		)

		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user"})
			return
		}

		c.JSON(http.StatusOK, out)
	})

	// DELETE: DELETE /api/admin/users/:id
	api.DELETE("/admin/users/:id", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		idStr := strings.TrimSpace(c.Param("id"))
		id, err := uuid.Parse(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
			return
		}

		ctx := c.Request.Context()

		var email string
		err = DB.QueryRow(ctx, `SELECT email FROM users WHERE id = $1 AND role = 'client'`, id).Scan(&email)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
				return
			}
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user"})
			return
		}

		fbUser, fbErr := FirebaseAuth.GetUserByEmail(ctx, email)
		if fbErr == nil && fbUser != nil {
			_ = FirebaseAuth.RevokeRefreshTokens(ctx, fbUser.UID)
			if err := FirebaseAuth.DeleteUser(ctx, fbUser.UID); err != nil {
				c.Error(err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "failed to delete firebase user",
					"details": err.Error(),
				})
				return
			}
		}

		ct, err := DB.Exec(ctx, `DELETE FROM users WHERE id = $1 AND role = 'client'`, id)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete user"})
			return
		}
		if ct.RowsAffected() == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}

		c.Status(http.StatusNoContent)
	})
}
