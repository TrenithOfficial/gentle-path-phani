package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var DB *pgxpool.Pool

func connectDB() {
	user := os.Getenv("DB_USER")
	pass := os.Getenv("DB_PASSWORD")
	host := os.Getenv("DB_HOST") // can be "127.0.0.1" OR "/cloudsql/PROJECT:REGION:INSTANCE"
	port := os.Getenv("DB_PORT")
	name := os.Getenv("DB_NAME")

	// If any required env is missing, don't crash the container.
	// (Routes that require DB will error clearly.)
	if user == "" || pass == "" || host == "" || port == "" || name == "" {
		log.Printf("DB init warning: missing env vars (DB_USER/DB_PASSWORD/DB_HOST/DB_PORT/DB_NAME). DB disabled.")
		return
	}

	sslmode := os.Getenv("DB_SSLMODE")
	if sslmode == "" {
		// For Cloud SQL unix socket, sslmode isn't needed. For TCP, you may want "require".
		sslmode = "disable"
	}

	// Cloud SQL unix socket support:
	// If DB_HOST starts with "/", treat it as a unix socket directory and use keyword DSN
	// Example: host=/cloudsql/PROJECT:REGION:INSTANCE port=5432 user=... password=... dbname=...
	var dsn string
	if strings.HasPrefix(host, "/") {
		dsn = fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
			host, port, user, pass, name, sslmode,
		)
	} else {
		// Normal TCP connection URL
		dsn = fmt.Sprintf(
			"postgres://%s:%s@%s:%s/%s?sslmode=%s",
			user, pass, host, port, name, sslmode,
		)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Printf("DB init warning: DB connection failed: %v", err)
		return
	}

	if err := pool.Ping(ctx); err != nil {
		log.Printf("DB init warning: DB ping failed: %v", err)
		return
	}

	DB = pool
	log.Println("Connected to database")
}
