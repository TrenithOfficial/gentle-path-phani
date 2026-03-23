package main

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type AppUser struct {
	ID        uuid.UUID  `json:"id"`
	Email     string     `json:"email"`
	Name      string     `json:"name,omitempty"`
	Role      string     `json:"role"`
	StartDate *time.Time `json:"startDate,omitempty"`
}

type AppUserProfile struct {
	ID        uuid.UUID  `json:"id"`
	Email     string     `json:"email"`
	Name      string     `json:"name,omitempty"`
	Role      string     `json:"role"`
	StartDate *time.Time `json:"startDate,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`

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

func upsertUser(ctx context.Context, uid string, email string, name string, role string) (*AppUser, error) {
	if DB == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	id, err := uuid.Parse(uid)
	if err != nil {
		// Firebase UID is not a UUID (common). Create a deterministic UUID from the UID.
		id = uuid.NewSHA1(uuid.NameSpaceOID, []byte(uid))
	}

	var user AppUser
	row := DB.QueryRow(ctx, `
		INSERT INTO users (id, email, name, role)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (email)
		DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
		RETURNING id, email, name, role, start_date
	`, id, email, name, role)

	var startDate *time.Time
	if err := row.Scan(&user.ID, &user.Email, &user.Name, &user.Role, &startDate); err != nil {
		return nil, err
	}
	user.StartDate = startDate

	return &user, nil
}

func getUserProfileByEmail(ctx context.Context, email string) (*AppUserProfile, error) {
	if DB == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	var out AppUserProfile

	err := DB.QueryRow(ctx, `
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
		WHERE email = $1
		LIMIT 1
	`, email).Scan(
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
		return nil, err
	}

	return &out, nil
}