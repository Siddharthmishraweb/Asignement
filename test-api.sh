#!/bin/bash

# Test script for Sentinel Support API endpoints
API_BASE="http://localhost:3002"
API_KEY="sentinel-api-key-2024"

echo "🔍 Testing Sentinel Support API Endpoints"
echo "========================================="

# Test health endpoint
echo "✅ Testing /health..."
curl -s "${API_BASE}/health" | head -3

echo -e "\n"

# Test metrics endpoint
echo "✅ Testing /metrics..."
curl -s "${API_BASE}/metrics" | head -5

echo -e "\n"

# Test customers endpoint  
echo "✅ Testing /api/customers..."
curl -s "${API_BASE}/api/customers?limit=3" -H "X-API-Key: ${API_KEY}" | head -3

echo -e "\n"

# Test dashboard endpoint
echo "✅ Testing /api/dashboard/metrics..."
curl -s "${API_BASE}/api/dashboard/metrics" -H "X-API-Key: ${API_KEY}" | head -3

echo -e "\n"

# Test KB search endpoint
echo "✅ Testing /api/kb/search..."
curl -s "${API_BASE}/api/kb/search?q=dispute" -H "X-API-Key: ${API_KEY}" | head -3

echo -e "\n"

# Test alerts endpoint
echo "✅ Testing /api/alerts..."
curl -s "${API_BASE}/api/alerts?limit=3" -H "X-API-Key: ${API_KEY}" | head -3

echo -e "\n"

# Test triage endpoint with POST
echo "✅ Testing POST /api/triage..."
curl -s -X POST "${API_BASE}/api/triage" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"alertId": "aba7807e-46bb-4b2a-89f8-ba0ceaee5e5e", "customerId": "236de623-3c98-420c-a44a-a3651ec32bce"}' \
  --max-time 5

echo -e "\n\n🎉 API endpoint tests complete!"