package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
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

// RazorpayCreateRequest expects amount in the smallest currency unit (paise for INR)
type RazorpayCreateRequest struct {
	Amount   int64  `json:"amount" binding:"required"`
	Currency string `json:"currency"`
	Receipt  string `json:"receipt"`
}

type RazorpayCreateResponse struct {
	OrderID  string `json:"order_id"`
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
	KeyID    string `json:"key_id"`
}

// CreateRazorpayOrder creates an order via Razorpay REST API and returns the order details
func CreateRazorpayOrder(c *gin.Context) {
	var req RazorpayCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Currency == "" {
		req.Currency = "INR"
	}

	keyID := os.Getenv("RAZORPAY_KEY_ID")
	keySecret := os.Getenv("RAZORPAY_KEY_SECRET")
	if keyID == "" || keySecret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "razorpay keys not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)"})
		return
	}

	body := map[string]interface{}{
		"amount":          req.Amount,
		"currency":        req.Currency,
		"payment_capture": 1,
	}
	if req.Receipt != "" {
		body["receipt"] = req.Receipt
	}

	b, _ := json.Marshal(body)
	apiURL := "https://api.razorpay.com/v1/orders"
	httpReq, err := http.NewRequest("POST", apiURL, bytes.NewReader(b))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create request"})
		return
	}
	httpReq.SetBasicAuth(keyID, keySecret)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to call razorpay"})
		return
	}
	defer resp.Body.Close()

	var parsed map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse razorpay response"})
		return
	}
	// Example fields: id, amount, currency
	oid, _ := parsed["id"].(string)
	amt := int64(0)
	if v, ok := parsed["amount"].(float64); ok {
		amt = int64(v)
	}
	curr, _ := parsed["currency"].(string)

	// store pending state
	paymentsMu.Lock()
	payments[oid] = false
	amounts[oid] = amt
	paymentsMu.Unlock()

	c.JSON(http.StatusOK, RazorpayCreateResponse{OrderID: oid, Amount: amt, Currency: curr, KeyID: keyID})
}

// CreateRazorpayLink creates a Razorpay Payment Link and returns a QR image data URI and link id.
func CreateRazorpayLink(c *gin.Context) {
	var req struct {
		Amount      int64  `json:"amount" binding:"required"`
		Currency    string `json:"currency"`
		Description string `json:"description"`
		// optional metadata
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Currency == "" {
		req.Currency = "INR"
	}

	keyID := os.Getenv("RAZORPAY_KEY_ID")
	keySecret := os.Getenv("RAZORPAY_KEY_SECRET")
	if keyID == "" || keySecret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "razorpay credentials not configured"})
		return
	}

	payload := map[string]interface{}{
		"amount":         req.Amount,
		"currency":       req.Currency,
		"accept_partial": false,
		"description":    req.Description,
	}
	b, _ := json.Marshal(payload)
	apiURL := "https://api.razorpay.com/v1/payment_links"
	httpReq, _ := http.NewRequest("POST", apiURL, bytes.NewReader(b))
	httpReq.SetBasicAuth(keyID, keySecret)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to call razorpay"})
		return
	}
	defer resp.Body.Close()
	var parsed map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse razorpay response"})
		return
	}

	id, _ := parsed["id"].(string)
	shortURL, _ := parsed["short_url"].(string)
	if shortURL == "" {
		if su, ok := parsed["short_link"].(string); ok {
			shortURL = su
		}
	}

	// store pending
	paymentsMu.Lock()
	payments[id] = false
	amounts[id] = req.Amount
	paymentsMu.Unlock()

	// generate QR PNG for shortURL
	png, err := qrcode.Encode(shortURL, qrcode.Medium, 256)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate qr"})
		return
	}
	dataURI := "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)

	c.JSON(http.StatusOK, gin.H{"link_id": id, "short_url": shortURL, "qr": dataURI})
}

// CheckRazorpayLinkStatus checks the status of a payment link by id.
func CheckRazorpayLinkStatus(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing id"})
		return
	}
	keyID := os.Getenv("RAZORPAY_KEY_ID")
	keySecret := os.Getenv("RAZORPAY_KEY_SECRET")
	if keyID == "" || keySecret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "razorpay credentials not configured"})
		return
	}

	apiURL := fmt.Sprintf("https://api.razorpay.com/v1/payment_links/%s", id)
	httpReq, _ := http.NewRequest("GET", apiURL, nil)
	httpReq.SetBasicAuth(keyID, keySecret)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to call razorpay"})
		return
	}
	defer resp.Body.Close()
	var parsed map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse razorpay response"})
		return
	}

	status, _ := parsed["status"].(string)
	paid := false
	if status == "paid" {
		paid = true
	} else if paymentsObj, ok := parsed["payments"].([]interface{}); ok && len(paymentsObj) > 0 {
		paid = true
	}

	if paid {
		c.JSON(http.StatusOK, gin.H{"status": "succeeded", "id": id})
	} else {
		c.JSON(http.StatusOK, gin.H{"status": "pending", "id": id})
	}
}

type RazorpayVerifyRequest struct {
	RazorpayOrderID   string `json:"razorpay_order_id" binding:"required"`
	RazorpayPaymentID string `json:"razorpay_payment_id" binding:"required"`
	RazorpaySignature string `json:"razorpay_signature" binding:"required"`
}

// VerifyRazorpayPayment verifies the signature sent by Razorpay after checkout
func VerifyRazorpayPayment(c *gin.Context) {
	var req RazorpayVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	keySecret := os.Getenv("RAZORPAY_KEY_SECRET")
	if keySecret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "razorpay key secret not configured"})
		return
	}

	// compute expected signature: hmac_sha256(order_id + "|" + payment_id, key_secret)
	mac := hmac.New(sha256.New, []byte(keySecret))
	mac.Write([]byte(req.RazorpayOrderID + "|" + req.RazorpayPaymentID))
	expected := hex.EncodeToString(mac.Sum(nil))

	if expected != req.RazorpaySignature {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature"})
		return
	}

	// mark succeeded
	paymentsMu.Lock()
	payments[req.RazorpayOrderID] = true
	paymentsMu.Unlock()

	c.JSON(http.StatusOK, gin.H{"status": "succeeded", "transaction_id": req.RazorpayOrderID})
}
