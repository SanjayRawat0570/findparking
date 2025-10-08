package handlers

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	qrcode "github.com/skip2/go-qrcode"
)

// in-memory payment store (demo only)
var (
	paymentsMu sync.RWMutex
	payments   = map[string]bool{}  // tx -> succeeded
	amounts    = map[string]int64{} // tx -> amount
)

type CreatePaymentRequest struct {
	Amount int64  `json:"amount" binding:"required"`
	Method string `json:"method"`
}

type CreatePaymentResponse struct {
	TransactionID string `json:"transaction_id"`
	QRDataURI     string `json:"qr_data_uri"`
	PayURL        string `json:"pay_url"`
}

// CreatePayment creates a payment record and returns a QR code (data URI)
// The QR encodes a pay URL which, when visited, marks the payment as complete.
func CreatePayment(c *gin.Context) {
	var req CreatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := fmt.Sprintf("tx-%d-%d", time.Now().UnixNano(), time.Now().Unix()%1000)

	// mark pending
	paymentsMu.Lock()
	payments[tx] = false
	amounts[tx] = req.Amount
	paymentsMu.Unlock()

	API_BASE := (c.Request.URL.Scheme + "://" + c.Request.Host)
	// If URL.Scheme empty (likely), fall back
	if API_BASE == "://"+c.Request.Host {
		API_BASE = "http://" + c.Request.Host
	}

	payURL := fmt.Sprintf("%s/api/payments/mockpay?tx=%s", API_BASE, tx)

	// generate QR PNG as data URI
	png, err := qrcode.Encode(payURL, qrcode.Medium, 256)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate qr"})
		return
	}
	dataURI := "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)

	resp := CreatePaymentResponse{TransactionID: tx, QRDataURI: dataURI, PayURL: payURL}
	c.JSON(http.StatusOK, resp)
}

// PaymentStatus returns whether the tx has succeeded
func PaymentStatus(c *gin.Context) {
	tx := c.Query("tx")
	if tx == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing tx"})
		return
	}
	paymentsMu.RLock()
	s, ok := payments[tx]
	paymentsMu.RUnlock()
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "tx not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"transaction_id": tx, "status": func() string {
		if s {
			return "succeeded"
		}
		return "pending"
	}()})
}

// MockPay simulates the payer visiting the payment URL (e.g., by scanning the QR).
// It marks the transaction as succeeded and returns a simple confirmation page.
func MockPay(c *gin.Context) {
	tx := c.Query("tx")
	if tx == "" {
		c.String(http.StatusBadRequest, "missing tx")
		return
	}
	paymentsMu.Lock()
	if _, ok := payments[tx]; !ok {
		paymentsMu.Unlock()
		c.String(http.StatusNotFound, "transaction not found")
		return
	}
	payments[tx] = true
	paymentsMu.Unlock()

	c.Header("Content-Type", "text/html")
	c.String(http.StatusOK, fmt.Sprintf("<html><body><h1>Payment received</h1><p>Transaction %s marked paid.</p></body></html>", tx))
}

// IsPaymentSucceeded is a helper used by booking flow to validate a tx
func IsPaymentSucceeded(tx string) bool {
	paymentsMu.RLock()
	defer paymentsMu.RUnlock()
	return payments[tx]
}
