#!/bin/bash

# KrakelOrakel Deployment Script
# Builds and pushes Docker containers to Docker Hub

set -e  # Exit on any error

# Configuration
DOCKER_NAMESPACE="neuralcoder"
FRONTEND_IMAGE="krakelorakel-frontend"
BACKEND_IMAGE="krakelorakel-backend"
VERSION=${1:-latest}  # Use first argument as version, default to 'latest'

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    log_info "Checking Docker daemon..."
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker daemon is not running. Please start Docker and try again."
        exit 1
    fi
    log_success "Docker daemon is running"
}

# Check if user is logged in to Docker Hub
check_docker_login() {
    log_info "Checking Docker Hub login status..."
    if ! docker info | grep -q "Username"; then
        log_warning "Not logged in to Docker Hub. Attempting to login..."
        if ! docker login; then
            log_error "Failed to login to Docker Hub. Please run 'docker login' manually and try again."
            exit 1
        fi
    fi
    log_success "Logged in to Docker Hub"
}

# Build frontend container
build_frontend() {
    log_info "Building frontend container..."
    
    # Remove old containers and images
    docker container prune -f > /dev/null 2>&1 || true
    docker image prune -f > /dev/null 2>&1 || true
    
    # Build the frontend image
    if docker build -f frontend/Dockerfile -t ${DOCKER_NAMESPACE}/${FRONTEND_IMAGE}:${VERSION} .; then
        log_success "Frontend container built successfully"
    else
        log_error "Failed to build frontend container"
        exit 1
    fi
}

# Build backend container
build_backend() {
    log_info "Building backend container..."
    
    # Build the backend image
    if docker build -f backend/Dockerfile -t ${DOCKER_NAMESPACE}/${BACKEND_IMAGE}:${VERSION} ./backend; then
        log_success "Backend container built successfully"
    else
        log_error "Failed to build backend container"
        exit 1
    fi
}

# Tag images with latest
tag_latest() {
    log_info "Tagging images with 'latest'..."
    
    if [ "$VERSION" != "latest" ]; then
        docker tag ${DOCKER_NAMESPACE}/${FRONTEND_IMAGE}:${VERSION} ${DOCKER_NAMESPACE}/${FRONTEND_IMAGE}:latest
        docker tag ${DOCKER_NAMESPACE}/${BACKEND_IMAGE}:${VERSION} ${DOCKER_NAMESPACE}/${BACKEND_IMAGE}:latest
        log_success "Images tagged with 'latest'"
    fi
}

# Push images to Docker Hub
push_images() {
    log_info "Pushing images to Docker Hub..."
    
    # Push frontend
    log_info "Pushing frontend image..."
    if docker push ${DOCKER_NAMESPACE}/${FRONTEND_IMAGE}:${VERSION}; then
        log_success "Frontend image pushed successfully"
    else
        log_error "Failed to push frontend image"
        exit 1
    fi
    
    # Push backend
    log_info "Pushing backend image..."
    if docker push ${DOCKER_NAMESPACE}/${BACKEND_IMAGE}:${VERSION}; then
        log_success "Backend image pushed successfully"
    else
        log_error "Failed to push backend image"
        exit 1
    fi
    
    # Push latest tags if version is not latest
    if [ "$VERSION" != "latest" ]; then
        log_info "Pushing latest tags..."
        docker push ${DOCKER_NAMESPACE}/${FRONTEND_IMAGE}:latest
        docker push ${DOCKER_NAMESPACE}/${BACKEND_IMAGE}:latest
        log_success "Latest tags pushed successfully"
    fi
}

# Show deployment summary
show_summary() {
    log_success "Deployment completed successfully!"
    echo
    echo "📦 Deployed Images:"
    echo "   Frontend: ${DOCKER_NAMESPACE}/${FRONTEND_IMAGE}:${VERSION}"
    echo "   Backend:  ${DOCKER_NAMESPACE}/${BACKEND_IMAGE}:${VERSION}"
    if [ "$VERSION" != "latest" ]; then
        echo "   Latest:  ${DOCKER_NAMESPACE}/${FRONTEND_IMAGE}:latest"
        echo "            ${DOCKER_NAMESPACE}/${BACKEND_IMAGE}:latest"
    fi
    echo
    echo "🔗 Docker Hub URLs:"
    echo "   Frontend: https://hub.docker.com/r/${DOCKER_NAMESPACE}/${FRONTEND_IMAGE}"
    echo "   Backend:  https://hub.docker.com/r/${DOCKER_NAMESPACE}/${BACKEND_IMAGE}"
    echo
    echo "🚀 To pull and run:"
    echo "   docker pull ${DOCKER_NAMESPACE}/${FRONTEND_IMAGE}:${VERSION}"
    echo "   docker pull ${DOCKER_NAMESPACE}/${BACKEND_IMAGE}:${VERSION}"
}

# Main deployment function
main() {
    echo "🧙‍♂️ KrakelOrakel Deployment Script"
    echo "=================================="
    echo "Version: ${VERSION}"
    echo "Namespace: ${DOCKER_NAMESPACE}"
    echo
    
    # Run deployment steps
    check_docker
    check_docker_login
    build_frontend
    build_backend
    tag_latest
    push_images
    show_summary
}

# Handle script arguments
case "${1:-}" in
    -h|--help)
        echo "Usage: $0 [VERSION]"
        echo
        echo "Arguments:"
        echo "  VERSION    Version tag for the images (default: latest)"
        echo
        echo "Examples:"
        echo "  $0           # Deploy with 'latest' tag"
        echo "  $0 v1.0.0    # Deploy with 'v1.0.0' tag"
        echo "  $0 2024-08   # Deploy with '2024-08' tag"
        exit 0
        ;;
    *)
        main
        ;;
esac
