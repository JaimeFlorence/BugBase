#!/bin/bash

# Coverage test runner script for BugBase project
# This script runs all tests with coverage reporting

set -e

echo "📊 Running BugBase Test Coverage"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if directories exist
if [ ! -d "backend" ]; then
    print_error "Backend directory not found!"
    exit 1
fi

if [ ! -d "frontend" ]; then
    print_error "Frontend directory not found!"
    exit 1
fi

# Run backend tests with coverage
print_status "Running backend tests with coverage..."
echo "------------------------------------------------"
cd backend

if npm run test:coverage; then
    print_status "✅ Backend coverage report generated!"
    print_info "Backend coverage report: backend/coverage/index.html"
else
    print_error "❌ Backend coverage failed!"
    exit 1
fi

cd ..

# Run frontend tests with coverage
print_status "Running frontend tests with coverage..."
echo "------------------------------------------------"
cd frontend

if npm run test:coverage -- --run; then
    print_status "✅ Frontend coverage report generated!"
    print_info "Frontend coverage report: frontend/coverage/index.html"
else
    print_error "❌ Frontend coverage failed!"
    exit 1
fi

cd ..

# Summary
echo ""
echo "📈 Coverage Summary"
echo "=================="
print_status "Coverage reports generated successfully!"
print_info "Backend:  backend/coverage/index.html"
print_info "Frontend: frontend/coverage/index.html"
echo ""
print_info "Open these files in your browser to view detailed coverage reports."

# Optional: Try to open coverage reports automatically
if command -v open &> /dev/null; then
    print_info "Opening coverage reports..."
    open backend/coverage/index.html
    open frontend/coverage/index.html
elif command -v xdg-open &> /dev/null; then
    print_info "Opening coverage reports..."
    xdg-open backend/coverage/index.html
    xdg-open frontend/coverage/index.html
fi