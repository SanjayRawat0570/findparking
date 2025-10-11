FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV AI_AGENT_PORT=8081
CMD ["uvicorn", "main:app_sio", "--host", "0.0.0.0", "--port", "8081", "--reload"]
