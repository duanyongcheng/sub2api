package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

func keySelfServiceLimitRouter(p *APIKeySelfServiceRateLimiter, key *service.APIKey, called *int) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		if key != nil {
			c.Set(string(ContextKeyAPIKey), key)
		}
		c.Next()
	})
	handler := func(c *gin.Context) {
		*called++
		c.Status(http.StatusOK)
	}
	r.GET("/groups", p.ListGroups(), handler)
	r.PUT("/group", p.SwitchGroup(), handler)
	// Ordinary inference never mounts the self-service limiter.
	r.POST("/responses", handler)
	return r
}

func keySelfServiceLimitRequest(r *gin.Engine, method, path string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(method, path, nil))
	return w
}

func TestKeySelfServiceRateLimitPerKeyAndOperation(t *testing.T) {
	redisServer := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	p := NewAPIKeySelfServiceRateLimiter(client)
	calledA, calledB := 0, 0
	// Same company user and source IP, different employee keys.
	a := keySelfServiceLimitRouter(p, &service.APIKey{ID: 1, UserID: 7}, &calledA)
	b := keySelfServiceLimitRouter(p, &service.APIKey{ID: 2, UserID: 7}, &calledB)
	for i := 0; i < keySelfServiceListRPM; i++ {
		require.Equal(t, http.StatusOK, keySelfServiceLimitRequest(a, http.MethodGet, "/groups").Code)
	}
	w := keySelfServiceLimitRequest(a, http.MethodGet, "/groups")
	require.Equal(t, http.StatusTooManyRequests, w.Code)
	require.Contains(t, w.Body.String(), "API_KEY_SELF_SERVICE_RATE_LIMITED")
	require.Equal(t, "60", w.Header().Get("Retry-After"))
	require.Equal(t, keySelfServiceListRPM, calledA)
	require.Equal(t, http.StatusOK, keySelfServiceLimitRequest(b, http.MethodGet, "/groups").Code)

	for i := 0; i < keySelfServiceSwitchRPM; i++ {
		require.Equal(t, http.StatusOK, keySelfServiceLimitRequest(a, http.MethodPut, "/group").Code)
	}
	require.Equal(t, http.StatusTooManyRequests, keySelfServiceLimitRequest(a, http.MethodPut, "/group").Code)
	require.Equal(t, keySelfServiceListRPM+keySelfServiceSwitchRPM, calledA)
	require.Equal(t, http.StatusOK, keySelfServiceLimitRequest(b, http.MethodPut, "/group").Code)
	require.Equal(t, http.StatusOK, keySelfServiceLimitRequest(a, http.MethodPost, "/responses").Code)

	redisServer.FastForward(1500 * time.Millisecond)
	w = keySelfServiceLimitRequest(a, http.MethodGet, "/groups")
	require.Equal(t, "59", w.Header().Get("Retry-After"), "round remaining TTL up to seconds")
	redisServer.FastForward(time.Minute)
	require.Equal(t, http.StatusOK, keySelfServiceLimitRequest(a, http.MethodGet, "/groups").Code)
	require.Equal(t, http.StatusOK, keySelfServiceLimitRequest(a, http.MethodPut, "/group").Code)
}

func TestKeySelfServiceRateLimitSharedAcrossInstances(t *testing.T) {
	redisServer := miniredis.RunT(t)
	called := 0
	newInstance := func() *gin.Engine {
		client := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
		t.Cleanup(func() { _ = client.Close() })
		return keySelfServiceLimitRouter(NewAPIKeySelfServiceRateLimiter(client), &service.APIKey{ID: 42}, &called)
	}
	a, b := newInstance(), newInstance()
	for i := 0; i < keySelfServiceSwitchRPM; i++ {
		instance := a
		if i%2 != 0 {
			instance = b
		}
		require.Equal(t, http.StatusOK, keySelfServiceLimitRequest(instance, http.MethodPut, "/group").Code)
	}
	require.Equal(t, http.StatusTooManyRequests, keySelfServiceLimitRequest(a, http.MethodPut, "/group").Code)
	require.Equal(t, http.StatusTooManyRequests, keySelfServiceLimitRequest(b, http.MethodPut, "/group").Code)
	require.Equal(t, keySelfServiceSwitchRPM, called)
}

func TestKeySelfServiceRateLimitFailsClosed(t *testing.T) {
	redisServer := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	require.NoError(t, client.Close())
	for _, p := range []*APIKeySelfServiceRateLimiter{nil, NewAPIKeySelfServiceRateLimiter(nil), NewAPIKeySelfServiceRateLimiter(client)} {
		called := 0
		r := keySelfServiceLimitRouter(p, &service.APIKey{ID: 1}, &called)
		w := keySelfServiceLimitRequest(r, http.MethodPut, "/group")
		require.Equal(t, http.StatusServiceUnavailable, w.Code)
		require.Equal(t, "5", w.Header().Get("Retry-After"))
		require.Contains(t, w.Body.String(), "API_KEY_SELF_SERVICE_UNAVAILABLE")
		require.Zero(t, called)
	}
}

func TestKeySelfServiceRateLimitRequiresAuthenticatedKey(t *testing.T) {
	redisServer := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	for _, key := range []*service.APIKey{nil, {ID: 0}} {
		called := 0
		r := keySelfServiceLimitRouter(NewAPIKeySelfServiceRateLimiter(client), key, &called)
		require.Equal(t, http.StatusUnauthorized, keySelfServiceLimitRequest(r, http.MethodGet, "/groups").Code)
		require.Zero(t, called)
	}
	require.Empty(t, redisServer.Keys(), "unauthenticated callers must not allocate limit buckets")
}
