package middleware

import (
	"errors" // <-- NEW: Added import for standard error creation
	"log"
	"net/http"
	"strings"

	"smart-parking/config"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// AuthMiddleware validates the JWT token from the Authorization header
func AuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		// Check for "Bearer " prefix
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format. Must be 'Bearer [token]'"})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Parse and validate token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Validate the signing method is HMAC, which we expect
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				// FIX: Returning a standard error instead of the deprecated jwt.NewError
				return nil, errors.New("unexpected signing method")
			}
			return []byte(cfg.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			log.Printf("JWT Validation Error: %v", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Extract and set claims to the context for handler use
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Set("user_email", claims["email"])
			
			// Safely extract isAdmin status
			isAdmin := false
			if adminClaim, ok := claims["is_admin"].(bool); ok {
				isAdmin = adminClaim
			}
			c.Set("is_admin", isAdmin)
		}

		c.Next()
	}
}

// AdminAuthMiddleware validates the JWT token and checks for admin status
func AdminAuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		AuthMiddleware(cfg)(c) // Run standard authentication first

		// If AuthMiddleware aborted (token invalid), this will not run.
		if c.IsAborted() {
			return
		}

		// Check admin status from context set by AuthMiddleware
		isAdmin, exists := c.Get("is_admin")
		// Check if the value exists and is explicitly true
		if !exists || isAdmin != true {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: Admin privileges required"})
			c.Abort()
			return
		}

		c.Next()
	}
}