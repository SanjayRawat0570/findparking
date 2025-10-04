package database

import (
	"context"
	"log"

	"smart-parking/config"

	"github.com/go-redis/redis/v8"
)

var RedisClient *redis.Client

// InitRedis establishes a connection to Redis
func InitRedis(cfg *config.Config) {
	// FIX: Use the password provided in the configuration
	RedisClient = redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword, // <-- Now uses the password from .env
		DB:       0, // use default DB
	})

	ctx := context.Background()
	// You might need to authenticate here if your Redis server requires a password
	_, err := RedisClient.Ping(ctx).Result()
	if err != nil {
		// Log the error detail if the connection fails (often due to wrong password or address)
		log.Fatalf("Could not connect to Redis: %v", err)
	}

	log.Println("Successfully connected to Redis.")
}