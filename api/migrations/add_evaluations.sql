-- Add evaluation tables to existing database
-- This creates the evaluation functionality as per the document requirements

DO $$ 
BEGIN
    -- Create enum type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evaluation_status') THEN
        CREATE TYPE evaluation_status AS ENUM ('pending', 'running', 'completed', 'failed');
    END IF;
END $$;

-- Evaluations table to track different test scenarios
CREATE TABLE IF NOT EXISTS evaluations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status evaluation_status NOT NULL DEFAULT 'pending',
    score DECIMAL(5,2), -- percentage score (0.00 to 100.00)
    test_cases INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_run TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- Evaluation results table to store detailed test results
CREATE TABLE IF NOT EXISTS evaluation_results (
    id SERIAL PRIMARY KEY,
    evaluation_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    run_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    test_case_name VARCHAR(255) NOT NULL,
    expected_result JSONB NOT NULL,
    actual_result JSONB NOT NULL,
    passed BOOLEAN NOT NULL,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evaluation metrics table for storing performance metrics
CREATE TABLE IF NOT EXISTS evaluation_metrics (
    id SERIAL PRIMARY KEY,
    evaluation_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    run_id UUID NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for evaluations
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status);
CREATE INDEX IF NOT EXISTS idx_evaluations_updated_at ON evaluations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluation_results_evaluation_id ON evaluation_results(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_results_run_id ON evaluation_results(run_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_metrics_evaluation_id ON evaluation_metrics(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_metrics_run_id ON evaluation_metrics(run_id);

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
  ('PII Redaction Compliance', 'Test PAN and sensitive data redaction across all components', 'completed', 99.1, 65, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '6 hours')
ON CONFLICT DO NOTHING;