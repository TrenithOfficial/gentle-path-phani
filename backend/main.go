package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func parseCorsOrigins() (allowAll bool, origins []string) {
	raw := os.Getenv("CORS_ORIGINS")
	if raw == "" {
		raw = os.Getenv("FRONTEND_ORIGIN")
	}
	if raw == "" {
		raw = "http://localhost:5173,http://localhost:8080"
	}

	parts := strings.Split(raw, ",")
	for _, p := range parts {
		o := strings.TrimSpace(p)
		if o == "" {
			continue
		}
		if o == "*" {
			return true, nil
		}
		if strings.HasPrefix(o, "http://") || strings.HasPrefix(o, "https://") {
			origins = append(origins, o)
			continue
		}
		if strings.HasPrefix(o, "localhost") || strings.HasPrefix(o, "127.0.0.1") {
			origins = append(origins, "http://"+o)
			continue
		}
		log.Printf("CORS warning: skipping invalid origin (must include scheme): %s", o)
	}

	if len(origins) == 0 {
		origins = []string{"http://localhost:5173", "http://localhost:8080"}
	}
	return false, origins
}

func main() {
	_ = godotenv.Load()

	gin.SetMode(gin.ReleaseMode)

	connectDB()
	initFirebase()

	r := gin.Default()

	allowAll, origins := parseCorsOrigins()

	corsCfg := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
	}

	if allowAll {
		corsCfg.AllowAllOrigins = true
	} else {
		corsCfg.AllowOrigins = origins
		corsCfg.AllowOriginFunc = func(origin string) bool {
			if origin == "" {
				return true
			}
			if strings.HasPrefix(origin, "capacitor://localhost") ||
		strings.HasPrefix(origin, "ionic://localhost") ||
		strings.HasPrefix(origin, "http://localhost") ||
		strings.HasPrefix(origin, "https://localhost") ||
		strings.HasPrefix(origin, "http://127.0.0.1") ||
		strings.HasPrefix(origin, "https://127.0.0.1") {
				   return true
			}
			for _, o := range origins {
				if origin == o {
					return true
				}
			}
			return false
		}
	}

	r.Use(cors.New(corsCfg))

	// Upload store
	store, err := newUploadStore()
	if err != nil {
		log.Fatal(err)
	}

	RegisterUploadsRoutes(r, store)

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// 🔍 TEMP DIAGNOSTIC ROUTE — DO NOT REMOVE YET
	r.GET("/__routes", func(c *gin.Context) {
		routes := r.Routes()
		out := []string{}
		for _, rt := range routes {
			out = append(out, rt.Method+" "+rt.Path)
		}
		c.JSON(http.StatusOK, out)
	})

	api := r.Group("/api")
	api.Use(AuthMiddleware())

	RegisterCheckInRoutes(api)
	RegisterAdminCheckInRoutes(api)

	RegisterAdminUserRoutes(api)
	RegisterAdminUserInviteRoutes(api)

	RegisterMessageRoutes(api)
	RegisterAdminMessageRoutes(api)

	RegisterChatRoutes(api)

	RegisterContentRoutes(api)
	RegisterAdminContentRoutes(api)

	RegisterHealingSheetRoutes(api)
	RegisterAdminHealingSheetRoutes(api, store)

	RegisterProtocolRoutes(api)
	RegisterAdminProtocolRoutes(api)

	RegisterProtocolAckRoutes(api)
	RegisterProtocolItemAckRoutes(api)
	RegisterAdminProtocolAckRoutes(api)

	RegisterSupportRoutes(r)

	api.GET("/me", func(c *gin.Context) {
		uid := c.GetString("uid")

		claimsAny, _ := c.Get("claims")
		claims, _ := claimsAny.(map[string]interface{})

		role := "client"
		if v, ok := claims["role"].(string); ok && v != "" {
			role = v
		}

		email := ""
		if v, ok := claims["email"].(string); ok {
			email = v
		}

		name := ""
		if v, ok := claims["name"].(string); ok {
			name = v
		}

		if email == "" {
			u, err := FirebaseAuth.GetUser(c.Request.Context(), uid)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load firebase user"})
				return
			}
			email = u.Email
			name = u.DisplayName
		}

		user, err := upsertUser(c.Request.Context(), uid, email, name, role)
		if err != nil {
			log.Printf("upsertUser failed uid=%s email=%s role=%s err=%v", uid, email, role, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upsert user"})
			return
		}

		c.JSON(http.StatusOK, user)
	})

	// ✅ NEW: client can generate their own password reset link
	api.GET("/me/password-reset-link", func(c *gin.Context) {
		uid := c.GetString("uid")

		claimsAny, _ := c.Get("claims")
		claims, _ := claimsAny.(map[string]interface{})

		email := ""
		if v, ok := claims["email"].(string); ok {
			email = v
		}

		if strings.TrimSpace(email) == "" {
			u, err := FirebaseAuth.GetUser(c.Request.Context(), uid)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load firebase user"})
				return
			}
			email = u.Email
		}

		if strings.TrimSpace(email) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "email missing"})
			return
		}

		link, err := generatePasswordResetLinkAdminSDK(c, email)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "failed to generate reset link",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"email":     email,
			"resetLink": link,
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
