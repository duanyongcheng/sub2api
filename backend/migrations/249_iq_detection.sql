-- 249_iq_detection.sql
-- 管理端智商检测（Codex 降智抽检）单例配置表与分组抽检记录表

CREATE TABLE IF NOT EXISTS iq_detection_config (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    interval_hours INT NOT NULL DEFAULT 12 CHECK (interval_hours IN (6, 12, 24)),
    group_ids BIGINT[] NOT NULL DEFAULT '{}',
    model VARCHAR(128) NOT NULL DEFAULT 'gpt-5.4',
    reasoning_effort VARCHAR(32) NOT NULL DEFAULT 'medium',
    tests_per_group INT NOT NULL DEFAULT 1 CHECK (tests_per_group BETWEEN 1 AND 5),
    version BIGINT NOT NULL DEFAULT 1,
    last_scheduled_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by BIGINT NULL
);

INSERT INTO iq_detection_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS iq_detection_runs (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL,
    group_name VARCHAR(255) NOT NULL DEFAULT '',
    platform VARCHAR(64) NOT NULL DEFAULT 'openai',
    trigger_type VARCHAR(32) NOT NULL DEFAULT 'manual',
    requested_model VARCHAR(128) NOT NULL DEFAULT '',
    reasoning_effort VARCHAR(32) NOT NULL DEFAULT 'medium',
    tests_count INT NOT NULL DEFAULT 0,
    graded_count INT NOT NULL DEFAULT 0,
    correct_count INT NOT NULL DEFAULT 0,
    truncated_count INT NOT NULL DEFAULT 0,
    verdict VARCHAR(32) NOT NULL DEFAULT 'error',
    avg_input_tokens INT NOT NULL DEFAULT 0,
    avg_output_tokens INT NOT NULL DEFAULT 0,
    avg_reasoning_tokens INT NOT NULL DEFAULT 0,
    avg_latency_ms INT NOT NULL DEFAULT 0,
    avg_tps DOUBLE PRECISION NOT NULL DEFAULT 0,
    response_model VARCHAR(128) NOT NULL DEFAULT '',
    answer_preview TEXT NOT NULL DEFAULT '',
    error_message TEXT NOT NULL DEFAULT '',
    samples JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iq_detection_runs_group_created
    ON iq_detection_runs (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_iq_detection_runs_created
    ON iq_detection_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_iq_detection_runs_verdict_created
    ON iq_detection_runs (verdict, created_at DESC);
