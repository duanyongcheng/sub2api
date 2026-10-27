package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/handler"
	servermiddleware "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

type keyGroupRouteRepo struct {
	service.APIKeyRepository
	key       *service.APIKey
	fields    []service.APIKeyUpdateFields
	authCalls int
}

func (r *keyGroupRouteRepo) GetByKeyForAuth(_ context.Context, key string) (*service.APIKey, error) {
	r.authCalls++
	if key != r.key.Key {
		return nil, service.ErrAPIKeyNotFound
	}
	clone := *r.key
	return &clone, nil
}

func (r *keyGroupRouteRepo) GetByID(_ context.Context, id int64) (*service.APIKey, error) {
	if id != r.key.ID {
		return nil, service.ErrAPIKeyNotFound
	}
	clone := *r.key
	return &clone, nil
}

func (r *keyGroupRouteRepo) Update(_ context.Context, key *service.APIKey, fields service.APIKeyUpdateFields) error {
	r.fields = append(r.fields, fields)
	if fields.GroupID {
		r.key.GroupID = key.GroupID
		r.key.Group = key.Group
	}
	return nil
}

func (r *keyGroupRouteRepo) UpdateLastUsed(context.Context, int64, time.Time) error { return nil }

type keyGroupRouteUserRepo struct {
	service.UserRepository
	user *service.User
}

func (r keyGroupRouteUserRepo) GetByID(_ context.Context, id int64) (*service.User, error) {
	return r.user, nil
}

type keyGroupRouteGroupRepo struct {
	service.GroupRepository
	groups []service.Group
}

func (r keyGroupRouteGroupRepo) GetByID(_ context.Context, id int64) (*service.Group, error) {
	for _, group := range r.groups {
		if group.ID == id {
			return &group, nil
		}
	}
	return nil, service.ErrGroupNotFound
}

func (r keyGroupRouteGroupRepo) ListActiveForSelection(context.Context) ([]service.Group, error) {
	groups := make([]service.Group, 0)
	for _, group := range r.groups {
		if group.IsActive() {
			groups = append(groups, group)
		}
	}
	return groups, nil
}

type keyGroupRouteSubRepo struct {
	service.UserSubscriptionRepository
}

func (keyGroupRouteSubRepo) ListActiveByUserID(context.Context, int64) ([]service.UserSubscription, error) {
	return nil, nil
}

func (keyGroupRouteSubRepo) GetActiveByUserIDAndGroupID(context.Context, int64, int64) (*service.UserSubscription, error) {
	return nil, service.ErrSubscriptionNotFound
}

type keyGroupRouteCache struct {
	service.APIKeyCache
	entries map[string]*service.APIKeyAuthCacheEntry
	deletes int
}

func (c *keyGroupRouteCache) GetAuthCache(_ context.Context, key string) (*service.APIKeyAuthCacheEntry, error) {
	return c.entries[key], nil
}

func (c *keyGroupRouteCache) SetAuthCache(_ context.Context, key string, entry *service.APIKeyAuthCacheEntry, _ time.Duration) error {
	c.entries[key] = entry
	return nil
}

func (c *keyGroupRouteCache) DeleteAuthCache(_ context.Context, key string) error {
	delete(c.entries, key)
	c.deletes++
	return nil
}

func (*keyGroupRouteCache) PublishAuthCacheInvalidation(context.Context, string) error { return nil }

type keyGroupRouteSettings struct{ service.SettingRepository }

func (keyGroupRouteSettings) GetValue(context.Context, string) (string, error) { return "false", nil }

