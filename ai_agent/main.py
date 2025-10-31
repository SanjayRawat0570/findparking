import os
import asyncio
import json
from typing import List, Optional
import asyncio
import httpx
import redis
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import socketio
from dotenv import load_dotenv, find_dotenv

from fastapi import Body

# Load .env from project root (find parent .env so running from ai_agent/ still picks backend/.env)
load_dotenv(find_dotenv())

BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:8080')
REDIS_URL = os.getenv('REDIS_URL', '')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
EXPLAIN_TOP_N = int(os.getenv('EXPLAIN_TOP_N', '3'))

# initialize openai if key present
openai = None
if OPENAI_API_KEY:
    try:
        import openai as _openai

        _openai.api_key = OPENAI_API_KEY
        openai = _openai
    except Exception:
        openai = None

# basic redis client (sync)
redis_client = None
if REDIS_URL:
    redis_client = redis.from_url(REDIS_URL)

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
app = FastAPI(title='FindParking AI Agent')
app_sio = socketio.ASGIApp(sio, other_asgi_app=app)

# allow cross-origin requests from the frontend during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# models
class SuggestRequest(BaseModel):
    lat: float
    lng: float
    radius: Optional[int] = 1000
    limit: Optional[int] = 5
    user_id: Optional[str] = None
    query: Optional[str] = None

class BookingProxy(BaseModel):
    slot_id: str
    transaction_id: Optional[str] = None
    paid: Optional[bool] = False


class LLMQuery(BaseModel):
    query: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius: Optional[int] = 1000
    limit: Optional[int] = 10


class ChatMessage(BaseModel):
    role: str
    content: str



async def fetch_nearby(lat: float, lng: float, radius: int) -> List[dict]:
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BACKEND_URL}/api/slots/nearby", params={"lat": lat, "lng": lng, "radius": radius}, timeout=10.0)
        r.raise_for_status()
        return r.json()


async def fetch_all_slots() -> List[dict]:
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BACKEND_URL}/api/slots/", timeout=10.0)
        r.raise_for_status()
        return r.json()


async def _call_openai_chat(messages: List[dict], max_tokens: int = 200) -> Optional[str]:
    """Call OpenAI ChatCompletion in a thread to avoid blocking the event loop."""
    if not openai:
        return None

    def _sync_call():
        try:
            resp = openai.ChatCompletion.create(model="gpt-4o-mini", messages=messages, max_tokens=max_tokens)
            return resp.choices[0].message.content
        except Exception:
            return None

    return await asyncio.to_thread(_sync_call)


async def openai_rerank_slots(slots: List[dict], user_query: str) -> List[dict]:
    """Ask OpenAI to return a JSON array of slot ids ranked best-first for the user query.
    Returns the slots in the requested order or the original list on failure.
    """
    if not openai:
        return slots

    # keep the prompt concise and provide only needed fields
    short = [{"id": s.get("id"), "name": s.get("name"), "price": s.get("price"), "available": s.get("available")} for s in slots]
    system = {"role": "system", "content": "You are a helpful assistant that ranks parking slots."}
    user = {
        "role": "user",
        "content": (
            "Given the following parking slots and the user query, return a JSON array of slot ids ordered best to worst. "
            f"User query: {user_query}\nSlots: {json.dumps(short)}\nOnly return a JSON array like [\"id1\", \"id2\"] with no extra text."
        ),
    }
    text = await _call_openai_chat([system, user], max_tokens=150)
    if not text:
        return slots

    # try parse JSON directly
    try:
        ids = json.loads(text)
        id_map = {s.get("id"): s for s in slots}
        ordered = [id_map[i] for i in ids if i in id_map]
        # append any missing slots at the end
        for s in slots:
            if s not in ordered:
                ordered.append(s)
        return ordered
    except Exception:
        return slots


async def openai_explain_choice(slot: dict, user_query: str) -> Optional[str]:
    if not openai:
        return None
    system = {"role": "system", "content": "You are a concise assistant that explains why a parking slot is a good fit."}
    user = {"role": "user", "content": f"Explain briefly why slot {slot.get('id')} is a good match for: {user_query}. Provide 1-2 sentences."}
    return await _call_openai_chat([system, user], max_tokens=80)


