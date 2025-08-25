FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends     libglib2.0-0 libgl1 ca-certificates &&     rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
ENV PYTHONUNBUFFERED=1
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
