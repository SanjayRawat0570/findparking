package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

// Config struct holds all environment variables
type Config struct {
	ServerPort    string
	MongoURI      string
	MongoDBName   string
	RedisAddr     string
	RedisPassword string
	JWTSecret     string
}

// LoadConfig reads configuration from the .env file or environment variables
func LoadConfig() *Config {
	// 1. Explicitly load the .env file. This solves the MINGW64 hidden file issue.
	err := godotenv.Load(".env") 
	if err != nil {
		log.Printf("Note: .env file not found or could not be loaded, loading from system environment variables. Error: %v", err)
	}

	cfg := &Config{
		ServerPort:    os.Getenv("SERVER_PORT"),
		MongoURI:      os.Getenv("MONGO_URI"),
		MongoDBName:   os.Getenv("MONGO_DB_NAME"),
		RedisAddr:     os.Getenv("REDIS_ADDR"),
		RedisPassword: os.Getenv("REDIS_PASSWORD"),
		JWTSecret:     os.Getenv("JWT_SECRET"),
	}

	// 2. Critical Configuration Check
	if cfg.ServerPort == "" || cfg.MongoURI == "" || cfg.JWTSecret == "" || cfg.RedisAddr == "" {
		log.Fatal("Critical configuration missing. Ensure SERVER_PORT, MONGO_URI, JWT_SECRET, and REDIS_ADDR are set.")
	}

	return cfg
}