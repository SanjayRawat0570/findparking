package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"smart-parking/config"
	"smart-parking/database"
	"smart-parking/models"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"go.mongodb.org/mongo-driver/bson"
)

// ParkingHandler holds the dependencies for parking logic
type ParkingHandler struct {
	Cfg *config.Config
}

const redisKey = "all_parking_slots"
const cacheTTL = 30 * time.Second // Parking data typically has a short Time-To-Live (TTL)

// GetParkingSlots fetches parking data, prioritizing Redis cache for speed.
// This supports components like parking-map.tsx.
func (h *ParkingHandler) GetParkingSlots(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Try to retrieve data from Redis
	cachedData, err := database.RedisClient.Get(ctx, redisKey).Result()

	if err == nil {
		// Cache Hit! Respond immediately with cached data
		var slots []models.ParkingSlot
		if json.Unmarshal([]byte(cachedData), &slots) == nil {
			c.JSON(http.StatusOK, gin.H{"source": "cache", "data": slots})
			return
		}
		log.Printf("Error unmarshalling cached data: %v", err)
	} else if err != redis.Nil {
		log.Printf("Redis error (not cache miss): %v", err)
	}

	// 2. Cache Miss or Redis Error: Fetch from MongoDB (Source of Truth)
	collection := database.GetParkingCollection(h.Cfg)
	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		log.Printf("MongoDB error fetching parking slots: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve parking data"})
		return
	}
	defer cursor.Close(ctx)

	var parkingSlots []models.ParkingSlot
	if err = cursor.All(ctx, &parkingSlots); err != nil {
		log.Printf("MongoDB error decoding parking slots: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process parking data"})
		return
	}

	// 3. Update Redis cache asynchronously
	if len(parkingSlots) > 0 {
		jsonData, _ := json.Marshal(parkingSlots)
		// Set the data in Redis with the defined TTL
		err = database.RedisClient.Set(ctx, redisKey, jsonData, cacheTTL).Err()
		if err != nil {
			log.Printf("Error setting data in Redis: %v", err)
		} else {
			log.Println("Cache updated successfully.")
		}
	}

	// 4. Respond with data from MongoDB
	c.JSON(http.StatusOK, gin.H{"source": "database", "data": parkingSlots})
}

// CreateParkingSlot handles creation of new parking slots (Admin only)
// This supports components/admin/slot-management.tsx
func (h *ParkingHandler) CreateParkingSlot(c *gin.Context) {
	var newSlot models.ParkingSlot
	if err := c.ShouldBindJSON(&newSlot); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := database.GetParkingCollection(h.Cfg)
	
	// Insert the new slot into MongoDB
	result, err := collection.InsertOne(ctx, newSlot)
	if err != nil {
		log.Printf("MongoDB error during parking slot creation: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create parking slot"})
		return
	}

	// Invalidate the cache since the source of truth has changed
	database.RedisClient.Del(context.Background(), redisKey)
	log.Println("Parking slots cache invalidated due to new slot creation.")


	c.JSON(http.StatusCreated, gin.H{
		"message": "Parking slot created successfully",
		"id":      result.InsertedID,
		"slot":    newSlot,
	})
}