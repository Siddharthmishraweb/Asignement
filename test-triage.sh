#!/bin/bash

echo "🔍 Testing the Start AI Triage flow..."

# Wait for servers to start
sleep 3

echo "1. Testing backend health..."
HEALTH=$(curl -s http://localhost:3003/health | head -c 100)
if [[ $HEALTH == *"healthy"* ]]; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend not healthy: $HEALTH"
    exit 1
fi

echo "2. Testing frontend proxy..."
PROXY_HEALTH=$(curl -s http://localhost:3000/api/health | head -c 100)
if [[ $PROXY_HEALTH == *"healthy"* ]]; then
    echo "✅ Frontend proxy working"
else
    echo "❌ Frontend proxy failed: $PROXY_HEALTH"
fi

echo "3. Testing triage start..."
TRIAGE_RESULT=$(curl -s -X POST http://localhost:3000/api/triage/ \
    -H 'Content-Type: application/json' \
    -H 'X-API-Key: sentinel-api-key-2024' \
    -d '{"alertId":"test-alert","customerId":"test-customer"}')

if [[ $TRIAGE_RESULT == *"runId"* ]]; then
    echo "✅ Triage start working"
    echo "Response: $TRIAGE_RESULT"
else
    echo "❌ Triage start failed: $TRIAGE_RESULT"
fi

echo ""
echo "🎉 Test complete! Open http://localhost:3000 in your browser."
echo "📋 Go to Alerts → Click any alert → Click 'Start AI Triage'"