async def parse_nl_to_filter(query: str) -> dict:
    """Use LLM to convert a natural-language query into structured filter parameters.
    Fallback: simple heuristics parsing.
    Returns a dict like { 'max_price': 50, 'lat': ..., 'lng': ..., 'radius': 1000 }
    """
    if not openai:
        # very simple heuristic parsing
        out = {}
        # price
        import re
        m = re.search(r"(under|less than)\s*₹?(\d+)", query)
        if m:
            out['max_price'] = float(m.group(2))
        return out

    prompt_sys = {"role":"system","content":"You are a translator that extracts structured filters from user parking queries."}
    prompt_user = {"role":"user","content":f"Convert this to a JSON object with keys: max_price, lat, lng, radius, limit if present. Query: {query}. Return only valid JSON."}
    text = await _call_openai_chat([prompt_sys, prompt_user], max_tokens=150)
    try:
        return json.loads(text)
    except Exception:
        return {}


@app.post('/llm/query')
async def llm_query(q: LLMQuery):
    """Process a natural language query and return matching slots."""
    filters = await parse_nl_to_filter(q.query or '')
    # prefer explicit coords from request
    lat = q.lat
    lng = q.lng
    if not lat or not lng:
        lat = filters.get('lat') or q.lat
        lng = filters.get('lng') or q.lng

    slots = await fetch_nearby(lat or 0.0, lng or 0.0, q.radius or filters.get('radius', 1000))
    # apply price filter if present
    max_price = filters.get('max_price')
    if max_price is not None:
        slots = [s for s in slots if s.get('price') is not None and float(s.get('price')) <= float(max_price)]
    return slots[: q.limit]


