package middleware

import (
	"context"
	"fmt"
	"net/http"
	"parking/backend/internal/db"
	"parking/backend/internal/models"
	"parking/backend/internal/utils"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// RequireAdmin is a middleware that ensures the request has a valid JWT and the user has role "admin".
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		var token string
		if auth != "" {
			if _, err := fmt.Sscanf(auth, "Bearer %s", &token); err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid auth header"})
				c.Abort()
				return
			}
		} else {
			// fallback: check query param `token` (used by EventSource clients)
			token = c.Query("token")
			if token == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "missing auth"})
				c.Abort()
				return
			}
		}
		uid, err := utils.ParseToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}
		coll := db.Collection("users")
		var u models.User
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		oid, err := primitive.ObjectIDFromHex(uid)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id"})
			c.Abort()
			return
		}
		if err := coll.FindOne(ctx, bson.M{"_id": oid}).Decode(&u); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
			c.Abort()
			return
		}
		if u.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "admin required"})
			c.Abort()
			return
		}
		// store user in context for downstream handlers if needed
		c.Set("user", u)
		c.Next()
	}
}

// RequireAuth ensures the request has a valid JWT and sets the user in context.
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		var token string
		if auth != "" {
			if _, err := fmt.Sscanf(auth, "Bearer %s", &token); err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid auth header"})
				c.Abort()
				return
			}
		} else {
			// fallback: check query param `token` (used by EventSource clients)
			token = c.Query("token")
			if token == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "missing auth"})
				c.Abort()
				return
			}
		}
		uid, err := utils.ParseToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}
		coll := db.Collection("users")
		var u models.User
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		oid, err := primitive.ObjectIDFromHex(uid)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id"})
			c.Abort()
			return
		}
		if err := coll.FindOne(ctx, bson.M{"_id": oid}).Decode(&u); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
			c.Abort()
			return
		}
		// set user in context
		c.Set("user", u)
		c.Next()
	}
}
