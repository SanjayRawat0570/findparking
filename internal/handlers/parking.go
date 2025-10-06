package handlers

import (
	"context"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"parking/backend/internal/bcast"
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
	// basic validation: ensure required fields are present
	if strings.TrimSpace(in.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	if strings.TrimSpace(in.Address) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "address is required"})
		return
	}
	if in.Total <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "total must be > 0"})
		return
	}
	// normalize available: if not provided or invalid, set to total; cap at total
	if in.Available <= 0 {
		in.Available = in.Total
	}
	if in.Available > in.Total {
		in.Available = in.Total
	}

	in.ID = primitive.NewObjectID()
	in.CreatedAt = time.Now()

	// make sure Location coordinates are in [lng, lat] order for GeoJSON
	if len(in.Location.Coordinates) == 2 {
		// Incoming coordinate order may be either [lat, lng] or [lng, lat].
		// Detect likely order by value ranges: lat is in [-90,90], lng in [-180,180].
		a := in.Location.Coordinates[0]
		b := in.Location.Coordinates[1]
		var lng, lat float64
		if a >= -90 && a <= 90 && b >= -180 && b <= 180 {
			// a looks like latitude -> input is [lat, lng]
			lat = a
			lng = b
		} else {
			// assume input is [lng, lat]
			lng = a
			lat = b
		}

		// normalize longitude into [-180,180] to tolerate wrapped values (e.g., -280 -> 80)
		norm := math.Mod(lng+180.0, 360.0)
		if norm < 0 {
			norm += 360.0
		}
		lng = norm - 180.0

		// validate ranges now
		if lat < -90 || lat > 90 || lng < -180 || lng > 180 {
			log.Printf("invalid coordinates received: lat=%v lng=%v", lat, lng)
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid coordinates"})
			return
		}

		in.Location.Type = "Point"
		in.Location.Coordinates = []float64{lng, lat}
	}

	coll := db.Collection("slots")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := coll.InsertOne(ctx, in); err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}
	// Return created slot with string id for easier client consumption
	resp := gin.H{
		"id":         in.ID.Hex(),
		"name":       in.Name,
		"address":    in.Address,
		"total":      in.Total,
		"available":  in.Available,
		"location":   in.Location,
		"status":     in.Status,
		"price":      in.Price,
		"created_at": in.CreatedAt,
	}
	c.JSON(http.StatusCreated, resp)

	// broadcast created slot to connected clients (SSE) and Redis pubsub
	go func() {
		// lightweight event struct
		evt := map[string]interface{}{
			"type": "slot.created",
			"data": resp,
		}
		// best-effort
		bcast.Broadcast(evt)
	}()
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

// UpdateSlot updates fields of a parking slot (e.g., available, total, price, status)
func UpdateSlot(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing id"})
		return
	}
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	coll := db.Collection("slots")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// build update document
	updateDoc := bson.M{"$set": updates}
	res, err := coll.UpdateByID(ctx, oid, updateDoc)
	if err != nil || res.MatchedCount == 0 {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error or not found"})
		return
	}

	// fetch updated doc
	var updated models.ParkingSlot
	if err := coll.FindOne(ctx, bson.M{"_id": oid}).Decode(&updated); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch updated slot"})
		return
	}

	// prepare resp and broadcast updated slot
	resp := gin.H{
		"id":         updated.ID.Hex(),
		"name":       updated.Name,
		"address":    updated.Address,
		"total":      updated.Total,
		"available":  updated.Available,
		"location":   updated.Location,
		"status":     updated.Status,
		"price":      updated.Price,
		"created_at": updated.CreatedAt,
	}

	c.JSON(http.StatusOK, resp)

	go func() {
		evt := map[string]interface{}{
			"type": "slot.updated",
			"data": resp,
		}
		bcast.Broadcast(evt)
	}()
}

// GetAllSlots returns all parking slots (no geospatial filtering)
func GetAllSlots(c *gin.Context) {
	coll := db.Collection("slots")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cur, err := coll.Find(ctx, bson.M{}, options.Find())
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}
	var out []models.ParkingSlot
	if err := cur.All(ctx, &out); err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}
	c.JSON(http.StatusOK, out)
}

// GetSlot returns a single parking slot by its id
func GetSlot(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing id"})
		return
	}
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	coll := db.Collection("slots")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var slot models.ParkingSlot
	if err := coll.FindOne(ctx, bson.M{"_id": oid}).Decode(&slot); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "slot not found"})
		return
	}

	resp := gin.H{
		"id":         slot.ID.Hex(),
		"name":       slot.Name,
		"address":    slot.Address,
		"total":      slot.Total,
		"available":  slot.Available,
		"location":   slot.Location,
		"status":     slot.Status,
		"price":      slot.Price,
		"created_at": slot.CreatedAt,
	}
	c.JSON(http.StatusOK, resp)
}
