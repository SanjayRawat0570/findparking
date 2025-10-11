AI Agent microservice

This lightweight FastAPI service provides suggestion and simple prediction endpoints for the FindParking app.

Environment

- BACKEND_URL: URL of the Go backend (default: http://localhost:8080)
- REDIS_URL: optional Redis URL for caching/metrics
- OPENAI_API_KEY: optional OpenAI key to re-rank results
- AI_AGENT_PORT: port to run the service (default 8081)

Endpoints

- POST /suggest
  - body: { lat, lng, radius?, limit?, user_id?, query? }
  - returns: list of suggested slots

- POST /proxy-book
  - body: { slot_id, transaction_id?, paid? }
  - forwards booking to backend and emits socket.io event 'booking.confirmed'

- GET /admin/peak_hours?slot_id={id}
  - returns simple heuristic data (uses Redis if available)

Run locally

python -m pip install -r requirements.txt
python main.py

Docker

Docker build . -t findparking-ai
Docker run -e BACKEND_URL=http://host.docker.internal:8080 -p 8081:8081 findparking-ai
