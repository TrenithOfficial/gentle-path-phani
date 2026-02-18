package main

import (
	"time"

	"github.com/google/uuid"
)

type AdminUserRow struct {
	ID        uuid.UUID  `json:"id"`
	Email     string     `json:"email"`
	Name      string     `json:"name,omitempty"`
	Role      string     `json:"role"`
	StartDate *time.Time `json:"startDate,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
}

// Used for Edit modal prefilling
type AdminUserDetailRow struct {
	ID        uuid.UUID  `json:"id"`
	Email     string     `json:"email"`
	Name      string     `json:"name"`
	Role      string     `json:"role"`
	StartDate *time.Time `json:"startDate"`
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

type AdminCreateUserRequest struct {
	Email     string `json:"email"`
	Name      string `json:"name"`
	StartDate string `json:"startDate"` // optional: "YYYY-MM-DD"
	Active    *bool  `json:"active"`    // optional: defaults true

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

type AdminUpdateUserRequest struct {
	Email  *string `json:"email"`
	Name   *string `json:"name"`
	Active *bool   `json:"active"`

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
