package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"parking/backend/internal/db"
	"parking/backend/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// CreateSlot creates a new parking slot
func CreateSlot(c *gin.Context) {
	var in models.ParkingSlot
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	in.ID = primitive.NewObjectID()
	in.CreatedAt = time.Now()

	coll := db.Collection("slots")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := coll.InsertOne(ctx, in); err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}
	c.JSON(http.StatusCreated, in)
}

// FindNearby finds nearby parking slots using geospatial query and caches results in Redis
func FindNearby(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	radiusStr := c.DefaultQuery("radius", "1000") // meters

	lat, _ := strconv.ParseFloat(latStr, 64)
	lng, _ := strconv.ParseFloat(lngStr, 64)
	radius, _ := strconv.ParseFloat(radiusStr, 64)

	log.Printf("FindNearby called with lat=%v lng=%v radius=%v", lat, lng, radius)

	// cache key
	key := "nearby:" + latStr + ":" + lngStr + ":" + radiusStr
	if db.RedisClient != nil {
		if v, err := db.RedisClient.Get(c, key).Result(); err == nil {
			var out []models.ParkingSlot
			_ = json.Unmarshal([]byte(v), &out)
			c.JSON(http.StatusOK, out)
			return
		}
	}

	coll := db.Collection("slots")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// GeoJSON point [lng, lat]
	filter := bson.M{
		"location": bson.M{
			"$near": bson.M{
				"$geometry":    bson.M{"type": "Point", "coordinates": []float64{lng, lat}},
				"$maxDistance": radius,
			},
		},
	}
	log.Printf("Mongo filter: %+v", filter)

	cur, err := coll.Find(ctx, filter, options.Find())
	if err != nil {
		// log the full error to server logs for debugging
		log.Printf("coll.Find error: %v", err)
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}
	var out []models.ParkingSlot
	if err := cur.All(ctx, &out); err != nil {
		log.Printf("cursor.All error: %v", err)
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}

	if db.RedisClient != nil {
		b, _ := json.Marshal(out)
		db.RedisClient.Set(c, key, b, 30*time.Second)
	}

	c.JSON(http.StatusOK, out)
}
