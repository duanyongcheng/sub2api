-- 255_iq_detection_user_visible.sql
-- 智商检测「对用户可见」开关：默认关闭；开启后普通用户可在 /iq-detection 只读查看其可用分组的检测结果

ALTER TABLE iq_detection_config
    ADD COLUMN IF NOT EXISTS user_visible BOOLEAN NOT NULL DEFAULT false;
