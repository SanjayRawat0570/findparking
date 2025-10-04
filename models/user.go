package models

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// User represents a user account stored in MongoDB.
type User struct {
	ID       primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Email    string             `bson:"email" json:"email" binding:"required,email"`
	Password string             `bson:"password" json:"password" binding:"required"` // Hashed password
	IsAdmin  bool               `bson:"is_admin" json:"is_admin"` 
}

// LoginRequest defines the structure for incoming login requests
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// SignupRequest defines the structure for incoming signup requests
type SignupRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// AuthResponse defines the structure for the response after successful login/signup
type AuthResponse struct {
	Token string `json:"token"`
	Email string `json:"email"`
	Role  string `json:"role"` // Add role here to send admin/user info to frontend
}
