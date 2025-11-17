#!/bin/bash

# Start Sentinel Support Console Locally
# This script starts the application without Docker

echo "🚀 Starting Sentinel Support Console..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check if PostgreSQL is running (assumes local installation)
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL not found. Please ensure PostgreSQL is installed and running on port 5432"
    echo "   You can install with: brew install postgresql (macOS) or apt-get install postgresql (Ubuntu)"
fi

# Check if Redis is running (assumes local installation)
if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Redis not found. Please ensure Redis is installed and running on port 6379"
    echo "   You can install with: brew install redis (macOS) or apt-get install redis-server (Ubuntu)"
fi

# Set environment variables for local development
export NODE_ENV=development
export DATABASE_URL="postgresql://sentinel:password@localhost:5432/sentinel_db"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="sentinel-local-secret-2024"
export API_KEY="sentinel-api-key-2024"

echo "📦 Installing dependencies..."

# Install API dependencies
cd api
npm install
echo "✅ API dependencies installed"

# Build API
echo "🔨 Building API..."
npm run build

# Run migrations and seeding
echo "🗄️  Setting up database..."
npm run migrate
npm run seed
echo "✅ Database setup complete"

# Start API server in background
echo "🚀 Starting API server..."
npm start &
API_PID=$!
cd ..

# Install Web dependencies
echo "📦 Installing web dependencies..."
cd web
npm install
echo "✅ Web dependencies installed"

# Start web server
echo "🌐 Starting web server..."
npm run dev &
WEB_PID=$!
cd ..

echo ""
echo "✅ Sentinel Support Console is now running!"
echo ""
echo "🔗 Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   API:      http://localhost:3001"
echo "   Health:   http://localhost:3001/health"
echo ""
echo "📊 Monitoring (if enabled):"
echo "   Prometheus: http://localhost:9091"
echo "   Grafana:    http://localhost:3002 (admin/admin)"
echo ""
echo "⚠️  Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $API_PID 2>/dev/null
    kill $WEB_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Trap Ctrl+C and cleanup
trap cleanup INT

# Wait for processes
wait