# Docker Image Publishing Guide

This guide explains how to build and publish the Git Repository Manager Docker image.

## Prerequisites

- Docker installed and running
- Docker Hub account (or access to another container registry)
- Git repository cloned locally

## Building the Image

### Basic Build

```bash
docker build -t git-repo-manager:latest .
```

### Build with Custom Tag

```bash
docker build -t your-username/git-repo-manager:1.0.0 .
docker tag your-username/git-repo-manager:1.0.0 your-username/git-repo-manager:latest
```

### Using the Build Script

```bash
./build-and-push.sh your-username latest
```

## Publishing to Docker Hub

1. **Login to Docker Hub**:
   ```bash
   docker login
   ```

2. **Tag the image** (if not already tagged):
   ```bash
   docker tag git-repo-manager:latest your-username/git-repo-manager:latest
   ```

3. **Push the image**:
   ```bash
   docker push your-username/git-repo-manager:latest
   ```

4. **Push version tag** (optional):
   ```bash
   docker push your-username/git-repo-manager:1.0.0
   ```

### Using the Build Script with Auto-Push

```bash
./build-and-push.sh your-username 1.0.0 --push
```

## Using the Published Image

Once published, others can use your image:

```bash
docker pull your-username/git-repo-manager:latest
docker run -d \
  --name git-repo-manager \
  -p 5010:5010 \
  -v ~/git:/git \
  -v $(pwd)/data:/app/data \
  your-username/git-repo-manager:latest
```

Or with docker-compose (using `docker-compose.pull.yml`):

```bash
# Edit docker-compose.pull.yml and set your image name
docker-compose -f docker-compose.pull.yml up -d
```

## Image Details

- **Base Image**: `python:3.11-slim`
- **Exposed Port**: `5010`
- **Default User**: `appuser` (UID 1000)
- **Health Check**: Built-in health check endpoint at `/api/health`
- **Volume Mounts Required**:
  - Git repositories: `/git` (read-write)
  - Persistent data: `/app/data` (read-write)

## Versioning Strategy

Recommended versioning:
- `latest` - Always points to the most recent stable version
- `1.0.0`, `1.0.1`, etc. - Semantic versioning for releases
- `dev` or `edge` - Development builds (optional)

## Multi-Architecture Builds (Advanced)

To build for multiple architectures (amd64, arm64):

```bash
# Install buildx
docker buildx create --use

# Build for multiple platforms
docker buildx build --platform linux/amd64,linux/arm64 \
  -t your-username/git-repo-manager:latest \
  --push .
```

## Troubleshooting

### Build fails with permission errors
- Ensure Docker has proper permissions
- Try building without the non-root user first for testing

### Push fails with authentication error
- Run `docker login` again
- Verify your Docker Hub credentials

### Image too large
- The image uses `python:3.11-slim` which is already optimized
- Consider multi-stage builds if further optimization is needed

