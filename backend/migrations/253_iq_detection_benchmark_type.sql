-- 253_iq_detection_benchmark_type.sql
-- 支持多评测题型（黑袋摸糖推理题 candy_logic 与 鹈鹕骑自行车 SVG 2D 动画 pelican_svg）及结构化评分字段

ALTER TABLE iq_detection_config
    ADD COLUMN IF NOT EXISTS benchmark_type VARCHAR(32) NOT NULL DEFAULT 'candy_logic';

ALTER TABLE iq_detection_config
    DROP CONSTRAINT IF EXISTS chk_iq_detection_config_benchmark_type;

ALTER TABLE iq_detection_config
    ADD CONSTRAINT chk_iq_detection_config_benchmark_type
    CHECK (benchmark_type IN ('candy_logic', 'pelican_svg'));

ALTER TABLE iq_detection_runs
    ADD COLUMN IF NOT EXISTS benchmark_type VARCHAR(32) NOT NULL DEFAULT 'candy_logic',
    ADD COLUMN IF NOT EXISTS avg_score DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_iq_detection_runs_benchmark_created
    ON iq_detection_runs (benchmark_type, created_at DESC);
