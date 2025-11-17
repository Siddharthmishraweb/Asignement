#!/bin/bash

echo "🧪 Testing the fixed triage stream termination..."

# Test 1: Start triage
echo "1. Starting triage..."
RESPONSE=$(curl -s -H "X-API-Key: sentinel-api-key-2024" -X POST http://localhost:3003/api/triage/start \
  -H "Content-Type: application/json" \
  -d '{"customerId": "12345", "issueDescription": "Test stream termination fix", "priority": "high"}')

if [[ $? -ne 0 ]]; then
  echo "❌ Failed to start triage"
  exit 1
fi

echo "Response: $RESPONSE"

# Extract runId from response
RUN_ID=$(echo "$RESPONSE" | sed -n 's/.*"runId":"\([^"]*\)".*/\1/p')

if [[ -z "$RUN_ID" ]]; then
  echo "❌ No runId found in response"
  exit 1
fi

echo "✅ Triage started with runId: $RUN_ID"

# Test 2: Stream events with timeout
echo "2. Testing stream with completion termination..."
TIMEOUT_DURATION=30

echo "Streaming events for up to $TIMEOUT_DURATION seconds..."
timeout $TIMEOUT_DURATION curl -s -H "X-API-Key: sentinel-api-key-2024" \
  "http://localhost:3003/api/triage/stream?runId=$RUN_ID" \
  --no-buffer | while read -r line; do
  
  if [[ "$line" =~ ^data: ]]; then
    DATA=$(echo "$line" | sed 's/^data: //')
    EVENT_TYPE=$(echo "$DATA" | sed -n 's/.*"type":"\([^"]*\)".*/\1/p')
    TIMESTAMP=$(date '+%H:%M:%S')
    
    echo "[$TIMESTAMP] Event: $EVENT_TYPE"
    
    # Check for completion
    if [[ "$EVENT_TYPE" == "stream_complete" ]]; then
      echo "✅ Stream completed normally"
      break
    fi
  fi
done

echo ""
echo "3. Waiting 5 seconds to check for excessive polling..."
sleep 5

echo "🔍 Test completed. Check backend logs for any continued polling messages."
echo ""
echo "Expected behavior:"
echo "- ✅ Stream should terminate after sending 'stream_complete' event"
echo "- ✅ No 'Stream completed or ended, not scheduling next poll' messages after completion"
echo "- ✅ No further HTTP requests to /stream endpoint"