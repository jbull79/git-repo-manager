#!/bin/bash

# Build and push Docker image for Git Repository Manager
# Usage: ./build-and-push.sh [dockerhub-username] [version]

set -e

DOCKER_USERNAME=${1:-"your-username"}
VERSION=${2:-"latest"}
IMAGE_NAME="git-repo-manager"

echo "Building Docker image: ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"

# Build the image
docker build -t ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION} .
docker tag ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION} ${DOCKER_USERNAME}/${IMAGE_NAME}:latest

echo ""
echo "Build complete!"
echo ""
echo "To push to Docker Hub, run:"
echo "  docker login"
echo "  docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
echo "  docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:latest"
echo ""
echo "Or use this script with --push flag:"
echo "  ./build-and-push.sh ${DOCKER_USERNAME} ${VERSION} --push"

if [ "$3" == "--push" ]; then
    echo ""
    echo "Pushing to Docker Hub..."
    docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}
    docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:latest
    echo "Push complete!"
fi

