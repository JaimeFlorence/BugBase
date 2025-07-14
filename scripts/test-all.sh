#!/bin/bash

# Test runner script for BugBase project
# This script runs all tests for both backend and frontend

set -e

echo "🧪 Running BugBase Test Suite"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
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

# Initialize counters
BACKEND_PASSED=0
FRONTEND_PASSED=0
TOTAL_ERRORS=0

# Run backend tests
print_status "Running backend tests..."
echo "----------------------------------------"
cd backend

if npm test; then
    print_status "✅ Backend tests passed!"
    BACKEND_PASSED=1
else
    print_error "❌ Backend tests failed!"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

cd ..

# Run frontend tests
print_status "Running frontend tests..."
echo "----------------------------------------"
cd frontend

if npm test -- --run; then
    print_status "✅ Frontend tests passed!"
    FRONTEND_PASSED=1
else
    print_error "❌ Frontend tests failed!"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

cd ..

# Summary
echo ""
echo "🔍 Test Summary"
echo "==============="

if [ $BACKEND_PASSED -eq 1 ]; then
    echo -e "Backend:  ${GREEN}✅ PASSED${NC}"
else
    echo -e "Backend:  ${RED}❌ FAILED${NC}"
fi

if [ $FRONTEND_PASSED -eq 1 ]; then
    echo -e "Frontend: ${GREEN}✅ PASSED${NC}"
else
    echo -e "Frontend: ${RED}❌ FAILED${NC}"
fi

echo ""
if [ $TOTAL_ERRORS -eq 0 ]; then
    print_status "🎉 All tests passed!"
    exit 0
else
    print_error "🚨 $TOTAL_ERRORS test suite(s) failed!"
    exit 1
fi