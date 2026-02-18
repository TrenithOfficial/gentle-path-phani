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
