package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"smart-parking/config"
	"smart-parking/database"
	"smart-parking/models"
	"smart-parking/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type AuthHandler struct {
	Cfg *config.Config
}

// Signup
func (h *AuthHandler) Signup(c *gin.Context) {
	var req models.SignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	collection := database.GetUserCollection(h.Cfg)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// check if user exists
	var existing models.User
	err := collection.FindOne(ctx, bson.M{"email": req.Email}).Decode(&existing)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
		return
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		log.Println("DB error:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// hash password
	hashed, err := utils.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not hash password"})
		return
	}

	// create new user
	user := models.User{
		ID:       primitive.NewObjectID(),
		Email:    req.Email,
		Password: hashed,
		IsAdmin:  false,
	}

	_, err = collection.InsertOne(ctx, user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not create user"})
		return
	}

	// generate JWT
	token, err := utils.GenerateJWT(user.Email, user.IsAdmin, h.Cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Token generation failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"email": user.Email,
		"role":  "user",
		"token": token,
	})
}

// Login
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	collection := database.GetUserCollection(h.Cfg)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// find user
	var user models.User
	err := collection.FindOne(ctx, bson.M{"email": req.Email}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}
	if err != nil {
		log.Println("DB error:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// check password
	if !utils.CheckPasswordHash(req.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// token
	token, err := utils.GenerateJWT(user.Email, user.IsAdmin, h.Cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Token generation failed"})
		return
	}

	role := "user"
	if user.IsAdmin {
		role = "admin"
	}

	c.JSON(http.StatusOK, gin.H{
		"email": user.Email,
		"role":  role,
		"token": token,
	})
}



