package routes

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"parking/backend/internal/db"
	"parking/backend/internal/handlers"
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
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

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
		slots.POST("/", handlers.CreateSlot) // should be protected for admins in real app
		slots.GET("/nearby", handlers.FindNearby)
	}

	return r
}
