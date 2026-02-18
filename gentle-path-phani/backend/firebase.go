package main

import (
	"context"
	"log"
	"os"
	"strings"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)

var FirebaseAuth *auth.Client

func initFirebase() {
	// Option A: FIREBASE_ADMIN_JSON contains the raw service account JSON
	// Option B: FIREBASE_ADMIN_CREDENTIALS contains a file path to the JSON
	jsonCreds := os.Getenv("FIREBASE_ADMIN_JSON")
	credPath := os.Getenv("FIREBASE_ADMIN_CREDENTIALS")

	var opts []option.ClientOption

	if strings.TrimSpace(jsonCreds) != "" {
		opts = append(opts, option.WithCredentialsJSON([]byte(jsonCreds)))
	} else if strings.TrimSpace(credPath) != "" {
		opts = append(opts, option.WithCredentialsFile(credPath))
	} else {
		// Don’t crash the container. But auth-protected routes will fail until you set it.
		log.Println("Firebase init warning: no firebase admin creds set (set FIREBASE_ADMIN_JSON or FIREBASE_ADMIN_CREDENTIALS)")
		FirebaseAuth = nil
		return
	}

	app, err := firebase.NewApp(context.Background(), nil, opts...)
	if err != nil {
		log.Printf("Firebase init warning: firebase init failed: %v", err)
		FirebaseAuth = nil
		return
	}

	client, err := app.Auth(context.Background())
	if err != nil {
		log.Printf("Firebase init warning: firebase auth client failed: %v", err)
		FirebaseAuth = nil
		return
	}

	FirebaseAuth = client
	log.Println("Firebase admin initialized")
}
