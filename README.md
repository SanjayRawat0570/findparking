# Parking backend (Go + MongoDB + Redis)

This backend provides authentication (signup/login) and parking slot endpoints. It uses MongoDB for persistence and Redis for caching.


Quick start (local)

1. Copy `.env.example` to `.env` and adjust values.
2. Run MongoDB and Redis locally (or use managed services).

Build and run the server:

```powershell
cd backend
go mod download
go run .
```

Endpoints:
- POST /api/signup {email, password, name}
- POST /api/login {email, password}
- POST /api/slots (create slot)
- GET /api/slots/nearby?lat=...&lng=...&radius=...

Notes
- The project expects a MongoDB database named by `MONGO_DB` and collections `users` and `slots`.
- For production, secure `JWT_SECRET` and consider TLS, proper cookie flags, and rate limiting.

Using Upstash (managed Redis)
-----------------------------

If you use Upstash (or another Redis provider), set `REDIS_URL` in `.env` to the provided URL (Upstash uses a URL containing the token). Example in `.env.example` is commented.

If `REDIS_URL` is present, the server will parse it and connect to Upstash. If `REDIS_URL` is empty and `REDIS_ADDR` is empty, caching is disabled.
