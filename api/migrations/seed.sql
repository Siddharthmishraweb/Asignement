-- Seed data for Sentinel Support Database
-- This script adds sample data for development and testing

BEGIN;

-- Insert sample customers (with valid email format)
INSERT INTO customers (id, name, email_masked, kyc_level, created_at, updated_at) VALUES
  (uuid_generate_v4(), 'John Doe', 'john.doe@example.com', 'ENHANCED', NOW() - INTERVAL '30 days', NOW()),
  (uuid_generate_v4(), 'Jane Smith', 'jane.smith@example.com', 'PREMIUM', NOW() - INTERVAL '25 days', NOW()),
  (uuid_generate_v4(), 'Bob Wilson', 'bob.wilson@example.com', 'BASIC', NOW() - INTERVAL '20 days', NOW()),
  (uuid_generate_v4(), 'Alice Johnson', 'alice.johnson@example.com', 'ENHANCED', NOW() - INTERVAL '15 days', NOW()),
  (uuid_generate_v4(), 'Charlie Brown', 'charlie.brown@example.com', 'BASIC', NOW() - INTERVAL '10 days', NOW());

-- Insert sample cards for customers
INSERT INTO cards (id, customer_id, last4, network, status, created_at, updated_at)
SELECT 
  uuid_generate_v4(),
  c.id,
  (CASE 
    WHEN random() < 0.3 THEN '1234'
    WHEN random() < 0.6 THEN '5678'
    ELSE '9012'
  END),
  (CASE 
    WHEN random() < 0.4 THEN 'VISA'
    WHEN random() < 0.7 THEN 'MASTERCARD'
    WHEN random() < 0.9 THEN 'AMEX'
    ELSE 'DISCOVER'
  END),
  'ACTIVE',
  c.created_at + INTERVAL '1 day',
  c.created_at + INTERVAL '1 day'
FROM customers c;

-- Insert sample accounts for customers  
INSERT INTO accounts (id, customer_id, balance_cents, currency, created_at, updated_at)
SELECT 
  uuid_generate_v4(),
  c.id,
  (random() * 100000 + 10000)::BIGINT, -- Random balance between $100-$1000
  'USD',
  c.created_at + INTERVAL '1 day',
  c.created_at + INTERVAL '1 day'
FROM customers c;

-- Insert sample transactions
INSERT INTO transactions (id, customer_id, card_id, account_id, mcc, merchant, amount_cents, currency, ts, country, city, status, created_at)
SELECT 
  uuid_generate_v4(),
  c.id,
  card.id,
  acc.id,
  (CASE 
    WHEN random() < 0.2 THEN '5411' -- Grocery
    WHEN random() < 0.4 THEN '5812' -- Restaurants
    WHEN random() < 0.6 THEN '5541' -- Gas stations
    WHEN random() < 0.8 THEN '5311' -- Department stores
    ELSE '5999' -- Miscellaneous
  END),
  (CASE 
    WHEN random() < 0.2 THEN 'Walmart Supercenter'
    WHEN random() < 0.4 THEN 'McDonalds Restaurant'
    WHEN random() < 0.6 THEN 'Shell Gas Station'
    WHEN random() < 0.8 THEN 'Target Store'
    ELSE 'Amazon.com'
  END),
  (random() * 10000 + 500)::BIGINT, -- Random amount $5-$100
  'USD',
  NOW() - (random() * INTERVAL '30 days'),
  'US',
  (CASE 
    WHEN random() < 0.3 THEN 'New York'
    WHEN random() < 0.6 THEN 'Los Angeles'
    ELSE 'Chicago'
  END),
  'COMPLETED',
  NOW() - (random() * INTERVAL '30 days')
FROM customers c
CROSS JOIN LATERAL (SELECT id FROM cards WHERE customer_id = c.id LIMIT 1) card
CROSS JOIN LATERAL (SELECT id FROM accounts WHERE customer_id = c.id LIMIT 1) acc
CROSS JOIN generate_series(1, (random() * 10 + 5)::int); -- 5-15 transactions per customer

