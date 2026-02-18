package main

import (
	"context"

	"github.com/google/uuid"
)

// UserIDFromFirebaseUID maps a Firebase UID to our DB users.id
func UserIDFromFirebaseUID(firebaseUID string) uuid.UUID {
	var id uuid.UUID

	_ = DB.QueryRow(
		context.Background(),
		`SELECT id FROM users WHERE firebase_uid = $1`,
		firebaseUID,
	).Scan(&id)

	return id
}
