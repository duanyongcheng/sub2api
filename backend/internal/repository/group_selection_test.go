package repository

import (
	"context"
	"database/sql"
	"strings"
	"testing"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/DATA-DOG/go-sqlmock"
	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

// Panics on any statistics query, including queries whose errors ListActive
// normally tolerates. A single expected SQL statement is not sufficient to
// catch an extra best-effort stats query returning an ignored mock error.
type noGroupStatsExecutor struct{}

func (noGroupStatsExecutor) QueryContext(context.Context, string, ...any) (*sql.Rows, error) {
	panic("selection must not query account statistics")
}
func (noGroupStatsExecutor) ExecContext(context.Context, string, ...any) (sql.Result, error) {
	panic("selection must not write")
}

func TestGroupSelectionProjectionDoesNotLoadAccountCounts(t *testing.T) {
	var query string
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(captureEntQueryMatcher{actual: &query}))
	require.NoError(t, err)
	client := dbent.NewClient(dbent.Driver(entsql.OpenDB(dialect.Postgres, db)))
	t.Cleanup(func() { _ = client.Close() })
	repo := &groupRepository{client: client, sql: noGroupStatsExecutor{}}
	var _ service.GroupSelectionRepository = repo
	mock.ExpectQuery("selection").WithArgs(service.StatusActive).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "i18n", "platform", "status", "is_exclusive", "subscription_type"}).
			AddRow(int64(12), "Pro", []byte(`{"zh":{"name":"专业组"}}`), "openai", "active", true, "subscription"))
	groups, err := repo.ListActiveForSelection(context.Background())
	require.NoError(t, err)
	require.Len(t, groups, 1)
	require.Equal(t, int64(12), groups[0].ID)
	require.True(t, groups[0].IsExclusive)
	require.True(t, groups[0].IsSubscriptionType())
	require.Equal(t, "专业组", groups[0].I18n.LocalizeName("zh-CN", groups[0].Name))
	require.False(t, groups[0].Hydrated)
	require.NoError(t, mock.ExpectationsWereMet())
	projection, _, found := strings.Cut(query, " FROM ")
	require.True(t, found)
	for _, field := range []string{"id", "name", "i18n", "platform", "status", "is_exclusive", "subscription_type"} {
		require.Contains(t, projection, `"groups"."`+field+`"`)
	}
	for _, excluded := range []string{"model_routing", "rate_multiplier", "profit_control_enabled", "accounts"} {
		require.NotContains(t, projection, excluded)
	}
	require.Contains(t, query, `"groups"."deleted_at" IS NULL`)
	require.Contains(t, query, `ORDER BY "groups"."sort_order" ASC, "groups"."id" ASC`)
}

func TestGroupSelectionFiltersAndOrders(t *testing.T) {
	_, client := newAPIKeyRepoSQLite(t)
	ctx := context.Background()
	late, err := client.Group.Create().SetName("Late").SetSortOrder(20).Save(ctx)
	require.NoError(t, err)
	first, err := client.Group.Create().SetName("First").SetSortOrder(10).Save(ctx)
	require.NoError(t, err)
	second, err := client.Group.Create().SetName("Second").SetSortOrder(10).Save(ctx)
	require.NoError(t, err)
	_, err = client.Group.Create().SetName("Inactive").SetStatus("inactive").SetSortOrder(0).Save(ctx)
	require.NoError(t, err)
	_, err = client.Group.Create().SetName("Deleted").SetDeletedAt(time.Now()).SetSortOrder(0).Save(ctx)
	require.NoError(t, err)
	repo := &groupRepository{client: client, sql: noGroupStatsExecutor{}}
	groups, err := repo.ListActiveForSelection(ctx)
	require.NoError(t, err)
	ids := make([]int64, 0, len(groups))
	for _, group := range groups {
		ids = append(ids, group.ID)
	}
	require.Equal(t, []int64{first.ID, second.ID, late.ID}, ids)
}

func TestGroupListActiveStillLoadsPageStatistics(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	client := dbent.NewClient(dbent.Driver(entsql.OpenDB(dialect.Postgres, db)))
	t.Cleanup(func() { _ = client.Close() })
	repo := &groupRepository{client: client, sql: db}
	mock.ExpectQuery(`SELECT .* FROM "groups"`).WithArgs(service.StatusActive).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "status", "rate_multiplier", "description"}).
			AddRow(int64(12), "Pro", "active", 1.5, "page description"))
	mock.ExpectQuery(`SELECT ag.group_id,`).WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"group_id", "total", "active", "rate_limited"}).
			AddRow(int64(12), int64(5), int64(3), int64(1)))
	groups, err := repo.ListActive(context.Background())
	require.NoError(t, err)
	require.Len(t, groups, 1)
	require.EqualValues(t, 5, groups[0].AccountCount)
	require.EqualValues(t, 3, groups[0].ActiveAccountCount)
	require.EqualValues(t, 1, groups[0].RateLimitedAccountCount)
	require.Equal(t, 1.5, groups[0].RateMultiplier)
	require.Equal(t, "page description", groups[0].Description)
	require.NoError(t, mock.ExpectationsWereMet())
}
