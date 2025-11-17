#!/bin/bash

echo "🔍 Testing API endpoints after fixes..."

# Test triage start
echo "1. Testing triage start API..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sentinel-api-key-2024" \
  -X POST http://localhost:3003/api/triage/ \
  -d '{"alertId":"test-123","customerId":"customer-456"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1 | sed 's/HTTP_CODE://')
RESPONSE_BODY=$(echo "$RESPONSE" | head -n -1)

echo "HTTP Code: $HTTP_CODE"
echo "Response: $RESPONSE_BODY"

if [[ "$HTTP_CODE" -eq 200 ]]; then
  echo "✅ Triage start API working correctly"
  
  # Extract runId for stream test
  RUN_ID=$(echo "$RESPONSE_BODY" | grep -o '"runId":"[^"]*"' | cut -d'"' -f4)
  
  if [[ -n "$RUN_ID" ]]; then
    echo "📡 Testing stream API for runId: $RUN_ID"
    
    # Test stream endpoint briefly
    timeout 5s curl -s -H "X-API-Key: sentinel-api-key-2024" \
      "http://localhost:3003/api/triage/$RUN_ID/stream?apiKey=sentinel-api-key-2024" \
      | head -5
    
    echo ""
    echo "✅ Stream API responding"
  else
    echo "❌ No runId found in response"
  fi
else
  echo "❌ Triage start API failed with HTTP $HTTP_CODE"
  echo "Response: $RESPONSE_BODY"
fi

echo ""
echo "🌐 Frontend running at: http://localhost:3001"
echo "🔧 Backend running at: http://localhost:3003"