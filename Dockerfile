# Use official Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install all Python dependencies used by backend/engine modules.
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source required at runtime.
COPY backend ./backend
COPY engine ./engine

# Expose default port (runtime still honors $PORT).
EXPOSE 8080

# Railway/Fly compatible startup command.
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
