-- 250_iq_detection_interval_minutes.sql
-- 扩展管理端智商检测定时巡检间隔周期：支持 30 分钟、1 小时、6 小时、12 小时、24 小时

ALTER TABLE iq_detection_config
    ADD COLUMN IF NOT EXISTS interval_minutes INT;

UPDATE iq_detection_config
SET interval_minutes = CASE
    WHEN interval_hours IN (1, 6, 12, 24) THEN interval_hours * 60
    ELSE 720
END
WHERE interval_minutes IS NULL;

ALTER TABLE iq_detection_config
    ALTER COLUMN interval_minutes SET DEFAULT 720,
    ALTER COLUMN interval_minutes SET NOT NULL;

ALTER TABLE iq_detection_config
    DROP CONSTRAINT IF EXISTS iq_detection_config_interval_hours_check;

ALTER TABLE iq_detection_config
    DROP CONSTRAINT IF EXISTS chk_iq_detection_config_interval_minutes;

ALTER TABLE iq_detection_config
    ADD CONSTRAINT chk_iq_detection_config_interval_minutes
    CHECK (interval_minutes IN (30, 60, 360, 720, 1440));
