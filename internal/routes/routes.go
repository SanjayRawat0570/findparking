package routes

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"parking/backend/internal/bcast"
	"parking/backend/internal/db"
	"parking/backend/internal/handlers"
	"parking/backend/internal/middleware"
	"parking/backend/internal/models"
	"parking/backend/internal/utils"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()

	// Basic CORS allowing frontend dev origin; adjust for production
	// If env var CORS_ALLOW_ALL=1 is set, allow all origins (dev convenience)
	allowAll := false
	if v := os.Getenv("CORS_ALLOW_ALL"); v == "1" || v == "true" {
		allowAll = true
	}
	corsConfig := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}
	if allowAll {
		// Allow any origin in dev. When AllowCredentials is true browsers will ignore a wildcard,
		// so set an AllowOriginFunc that returns true for all origins.
		corsConfig.AllowOriginFunc = func(origin string) bool { return true }
	} else {
		corsConfig.AllowOrigins = []string{"http://localhost:3000"}
	}
	r.Use(cors.New(corsConfig))

	// simple health endpoint for quick checks
	r.GET("/health", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		status := gin.H{"ok": true}
		if db.MongoClient != nil {
			if err := db.MongoClient.Ping(ctx, nil); err != nil {
				status["mongo"] = err.Error()
				status["ok"] = false
			} else {
				status["mongo"] = "ok"
			}
		} else {
			status["mongo"] = "disabled"
		}
		if db.RedisClient != nil {
			if err := db.RedisClient.Ping(ctx).Err(); err != nil {
				status["redis"] = err.Error()
				status["ok"] = false
			} else {
				status["redis"] = "ok"
			}
		} else {
			status["redis"] = "disabled"
		}
		c.JSON(http.StatusOK, status)
	})

	api := r.Group("/api")
	{
		api.POST("/signup", handlers.Signup)
		api.POST("/login", handlers.Login)
		api.GET("/me", func(c *gin.Context) {
			auth := c.GetHeader("Authorization")
			if auth == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "missing auth"})
				return
			}
			// expect Bearer <token>
			var token string
			if n, _ := fmt.Sscanf(auth, "Bearer %s", &token); n != 1 {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid auth header"})
				return
			}
			uid, err := utils.ParseToken(token)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
				return
			}
			// fetch user
			coll := db.Collection("users")
			var u models.User
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			oid, _ := primitive.ObjectIDFromHex(uid)
			if err := coll.FindOne(ctx, bson.M{"_id": oid}).Decode(&u); err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"user": u})
		})

		slots := api.Group("/slots")
		// protect creation with admin middleware
		slots.POST("/", middleware.RequireAdmin(), handlers.CreateSlot)
		// stream slot events (SSE) - require authenticated user to subscribe
		slots.GET("/stream", middleware.RequireAuth(), func(c *gin.Context) {
			// hijack to standard net/http handler
			bcast.ServeSSE(c.Writer, c.Request)
		})
		// update slot (e.g., adjust availability) - authenticated
		slots.PATCH("/:id", middleware.RequireAuth(), handlers.UpdateSlot)
		// fetch single slot by id
		slots.GET("/:id", handlers.GetSlot)
		slots.GET("/", handlers.GetAllSlots)
		slots.GET("/nearby", handlers.FindNearby)

		// bookings: users can create bookings
		bookings := api.Group("/bookings")
		bookings.POST("/", middleware.RequireAuth(), handlers.CreateBooking)

		// payments (simulated)
		payments := api.Group("/payments")
		payments.POST("/create", handlers.CreatePayment)
		payments.GET("/status", handlers.PaymentStatus)
		// mock endpoint that simulates visiting the payment URL (scanned QR)
		payments.GET("/mockpay", handlers.MockPay)
	}

	return r
}
