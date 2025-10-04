package main

import (
	"log"

	"smart-parking/config"
	"smart-parking/database"
	"smart-parking/routes"

	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Load Configuration (from .env or environment)
	cfg := config.LoadConfig()

	// Check for critical configuration
	if cfg.ServerPort == "" || cfg.MongoURI == "" || cfg.JWTSecret == "" || cfg.RedisAddr == "" {
		log.Fatal("Critical configuration missing. Ensure SERVER_PORT, MONGO_URI, JWT_SECRET, and REDIS_ADDR are set.")
	}


	// 2. Initialize Database Connections
	database.InitMongoDB(cfg)
	database.InitRedis(cfg)

	// 3. Setup Gin Router
	r := gin.Default()

	// 4. Register Routes
	routes.SetupRoutes(r, cfg)

	// 5. Start the Server
	log.Printf("Starting server on port %s", cfg.ServerPort)
	if err := r.Run(":" + cfg.ServerPort); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}