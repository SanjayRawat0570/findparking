package main

import (
	"context"
	"log"
	"os"
	"time"

	"parking/backend/internal/db"
	"parking/backend/internal/routes"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/joho/godotenv"
)

func main() {
	// load env
	_ = godotenv.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// init dbs
	if err := db.InitMongo(ctx); err != nil {
		log.Fatalf("mongo init: %v", err)
	}
	if err := db.InitRedis(); err != nil {
		log.Fatalf("redis init: %v", err)
	}

	// Ensure 2dsphere index exists for slots.location so geospatial queries work
	coll := db.Collection("slots")
	idxCtx, idxCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer idxCancel()
	indexModel := mongo.IndexModel{Keys: bson.D{{Key: "location", Value: "2dsphere"}}}
	if _, err := coll.Indexes().CreateOne(idxCtx, indexModel); err != nil {
		// log but do not fail startup
		log.Printf("warning: could not create 2dsphere index: %v", err)
	}

	router := routes.SetupRouter()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("starting server on :%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
