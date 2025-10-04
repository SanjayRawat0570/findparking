package db

import (
	"context"
	"os"
	"strings"
	"time"

	rdb "github.com/redis/go-redis/v9"
)

var RedisClient *rdb.Client

// InitRedis initializes Redis client. Supports Upstash via REDIS_URL or
// traditional host:port via REDIS_ADDR. If neither is set, Redis is disabled.
func InitRedis() error {
	// Upstash style URL (e.g. rediss://:<token>@us1-upstash-redis.upstash.io:6379)
	if url := os.Getenv("REDIS_URL"); url != "" {
		opt, err := rdb.ParseURL(url)
		if err != nil {
			return err
		}
		RedisClient = rdb.NewClient(opt)
	} else if addr := os.Getenv("REDIS_ADDR"); addr != "" {
		opt := &rdb.Options{
			Addr: addr,
			DB:   0,
		}
		if pw := os.Getenv("REDIS_PASSWORD"); pw != "" {
			opt.Password = pw
		}
		RedisClient = rdb.NewClient(opt)
	} else {
		// Redis disabled by configuration
		RedisClient = nil
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := RedisClient.Ping(ctx).Err(); err != nil {
		// Some managed Redis providers may reject AUTH with an empty password
		// and return: "ERR Client sent AUTH, but no password is set".
		// If that happens, treat Redis as disabled rather than failing the app startup.
		if strings.Contains(err.Error(), "Client sent AUTH, but no password is set") {
			RedisClient = nil
			return nil
		}
		return err
	}
	return nil
}
