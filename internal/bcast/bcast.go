package bcast

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"parking/backend/internal/db"
	"sync"

	rdb "github.com/redis/go-redis/v9"
)

type client chan []byte

var (
	clientsMu sync.Mutex
	clients   = map[client]struct{}{}
)

// Broadcast sends a JSON-encoded event to local SSE clients and to Redis channel if available.
func Broadcast(event interface{}) {
	b, err := json.Marshal(event)
	if err != nil {
		log.Printf("bcast: marshal error: %v", err)
		return
	}

	// publish to local clients
	clientsMu.Lock()
	for c := range clients {
		select {
		case c <- b:
		default:
			// drop if client not ready
		}
	}
	clientsMu.Unlock()

	// publish to Redis channel if configured
	if db.RedisClient != nil {
		if err := db.RedisClient.Publish(context.Background(), "slots:events", b).Err(); err != nil {
			log.Printf("bcast: redis publish error: %v", err)
		}
	}
}

// ServeSSE registers an HTTP handler that streams events to connected clients.
func ServeSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ch := make(client)
	clientsMu.Lock()
	clients[ch] = struct{}{}
	clientsMu.Unlock()

	// If Redis is configured, subscribe and forward messages from Redis to local client
	var sub *rdb.PubSub
	if db.RedisClient != nil {
		sub = db.RedisClient.Subscribe(context.Background(), "slots:events")
		// drain subscription in a goroutine
		go func() {
			for msg := range sub.Channel() {
				select {
				case ch <- []byte(msg.Payload):
				default:
				}
			}
		}()
	}

	notify := r.Context().Done()

	// send a welcome comment so client knows stream is open
	_, _ = w.Write([]byte(": connected\n\n"))
	flusher.Flush()

	for {
		select {
		case <-notify:
			clientsMu.Lock()
			delete(clients, ch)
			clientsMu.Unlock()
			if sub != nil {
				_ = sub.Close()
			}
			return
		case b := <-ch:
			// send as event: data: <json>\n\n
			_, _ = w.Write([]byte("data: "))
			_, _ = w.Write(b)
			_, _ = w.Write([]byte("\n\n"))
			flusher.Flush()
		}
	}
}
