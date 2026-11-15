package migrations

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIQDetectionRemoveTruncationVerdictMigration(t *testing.T) {
	content, err := FS.ReadFile("251_iq_detection_remove_truncation_verdict.sql")
	require.NoError(t, err)

	sql := strings.Join(strings.Fields(string(content)), " ")
	require.Contains(t, sql, "UPDATE iq_detection_runs")
	require.Contains(t, sql, "WHEN correct_count = graded_count THEN 'normal'")
	require.Contains(t, sql, "truncated_count = 0")
}
