package timezone

import (
	"strings"
	"time"
)

// ParseDateRangeBoundary accepts a calendar date in the user's timezone or an
// RFC3339 timestamp. Only calendar end dates advance to the next day's start.
func ParseDateRangeBoundary(value, userTZ string, end bool) (time.Time, error) {
	value = strings.TrimSpace(value)
	if len(value) != len("2006-01-02") {
		return time.Parse(time.RFC3339Nano, value)
	}
	t, err := ParseInUserLocation("2006-01-02", value, userTZ)
	if err != nil {
		return time.Time{}, err
	}
	if end {
		t = t.AddDate(0, 0, 1)
	}
	return t, nil
}

// FormatDateRangeBoundary preserves timestamp precision in response metadata
// while retaining inclusive calendar end dates for date-only clients.
func FormatDateRangeBoundary(t time.Time, input string, end bool) string {
	if strings.Contains(strings.TrimSpace(input), "T") {
		return t.UTC().Format(time.RFC3339Nano)
	}
	if end {
		t = t.AddDate(0, 0, -1)
	}
	return t.Format("2006-01-02")
}
