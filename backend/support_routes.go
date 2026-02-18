package main

import (
	"fmt"
	"net/http"
	"net/smtp"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

type SupportContactRequest struct {
	Subject   string `json:"subject"`
	Message   string `json:"message"`
	FromEmail string `json:"fromEmail,omitempty"`
}

func RegisterSupportRoutes(r *gin.Engine) {
	r.POST("/support/contact", func(c *gin.Context) {
		var req SupportContactRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON body"})
			return
		}

		req.Subject = strings.TrimSpace(req.Subject)
		req.Message = strings.TrimSpace(req.Message)
		req.FromEmail = strings.TrimSpace(req.FromEmail)

		if req.Subject == "" || req.Message == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "subject and message are required"})
			return
		}

		to := os.Getenv("SUPPORT_TO_EMAIL")
		if to == "" {
			to = "cloud.backend26@gmail.com"
		}

		host := os.Getenv("SUPPORT_SMTP_HOST") // smtp.gmail.com
		port := os.Getenv("SUPPORT_SMTP_PORT") // 587
		user := os.Getenv("SUPPORT_SMTP_USER") // your gmail
		pass := os.Getenv("SUPPORT_SMTP_PASS") // app password

		if host == "" || port == "" || user == "" || pass == "" {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "support email not configured on server (missing SUPPORT_SMTP_* env vars)",
			})
			return
		}

		from := os.Getenv("SUPPORT_FROM_EMAIL")
		if from == "" {
			from = user
		}

		body := req.Message
		if req.FromEmail != "" {
			body = fmt.Sprintf("From: %s\n\n%s", req.FromEmail, req.Message)
		}

		msg := strings.Join([]string{
			fmt.Sprintf("From: %s", from),
			fmt.Sprintf("To: %s", to),
			fmt.Sprintf("Subject: %s", req.Subject),
			"MIME-Version: 1.0",
			"Content-Type: text/plain; charset=UTF-8",
			"",
			body,
			"",
		}, "\r\n")

		addr := host + ":" + port
		auth := smtp.PlainAuth("", user, pass, host)

		if err := smtp.SendMail(addr, auth, from, []string{to}, []byte(msg)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "failed to send support email",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
}
