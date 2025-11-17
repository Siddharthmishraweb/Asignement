#!/bin/bash

echo "🔍 Testing the exact API call that's failing..."

echo "Calling POST /api/triage/ with the provided data..."

response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sentinel-api-key-2024" \
  -X POST http://localhost:3003/api/triage/ \
  -d '{"alertId":"8e312c22-cbb2-4185-85a2-18d291fdf98b","customerId":"79d5b304-2f49-4c54-aa6d-8f0bca131673"}')

# Extract HTTP code and response body
http_code=$(echo "$response" | tail -n1 | sed 's/HTTP_CODE://')
response_body=$(echo "$response" | head -n -1)

echo "HTTP Code: $http_code"
echo "Response: $response_body"

if [[ "$http_code" -eq 500 ]]; then
  echo ""
  echo "❌ Internal Server Error detected!"
  echo "Let's check the backend logs..."
  echo ""
fi