package database

import (
	"context"
	"log"
	"time"

	"smart-parking/config"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

var MongoClient *mongo.Client

// InitMongoDB establishes a connection to MongoDB
func InitMongoDB(cfg *config.Config) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		log.Fatal("Failed to connect to MongoDB:", err)
	}

	// Ping the primary to ensure connection is live
	if err = client.Ping(ctx, readpref.Primary()); err != nil {
		log.Fatal("Failed to ping MongoDB:", err)
	}

	MongoClient = client
	log.Println("Successfully connected to MongoDB.")
}

// GetUserCollection returns the 'users' collection instance
func GetUserCollection(cfg *config.Config) *mongo.Collection {
	return MongoClient.Database(cfg.MongoDBName).Collection("users")
}

// GetParkingCollection returns the 'parking_slots' collection instance (Source of truth)
func GetParkingCollection(cfg *config.Config) *mongo.Collection {
	return MongoClient.Database(cfg.MongoDBName).Collection("parking_slots")
}
