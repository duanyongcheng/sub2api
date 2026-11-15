-- 251_iq_detection_remove_truncation_verdict.sql
-- 移除基于 reasoning_tokens 硬截断的限智/降智判罚，历史记录统一按答案正确率重新对齐结论

UPDATE iq_detection_runs
SET verdict = CASE
        WHEN graded_count <= 0 THEN 'error'
        WHEN correct_count = graded_count THEN 'normal'
        WHEN correct_count = 0 OR correct_count * 2 < graded_count THEN 'degraded'
        ELSE 'warning'
    END,
    truncated_count = 0
WHERE truncated_count > 0
   OR (graded_count > 0 AND correct_count = graded_count AND verdict <> 'normal');
