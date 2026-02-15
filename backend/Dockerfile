# ========================
# STAGE 1 - Build / Install dependencies
# ========================
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies for building Python packages (OpenCV, MediaPipe)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc g++ \
    cmake pkg-config \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender-dev \
    libavcodec-dev libavformat-dev libswscale-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy only the dependency file to leverage Docker caching
COPY requirements.txt .

# Create a virtual environment and install dependencies
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt


# ========================
# STAGE 2 - Final runtime image
# ========================
FROM python:3.11-slim AS runtime

WORKDIR /app

# Install runtime dependencies for OpenCV and MediaPipe
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Copy app source code
COPY . .

# Copy the virtual environment from the builder
COPY --from=builder /opt/venv /opt/venv

# Add venv binaries to PATH
ENV PATH="/opt/venv/bin:$PATH"

# Create non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# Expose FastAPI port
EXPOSE 8000

# Default command to run FastAPI with Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
