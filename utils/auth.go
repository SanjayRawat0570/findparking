package utils

import (
	"log"
	"time"

	"smart-parking/config"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// HashPassword takes a plaintext password and returns its bcrypt hash.
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Error hashing password: %v", err)
		return "", err
	}
	return string(bytes), nil
}

// CheckPasswordHash compares a plaintext password with a hashed password.
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateJWT creates a new JWT token for a given user.
func GenerateJWT(email string, isAdmin bool, cfg *config.Config) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour) // Token expires in 24 hours

	claims := jwt.MapClaims{
		"authorized": true,
		"email":      email,
		"is_admin":   isAdmin,
		"exp":        expirationTime.Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		log.Printf("Error signing JWT token: %v", err)
		return "", err
	}

	return tokenString, nil
}