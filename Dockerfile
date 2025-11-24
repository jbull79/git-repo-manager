FROM python:3.11-slim

# Metadata
LABEL maintainer="Git Repository Manager"
LABEL description="Web interface for managing and monitoring git repositories"
LABEL version="1.0.0"

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY static/ ./static/
COPY templates/ ./templates/

# Create non-root user and ensure data directory exists
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app && \
    mkdir -p /app/data && chown appuser:appuser /app/data

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5010

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5010/api/health')" || exit 1

# Run with Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5010", "--workers", "2", "--timeout", "120", "app.main:app"]

