#!/bin/bash

echo "Starting backend server on port 8080..."
cd /Users/fc470770/Desktop/ans/sentinel-support/api
export DATABASE_URL="postgresql://sentinel:password@localhost:5432/sentinel_db"
export REDIS_URL="redis://localhost:6379"
export API_KEY="sentinel-api-key-2024"
export PORT=8080
node dist/index.js &
BACKEND_PID=$!

echo "Backend started with PID: $BACKEND_PID on port 8080"

echo "Starting frontend server..."
cd /Users/fc470770/Desktop/ans/sentinel-support/web
export VITE_PROXY_TARGET="http://localhost:8080"
export VITE_API_URL="http://localhost:8080"
export VITE_PORT=3000
npm run dev &
FRONTEND_PID=$!

echo "Frontend started with PID: $FRONTEND_PID"
echo "Backend running on port 8080"
echo "Frontend running on port 3000"
echo "Press Ctrl+C to stop both servers"

# Wait for interrupt
wait $BACKEND_PID $FRONTEND_PID