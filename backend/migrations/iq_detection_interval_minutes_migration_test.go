package migrations

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIQDetectionIntervalMinutesMigration(t *testing.T) {
	content, err := FS.ReadFile("250_iq_detection_interval_minutes.sql")
	require.NoError(t, err)

	sql := strings.Join(strings.Fields(string(content)), " ")
	require.Contains(t, sql, "ADD COLUMN IF NOT EXISTS interval_minutes INT")
	require.Contains(t, sql, "WHEN interval_hours IN (1, 6, 12, 24) THEN interval_hours * 60")
	require.Contains(t, sql, "ALTER COLUMN interval_minutes SET DEFAULT 720")
	require.Contains(t, sql, "ALTER COLUMN interval_minutes SET NOT NULL")
	require.Contains(t, sql, "DROP CONSTRAINT IF EXISTS iq_detection_config_interval_hours_check")
	require.Contains(t, sql, "DROP CONSTRAINT IF EXISTS chk_iq_detection_config_interval_minutes")
	require.Contains(t, sql, "ADD CONSTRAINT chk_iq_detection_config_interval_minutes CHECK (interval_minutes IN (30, 60, 360, 720, 1440))")
}
