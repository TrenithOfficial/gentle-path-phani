package main

import (
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// GET  /api/protocols/item-acks  -> list acks for current user
// POST /api/protocols/item-acks  -> save ack for a protocolId (protocols.id)
//
// ADMIN:
// GET /api/admin/users/:id/protocol-item-acks -> list acks for a specific user
//
// NOTE: Your schema.sql has "protocols" but no "protocol_items" table,
// so we ack at the protocol level.
func RegisterProtocolItemAckRoutes(api *gin.RouterGroup) {

	// ---------- CLIENT ----------
	api.GET("/protocols/item-acks", func(c *gin.Context) {
		u, ok := authedUser(c)
		if !ok {
			return
		}

		out, err := loadItemAcks(c, u.ID.String())
		if err != nil {
			log.Printf("protocol_item_acks GET error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "failed to load item acks",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, out)
	})

	api.POST("/protocols/item-acks", func(c *gin.Context) {
		u, ok := authedUser(c)
		if !ok {
			return
		}

		var body struct {
			ProtocolID string `json:"protocolId"`
			ItemID     string `json:"itemId"` // accept either, for backward compatibility with frontend
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}

		// Prefer protocolId, but if frontend still sends itemId, treat it as protocolId.
		protocolID := strings.TrimSpace(body.ProtocolID)
		if protocolID == "" {
			protocolID = strings.TrimSpace(body.ItemID)
		}
		if protocolID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing protocolId"})
			return
		}

		now := time.Now().UTC()

		if err := upsertProtocolAck(c, u.ID.String(), protocolID, now); err != nil {
			// If we used a typed apiError, return its status.
			if ae, ok := err.(*apiError); ok {
				c.JSON(ae.Status, gin.H{"error": ae.Msg})
				return
			}

			log.Printf("protocol_item_acks POST error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "failed to save ack",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"protocolId":  protocolID,
			"confirmedAt": now,
		})
	})

	// ---------- ADMIN ----------
	api.GET("/admin/users/:id/protocol-item-acks", func(c *gin.Context) {
		if !requireAdmin(c) {
			return
		}

		userID := strings.TrimSpace(c.Param("id"))
		if userID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing user id"})
			return
		}

		out, err := loadItemAcks(c, userID)
		if err != nil {
			log.Printf("admin protocol_item_acks GET error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "failed to load item acks",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, out)
	})
}

type ItemAck struct {
	ProtocolID  string     `json:"protocolId"`
	ConfirmedAt *time.Time `json:"confirmedAt"`
}

func loadItemAcks(c *gin.Context, userID string) ([]ItemAck, error) {
	// Prefer protocol_id; fall back to item_id if that’s what the table has.
	rows, err := DB.Query(c.Request.Context(), `
		SELECT protocol_id, confirmed_at
		FROM protocol_item_acks
		WHERE user_id = $1
		ORDER BY confirmed_at DESC NULLS LAST
	`, userID)

	if err != nil {
		// Some schemas may have item_id instead of protocol_id
		if strings.Contains(err.Error(), `column "protocol_id" does not exist`) {
			rows2, err2 := DB.Query(c.Request.Context(), `
				SELECT item_id, confirmed_at
				FROM protocol_item_acks
				WHERE user_id = $1
				ORDER BY confirmed_at DESC NULLS LAST
			`, userID)
			if err2 != nil {
				return nil, err2
			}
			defer rows2.Close()
			return scanAckRows(rows2)
		}
		return nil, err
	}
	defer rows.Close()
	return scanAckRows(rows)
}

func scanAckRows(rows interface {
	Next() bool
	Scan(dest ...any) error
	Close()
	Err() error
}) ([]ItemAck, error) {
	out := make([]ItemAck, 0)
	for rows.Next() {
		var id string
		var confirmedAt *time.Time
		if err := rows.Scan(&id, &confirmedAt); err != nil {
			return nil, err
		}
		out = append(out, ItemAck{ProtocolID: id, ConfirmedAt: confirmedAt})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func upsertProtocolAck(c *gin.Context, userID, protocolID string, now time.Time) error {
	// Validate protocol exists so a bad frontend id returns 400 (not a mysterious 500).
	var exists bool
	err := DB.QueryRow(c.Request.Context(), `
		SELECT EXISTS (SELECT 1 FROM protocols WHERE id = $1)
	`, protocolID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return &apiError{Status: http.StatusBadRequest, Msg: "invalid protocolId"}
	}

	// UPDATE first
	qUpdate := `
		UPDATE protocol_item_acks
		SET confirmed_at = $3
		WHERE user_id = $1 AND protocol_id = $2
	`
	tag, err := DB.Exec(c.Request.Context(), qUpdate, userID, protocolID, now)
	if err != nil {
		return err
	}

	// If nothing updated, INSERT
	if tag.RowsAffected() == 0 {
		qInsert := `
			INSERT INTO protocol_item_acks (user_id, protocol_id, confirmed_at)
			VALUES ($1, $2, $3)
		`
		_, err := DB.Exec(c.Request.Context(), qInsert, userID, protocolID, now)
		return err
	}

	return nil
}

// apiError keeps clean HTTP-ish errors inside helper functions.
type apiError struct {
	Status int
	Msg    string
}

func (e *apiError) Error() string { return e.Msg }
