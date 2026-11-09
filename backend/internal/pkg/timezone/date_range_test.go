package timezone

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestParseDateRangeBoundary(t *testing.T) {
	for _, tc := range []struct {
		name, value, zone, expected string
		end                         bool
	}{
		{"date start in user timezone", "2026-11-08", "Asia/Shanghai", "2026-11-07T16:00:00Z", false},
		{"date end includes entire day", "2026-11-09", "Asia/Shanghai", "2026-11-09T16:00:00Z", true},
		{"spring DST end advances calendar day", "2026-03-08", "America/New_York", "2026-03-09T04:00:00Z", true},
		{"fall DST end advances calendar day", "2026-11-01", "America/New_York", "2026-11-02T05:00:00Z", true},
		{"UTC timestamp preserves milliseconds", "2026-11-09T07:30:45.123Z", "Asia/Shanghai", "2026-11-09T07:30:45.123Z", true},
		{"offset timestamp ignores user timezone", "2026-11-09T15:30:45.123+08:00", "America/New_York", "2026-11-09T07:30:45.123Z", true},
		{"midnight timestamp end stays exact", "2026-11-09T00:00:00Z", "Asia/Shanghai", "2026-11-09T00:00:00Z", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ParseDateRangeBoundary(tc.value, tc.zone, tc.end)
			require.NoError(t, err)
			want, err := time.Parse(time.RFC3339Nano, tc.expected)
			require.NoError(t, err)
			require.True(t, want.Equal(got), "want %s, got %s", want, got)
		})
	}
	for _, value := range []string{"", "2026-02-30", "2026-11-09Tbad", "2026-11-09T12:00:00", "2026-11-09T25:00:00Z"} {
		_, err := ParseDateRangeBoundary(value, "UTC", true)
		require.Error(t, err, value)
	}
}

func TestFormatDateRangeBoundary(t *testing.T) {
	for _, input := range []string{"2026-03-08", "2026-11-01"} {
		end, err := ParseDateRangeBoundary(input, "America/New_York", true)
		require.NoError(t, err)
		require.Equal(t, input, FormatDateRangeBoundary(end, input, true))
	}
	timestamp := "2026-11-09T07:30:45.123Z"
	end, err := ParseDateRangeBoundary(timestamp, "Asia/Shanghai", true)
	require.NoError(t, err)
	require.Equal(t, timestamp, FormatDateRangeBoundary(end, timestamp, true))
}
