package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type User struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Email     string             `bson:"email" json:"email"`
	Password  string             `bson:"password" json:"-"`
	Name      string             `bson:"name" json:"name"`
	Role      string             `bson:"role" json:"role"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}

type Location struct {
	Type        string    `bson:"type" json:"type"`
	Coordinates []float64 `bson:"coordinates" json:"coordinates"`
}

type ParkingSlot struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name        string             `bson:"name" json:"name"`
	Description string             `bson:"description" json:"description"`
	Address     string             `bson:"address" json:"address"`
	Total       int                `bson:"total" json:"total"`
	Available   int                `bson:"available" json:"available"`
	Location    Location           `bson:"location" json:"location"`
	Status      string             `bson:"status" json:"status"`
	Price       float64            `bson:"price" json:"price"`
	PriceUnit   string             `bson:"price_unit" json:"priceUnit"`
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
}

// Booking represents a user booking of a parking slot
type Booking struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    primitive.ObjectID `bson:"user_id" json:"user_id"`
	SlotID    primitive.ObjectID `bson:"slot_id" json:"slot_id"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	// payment info
	TransactionID string `bson:"transaction_id,omitempty" json:"transaction_id,omitempty"`
	Paid          bool   `bson:"paid" json:"paid"`
}
