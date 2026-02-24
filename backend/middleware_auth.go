package main

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {

		if c.Request.Method == "OPTIONS" {
      c.AbortWithStatus(204)
      return
    }
		// ✅ Prevent Cloud Run panic when Firebase admin isn't initialized
		if FirebaseAuth == nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error": "firebase admin not configured on server",
			})
			return
		}

		h := c.GetHeader("Authorization")
		if h == "" || !strings.HasPrefix(h, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "missing bearer token",
			})
			return
		}

		idToken := strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))

		// Important: checks revoked tokens too
		tok, err := FirebaseAuth.VerifyIDTokenAndCheckRevoked(c.Request.Context(), idToken)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid token",
			})
			return
		}

		c.Set("uid", tok.UID)
		c.Set("claims", tok.Claims)
		c.Next()
	}
}
