-- 254_iq_detection_multi_benchmarks.sql
-- 支持「黑袋摸糖推理题」与「鹈鹕骑自行车 SVG 2D 动画」多题型同时勾选启用（benchmark_types TEXT[]）

ALTER TABLE iq_detection_config
    ADD COLUMN IF NOT EXISTS benchmark_types TEXT[] NOT NULL DEFAULT ARRAY['candy_logic']::TEXT[];

UPDATE iq_detection_config
SET benchmark_types = CASE
    WHEN benchmark_type IN ('candy_logic', 'pelican_svg') THEN ARRAY[benchmark_type]::TEXT[]
    ELSE ARRAY['candy_logic']::TEXT[]
END
WHERE COALESCE(array_length(benchmark_types, 1), 0) = 0
   OR (
       array_length(benchmark_types, 1) = 1
       AND benchmark_types[1] = 'candy_logic'
       AND benchmark_type = 'pelican_svg'
   );

ALTER TABLE iq_detection_config
    DROP CONSTRAINT IF EXISTS chk_iq_detection_config_benchmark_types;

ALTER TABLE iq_detection_config
    ADD CONSTRAINT chk_iq_detection_config_benchmark_types
    CHECK (
        COALESCE(array_length(benchmark_types, 1), 0) >= 1
        AND benchmark_types <@ ARRAY['candy_logic', 'pelican_svg']::TEXT[]
    );
