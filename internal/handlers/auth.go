package handlers

import (
	"context"
	"net/http"
	"os"
	"time"

	"parking/backend/internal/db"
	"parking/backend/internal/models"
	"parking/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func Signup(c *gin.Context) {
	var in struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
		Name     string `json:"name" binding:"required"`
		Role     string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	coll := db.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// check existing
	var ex models.User
	if err := coll.FindOne(ctx, bson.M{"email": in.Email}).Decode(&ex); err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email already in use"})
		return
	}

	hash, err := utils.HashPassword(in.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash"})
		return
	}

	u := models.User{
		ID:        primitive.NewObjectID(),
		Email:     in.Email,
		Password:  hash,
		Name:      in.Name,
		Role:      in.Role,
		CreatedAt: time.Now(),
	}

	if _, err := coll.InsertOne(ctx, u); err != nil {
		// log the underlying DB error for debugging
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}

	token, _ := utils.CreateToken(u.ID.Hex())
	c.JSON(http.StatusCreated, gin.H{"token": token})
}

func Login(c *gin.Context) {
	var in struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	coll := db.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var u models.User
	if err := coll.FindOne(ctx, bson.M{"email": in.Email}).Decode(&u); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid creds"})
		return
	}

	if err := utils.CheckPassword(u.Password, in.Password); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid creds"})
		return
	}

	token, _ := utils.CreateToken(u.ID.Hex())
	// set cookie optional
	if os.Getenv("USE_COOKIE") == "1" {
		c.SetCookie("token", token, 3600*24*3, "/", "", false, true)
	}

	c.JSON(http.StatusOK, gin.H{"token": token})
}
