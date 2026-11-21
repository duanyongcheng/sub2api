package migrations

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIQDetectionUserVisibleMigration(t *testing.T) {
	content, err := FS.ReadFile("255_iq_detection_user_visible.sql")
	require.NoError(t, err)

	sql := strings.Join(strings.Fields(string(content)), " ")
	require.Contains(t, sql, "ALTER TABLE iq_detection_config")
	require.Contains(t, sql, "ADD COLUMN IF NOT EXISTS user_visible BOOLEAN NOT NULL DEFAULT false")
}