-- Insert sample alerts (using correct schema)
INSERT INTO alerts (id, customer_id, suspect_txn_id, risk_score, risk_level, status, reasons, metadata, created_at)
SELECT 
  uuid_generate_v4(),
  t.customer_id,
  t.id,
  (random() * 100)::int,
  (CASE 
    WHEN random() < 0.1 THEN 'CRITICAL'
    WHEN random() < 0.3 THEN 'HIGH'
    WHEN random() < 0.7 THEN 'MEDIUM'
    ELSE 'LOW'
  END)::risk_level,
  (CASE 
    WHEN random() < 0.6 THEN 'OPEN'
    WHEN random() < 0.8 THEN 'INVESTIGATING'
    ELSE 'RESOLVED'
  END)::alert_status,
  jsonb_build_array(
    CASE 
      WHEN random() < 0.4 THEN 'suspicious_amount'
      WHEN random() < 0.7 THEN 'velocity_check'
      ELSE 'unusual_location'
    END
  ),
  jsonb_build_object(
    'confidence', 0.85,
    'rule_triggered', 'ML_FRAUD_001',
    'title', CASE 
      WHEN random() < 0.4 THEN 'Suspicious Transaction Detected'
      WHEN random() < 0.7 THEN 'Velocity Limit Exceeded'
      ELSE 'Unusual Location Activity'
    END,
    'description', CASE 
      WHEN random() < 0.4 THEN 'Transaction appears fraudulent based on spending patterns'
      WHEN random() < 0.7 THEN 'Multiple transactions in short time period'
      ELSE 'Transaction from unusual geographic location'
    END
  ),
  t.created_at + INTERVAL '1 hour'
FROM (
  SELECT * FROM transactions 
  WHERE random() < 0.3 -- Only create alerts for ~30% of transactions
  ORDER BY created_at DESC 
  LIMIT 20
) t;

-- Insert sample cases (using correct schema)
INSERT INTO cases (id, customer_id, txn_id, alert_id, type, status, description, created_at, updated_at)
SELECT 
  uuid_generate_v4(),
  a.customer_id,
  a.suspect_txn_id,
  a.id,
  'DISPUTE'::case_type,
  (CASE 
    WHEN random() < 0.4 THEN 'OPEN'
    WHEN random() < 0.7 THEN 'PENDING_CUSTOMER'
    ELSE 'RESOLVED'
  END)::case_status,
  'Customer dispute regarding suspicious transaction',
  a.created_at + INTERVAL '2 hours',
  a.created_at + INTERVAL '2 hours'
FROM (
  SELECT * FROM alerts 
  WHERE suspect_txn_id IS NOT NULL
  ORDER BY created_at DESC 
  LIMIT 10
) a;

-- Add some frozen cards
UPDATE cards 
SET status = 'FROZEN', frozen_at = NOW(), frozen_by = 'security_system'
WHERE random() < 0.1;

-- Insert evaluation scenarios as specified in the document
INSERT INTO evaluations (name, description, status, score, test_cases, last_run, created_at, updated_at) VALUES
  ('Fraud Detection Accuracy', 'Test model performance on detecting fraudulent transactions', 'completed', 94.2, 150, NOW() - INTERVAL '1 day', NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day'),
  ('Risk Scoring Precision', 'Evaluate risk scoring algorithm accuracy', 'running', NULL, 200, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '9 days', NOW() - INTERVAL '2 hours'),
  ('Customer Sentiment Analysis', 'Test sentiment analysis on customer communications', 'completed', 87.5, 100, NOW() - INTERVAL '3 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 days'),
  ('Transaction Pattern Recognition', 'Evaluate model ability to identify suspicious transaction patterns', 'completed', 92.8, 175, NOW() - INTERVAL '2 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '2 days'),
  ('Identity Verification', 'Test accuracy of identity verification algorithms', 'completed', 96.1, 120, NOW() - INTERVAL '4 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '4 days'),
  ('Money Laundering Detection', 'Evaluate AML model performance on complex transaction chains', 'completed', 89.7, 300, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  ('Freeze Card OTP Path', 'Test freeze card functionality with OTP verification', 'completed', 98.5, 50, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '4 days', NOW() - INTERVAL '6 hours'),
  ('Dispute Creation Workflow', 'Test automatic dispute creation for unrecognized transactions', 'completed', 91.3, 75, NOW() - INTERVAL '8 hours', NOW() - INTERVAL '3 days', NOW() - INTERVAL '8 hours'),
  ('Duplicate Transaction Detection', 'Test detection of duplicate vs legitimate pending/captured charges', 'completed', 88.9, 85, NOW() - INTERVAL '12 hours', NOW() - INTERVAL '2 days', NOW() - INTERVAL '12 hours'),
  ('Risk Tool Fallback', 'Test system behavior when risk analysis tools timeout', 'completed', 82.4, 40, NOW() - INTERVAL '18 hours', NOW() - INTERVAL '1 day', NOW() - INTERVAL '18 hours'),
  ('Rate Limiting Behavior', 'Test API rate limiting and 429 response handling', 'completed', 95.7, 30, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  ('PII Redaction Compliance', 'Test PAN and sensitive data redaction across all components', 'completed', 99.1, 65, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '6 hours');

COMMIT;