@app.post('/image_analyze')
async def image_analyze(file: UploadFile = File(...)):
    """Accept an uploaded image and (placeholder) analyze it to detect free slots.
    This is a scaffold: it returns a simple heuristic result. Replace with a real
    computer-vision model (OpenCV/TensorFlow) or an external vision API when ready.
    """
    try:
        data = await file.read()
        size_kb = len(data) / 1024.0
        # placeholder heuristic: use file size to fake a detection
        # (small images -> assume fewer slots visible -> return small number)
        if size_kb < 50:
            free = 2
        elif size_kb < 200:
            free = 5
        else:
            free = 8

        # If OpenAI image models were available, we'd forward the bytes for analysis here.
        return {"filename": file.filename, "size_kb": round(size_kb,1), "detected_free_slots": free, "note": "placeholder analysis"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/chat')
async def chat(messages: List[ChatMessage] = Body(...)):
    """Simple conversational chat endpoint that uses OpenAI if available; otherwise returns canned responses."""
    if not openai:
        return {"reply": "Sorry, chat is not available (OpenAI not configured)."}
    msgs = []
    for m in messages:
        msgs.append({"role": m.role, "content": m.content})
    resp = await _call_openai_chat(msgs, max_tokens=300)
    return {"reply": resp}


@app.get('/admin/llm_summary')
async def admin_llm_summary(slot_id: Optional[str] = None):
    """Return a short LLM-generated summary of recent bookings and revenue for admin.
    Falls back to heuristic summary if OpenAI unavailable.
    """
    slots = await fetch_all_slots()
    # build a short context
    if slot_id:
        slots = [s for s in slots if s.get('id') == slot_id]
    short = [{"id": s.get('id'), "used": max(0, int(s.get('total') or 0)-int(s.get('available') or 0)), "price": s.get('price')} for s in slots]
    if not openai:
        total_rev = sum([x['used'] * float(x['price'] or 0) for x in short])
        return {"summary": f"Estimated revenue for selection: {total_rev}", "details": short}

    system = {"role": "system", "content": "You summarize parking bookings and revenue in 3-4 sentences."}
    user = {"role": "user", "content": f"Given these slots: {json.dumps(short)}, provide a concise summary of utilization and revenue."}
    text = await _call_openai_chat([system, user], max_tokens=200)
    return {"summary": text, "details": short}


@app.post('/suggest')
async def suggest(req: SuggestRequest):
    """Return a ranked list of suggested parking slots.
    If OPENAI_API_KEY is present, use it to re-rank candidates; otherwise use a heuristic.
    """
    slots = await fetch_nearby(req.lat, req.lng, req.radius)
    # simple heuristic: score by availability and price
    def score(s):
        avail = s.get('available', 0)
        price = s.get('price', 0)
        # higher availability -> better, lower price -> better
        return avail * 100 - price

    candidates = sorted(slots, key=score, reverse=True)[: req.limit]

    # optional OpenAI re-ranking (use helper)
    ranked = candidates
    if openai and req.query:
        try:
            ranked = await openai_rerank_slots(candidates, req.query)
        except Exception:
            ranked = candidates

    # attach short explanations if OpenAI available and query provided
    out = []
    if openai and req.query:
        try:
            # only explain top N to limit OpenAI calls/cost
            top_n = min(EXPLAIN_TOP_N, len(ranked))
            explain_targets = ranked[:top_n]
            tasks = [openai_explain_choice(s, req.query) for s in explain_targets]
            explains = await asyncio.gather(*tasks, return_exceptions=True)
            # attach explanations to the top N
            for s, ex in zip(explain_targets, explains):
                s_copy = dict(s)
                s_copy['explain'] = ex if isinstance(ex, str) else None
                out.append(s_copy)
            # append remaining slots without explanation
            for s in ranked[top_n:]:
                out.append(dict(s))
        except Exception as e:
            # on any explanation error, fall back to returning ranked list without explanations
            print('openai explain error', e)
            out = [dict(s) for s in ranked]
    else:
        out = [dict(s) for s in ranked]

    return out


@app.post('/nl_suggest')
async def nl_suggest(req: SuggestRequest):
    """Natural-language suggestions. Uses heuristic ranking and OpenAI (if configured) to re-rank.
    Request body: { lat, lng, radius?, limit?, query? }
    """
    # reuse existing suggest logic but ensure query-aware
    return await suggest(req)


@app.post('/auto_book')
async def auto_book(req: SuggestRequest, request: Request, background_tasks: BackgroundTasks):
    """Automatically choose a suitable slot for the user query and attempt to book it via the backend.
    Requires client to pass user token in Authorization header when calling backend via proxy-book.
    """
    # get suggestions
    res = await suggest(req)
    results = res if isinstance(res, list) else res.get('results', [])
    if not results:
        raise HTTPException(status_code=404, detail='no suitable slots found')

    # pick top candidate
    top = results[0]

    # attempt to proxy book using default user token from env (not ideal) - client should call /proxy-book directly
    payload = {
        'slot_id': top.get('id'),
        'transaction_id': '',
        'paid': False,
    }

    # Determine authorization to forward: prefer caller's Authorization header, fall back to BACKEND_API_KEY env
    auth_header = None
    if 'authorization' in request.headers and request.headers['authorization'].strip():
        auth_header = request.headers['authorization']
    elif os.getenv('BACKEND_API_KEY'):
        auth_header = f"Bearer {os.getenv('BACKEND_API_KEY')}"

    if not auth_header:
        # return a clear error instead of forwarding an unauthenticated request to the backend
        raise HTTPException(status_code=401, detail='Authorization required: pass Authorization header (Bearer <token>) or set BACKEND_API_KEY in AI Agent env')

    client_headers = {"Content-Type": "application/json", "Authorization": auth_header}

    async with httpx.AsyncClient() as client:
        r = await client.post(f"{BACKEND_URL}/api/bookings/", json=payload, headers=client_headers, timeout=10.0)
        try:
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            # forward backend error text in structured form
            raise HTTPException(status_code=r.status_code, detail=r.text)

    data = r.json()
    # broadcast booking confirmed event
    await sio.emit('booking.confirmed', data)
    return data


@app.get('/admin/dynamic_pricing')
async def dynamic_pricing(slot_id: Optional[str] = None):
    """Suggest a simple dynamic price for a slot (heuristic): base * multiplier based on utilization.
    If slot_id omitted, return suggestions for all slots.
    """
    slots = await fetch_all_slots()
    out = []
    for s in slots:
        if slot_id and s.get('id') != slot_id:
            continue
        total = int(s.get('total') or 0)
        avail = int(s.get('available') or 0)
        price = float(s.get('price') or 0)
        util = 0.0
        if total > 0:
            util = float(total-avail) / float(total)
        # heuristic multipliers
        if util > 0.8:
            mult = 1.5
        elif util > 0.6:
            mult = 1.25
        elif util > 0.4:
            mult = 1.1
        else:
            mult = 1.0
        suggested = round(price * mult, 2)
        out.append({"id": s.get('id'), "current_price": price, "suggested_price": suggested, "multiplier": mult})
    return {"suggestions": out}


@app.get('/admin/predict_peak_hours')
async def predict_peak_hours(slot_id: Optional[str] = None):
    """Return predicted peak hours using simple Redis rolling counters if available.
    Expects Redis keys like slot:<id>:bookings:hour:<H> storing counts.
    """
    if not redis_client:
        return {"error": "redis not configured, cannot predict"}
    keys = []
    if slot_id:
        base = f"slot:{slot_id}:bookings:hour:"
        for h in range(24):
            try:
                v = int(redis_client.get(f"{base}{h}") or 0)
            except Exception:
                v = 0
            keys.append((h, v))
        # pick top 3 hours
        keys.sort(key=lambda x: x[1], reverse=True)
        return {"slot_id": slot_id, "top_hours": keys[:3]}
    return {"error": "slot_id required"}


@app.get('/admin/daily_report')
async def daily_report():
    """Return a simple estimated daily revenue report by aggregating (total - available)*price per slot.
    This is an approximation since bookings collection may contain more accurate data.
    """
    slots = await fetch_all_slots()
    total_rev = 0.0
    per_slot = []
    for s in slots:
        total = int(s.get('total') or 0)
        avail = int(s.get('available') or 0)
        price = float(s.get('price') or 0)
        used = max(0, total-avail)
        rev = used * price
        total_rev += rev
        per_slot.append({"id": s.get('id'), "used": used, "revenue": rev})
    return {"total_estimated_revenue": total_rev, "per_slot": per_slot}


async def occupancy_monitor(poll_interval: int = 10):
    """Background task: periodically poll slots and emit occupancy alerts for high-utilization slots.
    """
    while True:
        try:
            slots = await fetch_all_slots()
            for s in slots:
                total = int(s.get('total') or 0)
                avail = int(s.get('available') or 0)
                if total <= 0:
                    continue
                util = float(total-avail) / float(total)
                if util >= 0.85:
                    # high utilization alert
                    await sio.emit('occupancy.alert', {"slot_id": s.get('id'), "utilization": util, "available": avail})
        except Exception:
            pass
        await asyncio.sleep(poll_interval)


@app.on_event('startup')
async def startup_tasks():
    # start occupancy monitor in background
    asyncio.create_task(occupancy_monitor())


@app.post('/proxy-book')
async def proxy_book(b: BookingProxy, request: Request):
    # forward booking request to backend
    async with httpx.AsyncClient() as client:
        try:
            headers = {"Content-Type": "application/json"}
            if 'authorization' in request.headers:
                headers['Authorization'] = request.headers['authorization']
            r = await client.post(f"{BACKEND_URL}/api/bookings/", json=b.dict(), headers=headers, timeout=10.0)
            r.raise_for_status()
            data = r.json()
            # broadcast suggestion/confirmation via socketio
            asyncio.create_task(sio.emit('booking.confirmed', data))
            return data
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)


@app.get('/health')
async def health():
    return {"status": "ok"}


# admin endpoints
@app.get('/admin/peak_hours')
async def peak_hours(slot_id: Optional[str] = None):
    # very simple heuristic: look at recent bookings count in Redis if available
    if redis_client and slot_id:
        key = f"slot:{slot_id}:bookings:recent"
        try:
            cnt = int(redis_client.get(key) or 0)
            return {"slot_id": slot_id, "recent_bookings": cnt}
        except Exception:
            pass
    return {"note": "no data"}


@sio.event
async def connect(sid, environ):
    print('socket connect', sid)


@sio.event
async def disconnect(sid):
    print('socket disconnect', sid)


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app_sio, host='0.0.0.0', port=int(os.getenv('AI_AGENT_PORT', '8081')))
