package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"parking/backend/internal/bcast"
	"parking/backend/internal/db"
	"parking/backend/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// CreateBooking attempts to create a booking for the given slot id and the authenticated user.
// It atomically decrements available if > 0 and returns the created booking and updated slot.
func CreateBooking(c *gin.Context) {
	var in struct {
		SlotID string `json:"slot_id" binding:"required"`
		// optional payment metadata
		TransactionID string `json:"transaction_id"`
		Paid          bool   `json:"paid"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// get user from context (set by RequireAuth)
	ui, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user"})
		return
	}
	user := ui.(models.User)

	oid, err := primitive.ObjectIDFromHex(in.SlotID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid slot id"})
		return
	}

	coll := db.Collection("slots")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Atomically decrement available if available > 0
	// First, check that the slot exists and current availability
	var current models.ParkingSlot
	if err := coll.FindOne(ctx, bson.M{"_id": oid}).Decode(&current); err != nil {
		// not found
		c.JSON(http.StatusNotFound, gin.H{"error": "slot not found"})
		return
	}
	if current.Available <= 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "slot not available"})
		return
	}

	filter := bson.M{"_id": oid, "available": bson.M{"$gt": 0}}
	update := bson.M{"$inc": bson.M{"available": -1}}
	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)

	var updated models.ParkingSlot
	if err := coll.FindOneAndUpdate(ctx, filter, update, opts).Decode(&updated); err != nil {
		// This can happen if availability changed between the check and update
		c.Error(err)
		c.JSON(http.StatusConflict, gin.H{"error": "failed to reserve slot - possibly no availability"})
		return
	}

	// create booking record
	bookingsColl := db.Collection("bookings")
	booking := models.Booking{
		ID:            primitive.NewObjectID(),
		UserID:        user.ID,
		SlotID:        oid,
		CreatedAt:     time.Now(),
		TransactionID: in.TransactionID,
		Paid:          in.Paid,
	}
	if _, err := bookingsColl.InsertOne(ctx, booking); err != nil {
		// attempt to roll back the decrement
		coll.UpdateByID(ctx, oid, bson.M{"$inc": bson.M{"available": 1}})
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create booking"})
		return
	}

	// prepare and return response with updated slot and booking id
	respSlot := gin.H{
		"id":         updated.ID.Hex(),
		"name":       updated.Name,
		"address":    updated.Address,
		"total":      updated.Total,
		"available":  updated.Available,
		"location":   updated.Location,
		"status":     updated.Status,
		"price":      updated.Price,
		"price_unit": updated.PriceUnit,
		"created_at": updated.CreatedAt,
	}
	resp := gin.H{"booking_id": booking.ID.Hex(), "slot": respSlot}
	c.JSON(http.StatusCreated, resp)

	// broadcast slot.updated
	go func() {
		evt := map[string]interface{}{"type": "slot.updated", "data": respSlot}
		bcast.Broadcast(evt)
	}()

	// persist updated slot state to Redis for fast reads and cross-instance availability
	if db.RedisClient != nil {
		if b, err := json.Marshal(respSlot); err == nil {
			// set a key with the full slot JSON
			_ = db.RedisClient.Set(ctx, "slot:"+updated.ID.Hex(), b, 0).Err()
			// also set a simple availability key for quick numeric reads
			_ = db.RedisClient.Set(ctx, "slot:"+updated.ID.Hex()+":available", strconv.Itoa(updated.Available), 0).Err()
		}
	}

	// increment Redis booking counters for peak-hour prediction and recent activity
	if db.RedisClient != nil {
		hour := time.Now().Hour()
		hourKey := fmt.Sprintf("slot:%s:bookings:hour:%02d", updated.ID.Hex(), hour)
		_ = db.RedisClient.Incr(ctx, hourKey).Err()
		// keep per-hour counters for 7 days
		_ = db.RedisClient.Expire(ctx, hourKey, 7*24*time.Hour).Err()

		recentKey := fmt.Sprintf("slot:%s:bookings:recent", updated.ID.Hex())
		_ = db.RedisClient.Incr(ctx, recentKey).Err()
		// recent count expires after 24 hours
		_ = db.RedisClient.Expire(ctx, recentKey, 24*time.Hour).Err()
	}
}