func newKeyGroupRouteRouter(t *testing.T) (*gin.Engine, *keyGroupRouteRepo, *keyGroupRouteCache) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	user := &service.User{ID: 7, Status: service.StatusActive, Role: service.RoleUser,
		Balance: 10, RestrictPublicGroups: true, AllowedGroups: []int64{10, 12, 13}}
	groups := []service.Group{
		{ID: 10, Name: "Standard", Status: service.StatusActive, Platform: service.PlatformOpenAI, Hydrated: true},
		{ID: 12, Name: "Pro", I18n: service.GroupI18n{"zh": {Name: "专业组"}}, Status: service.StatusActive, Platform: service.PlatformOpenAI, IsExclusive: true, Hydrated: true},
		{ID: 13, Name: "Disabled", Status: "inactive"},
		{ID: 14, Name: "Other", Status: service.StatusActive, IsExclusive: true},
		{ID: 15, Name: "Subscription", Status: service.StatusActive, SubscriptionType: service.SubscriptionTypeSubscription},
		{ID: 16, Name: "Public but restricted", Status: service.StatusActive},
	}
	repo := &keyGroupRouteRepo{key: &service.APIKey{
		ID: 100, UserID: user.ID, User: user, Key: "employee-group-test-key", Status: service.StatusActive,
		Quota: 100, QuotaUsed: 30, Usage5h: 12,
	}}
	cache := &keyGroupRouteCache{entries: make(map[string]*service.APIKeyAuthCacheEntry)}
	cfg := &config.Config{RunMode: config.RunModeStandard,
		APIKeyAuth: config.APIKeyAuthCacheConfig{L2TTLSeconds: 60}}
	svc := service.NewAPIKeyService(repo, keyGroupRouteUserRepo{user: user}, keyGroupRouteGroupRepo{groups: groups}, keyGroupRouteSubRepo{}, nil, cache, cfg)
	settingService := service.NewSettingService(keyGroupRouteSettings{}, cfg)
	router := gin.New()
	rdb := redis.NewClient(&redis.Options{Addr: miniredis.RunT(t).Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	RegisterGatewayRoutes(router, &handler.Handlers{
		APIKey: handler.NewAPIKeyHandler(svc), Gateway: &handler.GatewayHandler{}, OpenAIGateway: &handler.OpenAIGatewayHandler{},
	}, servermiddleware.NewAPIKeyAuthMiddleware(svc, nil, cfg), svc, nil, nil, settingService, nil, cfg, servermiddleware.NewAPIKeySelfServiceRateLimiter(rdb))
	router.GET("/test/current-group", gin.HandlerFunc(servermiddleware.NewAPIKeyAuthMiddleware(svc, nil, cfg)), func(c *gin.Context) {
		key, ok := servermiddleware.GetAPIKeyFromContext(c)
		require.True(t, ok)
		c.JSON(http.StatusOK, gin.H{"group_id": key.GroupID})
	})
	return router, repo, cache
}

func keyGroupRouteRequest(router *gin.Engine, method, path, key, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestKeyGroupSelfServiceSwitchAndCacheInvalidation(t *testing.T) {
	router, repo, cache := newKeyGroupRouteRouter(t)
	// An unassigned key can manage groups, but cannot make ordinary API calls.
	w := keyGroupRouteRequest(router, http.MethodGet, "/v1/models", repo.key.Key, "")
	require.Equal(t, http.StatusForbidden, w.Code)
	require.Contains(t, w.Body.String(), "not assigned to any group")

	w = keyGroupRouteRequest(router, http.MethodGet, "/v1/key/groups", repo.key.Key, "")
	require.Equal(t, http.StatusOK, w.Code)
	require.Equal(t, "no-store", w.Header().Get("Cache-Control"))
	require.JSONEq(t, `{"code":0,"message":"success","data":[
		{"id":10,"name":"Standard","platform":"openai"},
		{"id":12,"name":"Pro","platform":"openai"}]}`, w.Body.String())
	lookups := repo.authCalls

	// Caller-supplied IDs/other fields cannot select another key or reset usage.
	w = keyGroupRouteRequest(router, http.MethodPut, "/v1/key/group", repo.key.Key,
		`{"group_id":12,"api_key_id":999,"quota":0,"reset_quota":true}`)
	require.Equal(t, http.StatusOK, w.Code)
	require.JSONEq(t, `{"code":0,"message":"success","data":{"api_key_id":100,"group_id":12,"group_name":"Pro"}}`, w.Body.String())
	require.Equal(t, int64(12), *repo.key.GroupID)
	require.Equal(t, []service.APIKeyUpdateFields{{GroupID: true}}, repo.fields)
	require.Equal(t, 30.0, repo.key.QuotaUsed)
	require.Equal(t, 12.0, repo.key.Usage5h)
	require.Equal(t, 1, cache.deletes)
	require.Equal(t, lookups, repo.authCalls, "self-service auth should have used the warm cache")

	// The ordinary API key auth chain must reload and see the new group.
	w = keyGroupRouteRequest(router, http.MethodGet, "/test/current-group", repo.key.Key, "")
	require.Equal(t, http.StatusOK, w.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.EqualValues(t, 12, body["group_id"])
	require.Greater(t, repo.authCalls, lookups)
}

func TestKeyGroupSelfServiceRejectsInvalidTargets(t *testing.T) {
	for _, tc := range []struct {
		body   string
		status int
		reason string
	}{
		{`{}`, 400, ""}, {`{"group_id":null}`, 400, ""},
		{`{"group_id":0}`, 400, ""}, {`{"group_id":-1}`, 400, ""},
		{`{"group_id":"12"}`, 400, ""}, {`{"group_id":1.5}`, 400, ""}, {`{`, 400, ""},
		{`{"group_id":999}`, 404, "GROUP_NOT_FOUND"},
		{`{"group_id":13}`, 400, "GROUP_NOT_ACTIVE"},
		{`{"group_id":14}`, 403, "GROUP_NOT_ALLOWED"},
		{`{"group_id":15}`, 403, "GROUP_NOT_ALLOWED"},
		{`{"group_id":16}`, 403, "GROUP_NOT_ALLOWED"},
	} {
		t.Run(tc.body, func(t *testing.T) {
			router, repo, cache := newKeyGroupRouteRouter(t)
			w := keyGroupRouteRequest(router, http.MethodPut, "/v1/key/group", repo.key.Key, tc.body)
			require.Equal(t, tc.status, w.Code, w.Body.String())
			if tc.reason != "" {
				require.Contains(t, w.Body.String(), tc.reason)
			}
			require.Empty(t, repo.fields)
			require.Nil(t, repo.key.GroupID)
			require.Zero(t, cache.deletes)
		})
	}
}

func TestKeyGroupSelfServiceCanRecoverUnavailableCurrentGroup(t *testing.T) {
	for _, state := range []string{"deleted", "inactive", "revoked", "expired subscription", "quota exhausted"} {
		t.Run(state, func(t *testing.T) {
			router, repo, _ := newKeyGroupRouteRouter(t)
			groupID := int64(99)
			repo.key.GroupID = &groupID
			switch state {
			case "inactive":
				repo.key.Group = &service.Group{ID: groupID, Status: "inactive"}
			case "revoked":
				repo.key.Group = &service.Group{ID: groupID, Status: service.StatusActive, IsExclusive: true}
			case "expired subscription":
				repo.key.Group = &service.Group{ID: groupID, Status: service.StatusActive, SubscriptionType: service.SubscriptionTypeSubscription}
			case "quota exhausted":
				repo.key.Status = service.StatusAPIKeyQuotaExhausted
				repo.key.QuotaUsed = repo.key.Quota
			}
			repo.key.User.Balance = 0
			w := keyGroupRouteRequest(router, http.MethodGet, "/v1/key/groups", repo.key.Key, "")
			require.Equal(t, http.StatusOK, w.Code, w.Body.String())
			w = keyGroupRouteRequest(router, http.MethodPut, "/v1/key/group", repo.key.Key, `{"group_id":10}`)
			require.Equal(t, http.StatusOK, w.Code, w.Body.String())
			require.Equal(t, int64(10), *repo.key.GroupID)
			if state == "quota exhausted" {
				require.Equal(t, service.StatusAPIKeyQuotaExhausted, repo.key.Status)
			}
		})
	}
}

func TestKeyGroupSelfServiceRateLimitRoutes(t *testing.T) {
	for _, tc := range []struct {
		method, path string
		limit        int
	}{
		{http.MethodGet, "/v1/key/groups", 30},
		{http.MethodPut, "/v1/key/group", 10},
	} {
		t.Run(tc.method, func(t *testing.T) {
			router, repo, _ := newKeyGroupRouteRouter(t)
			for i := 0; i < tc.limit; i++ {
				w := keyGroupRouteRequest(router, tc.method, tc.path, repo.key.Key, `{"group_id":12}`)
				require.Equal(t, http.StatusOK, w.Code, w.Body.String())
			}
			writes := len(repo.fields)
			w := keyGroupRouteRequest(router, tc.method, tc.path, repo.key.Key, `{"group_id":12}`)
			require.Equal(t, http.StatusTooManyRequests, w.Code, w.Body.String())
			require.NotEmpty(t, w.Header().Get("Retry-After"))
			require.Equal(t, writes, len(repo.fields))
		})
	}
}

func TestKeyGroupSelfServiceSelectionLocalizesNames(t *testing.T) {
	router, repo, _ := newKeyGroupRouteRouter(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/key/groups", nil)
	req.Header.Set("Authorization", "Bearer "+repo.key.Key)
	req.Header.Set("Accept-Language", "zh-CN")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), "专业组")
	require.NotContains(t, w.Body.String(), "account_count")
	require.NotContains(t, w.Body.String(), "rate_multiplier")
}

func TestKeyGroupSelfServiceStillEnforcesIdentity(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status int
	}{
		{"missing credential", 401}, {"invalid credential", 401}, {"disabled key", 401},
		{"expired key", 403}, {"expired active key", 403}, {"inactive user", 401}, {"IP restriction", 403},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, method := range []string{http.MethodGet, http.MethodPut} {
				router, repo, _ := newKeyGroupRouteRouter(t)
				key := repo.key.Key
				switch tc.name {
				case "missing credential":
					key = ""
				case "invalid credential":
					key = "invalid-key"
				case "disabled key":
					repo.key.Status = "inactive"
				case "expired key":
					repo.key.Status = service.StatusAPIKeyExpired
				case "expired active key":
					expired := time.Now().Add(-time.Hour)
					repo.key.ExpiresAt = &expired
				case "inactive user":
					repo.key.User.Status = "inactive"
				case "IP restriction":
					repo.key.IPWhitelist = []string{"10.0.0.0/8"}
				}
				path := "/v1/key/groups"
				if method == http.MethodPut {
					path = "/v1/key/group"
				}
				w := keyGroupRouteRequest(router, method, path, key, `{"group_id":12}`)
				require.Equal(t, tc.status, w.Code, w.Body.String())
				require.Empty(t, repo.fields)
			}
		})
	}
}
