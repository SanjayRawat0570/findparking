package db

import (
    "context"
    "fmt"
    "os"
    "time"

    "go.mongodb.org/mongo-driver/mongo"
    "go.mongodb.org/mongo-driver/mongo/options"
)

var MongoClient *mongo.Client
var Database *mongo.Database

func InitMongo(ctx context.Context) error {
    uri := os.Getenv("MONGO_URI")
    if uri == "" {
        uri = "mongodb://localhost:27017"
    }

    client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
    if err != nil {
        return err
    }

    // ping
    cctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()
    if err := client.Ping(cctx, nil); err != nil {
        return fmt.Errorf("mongo ping: %w", err)
    }

    MongoClient = client
    dbName := os.Getenv("MONGO_DB")
    if dbName == "" {
        dbName = "parking"
    }
    Database = client.Database(dbName)
    return nil
}

func Collection(name string) *mongo.Collection {
    return Database.Collection(name)
}
