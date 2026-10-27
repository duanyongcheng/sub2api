package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	ratelimit "github.com/Wei-Shaw/sub2api/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

const (
	keySelfServiceListRPM      = 30
	keySelfServiceSwitchRPM    = 10
	keySelfServiceWindow       = time.Minute
	keySelfServiceRedisTimeout = 2 * time.Second
	keySelfServiceFailureRetry = "5"
)

// APIKeySelfServiceRateLimiter protects only key management endpoints, after
// authentication. Key IDs (not credentials/IPs) isolate employees sharing a user
// or network. Separate Redis buckets keep reads and writes independent.
type APIKeySelfServiceRateLimiter struct {
	limiter *ratelimit.RateLimiter
}

func NewAPIKeySelfServiceRateLimiter(client *redis.Client) *APIKeySelfServiceRateLimiter {
	p := &APIKeySelfServiceRateLimiter{}
	if client != nil {
		p.limiter = ratelimit.NewRateLimiter(client)
	}
	return p
}

func (p *APIKeySelfServiceRateLimiter) ListGroups() gin.HandlerFunc {
	return p.limit("groups", keySelfServiceListRPM)
}

func (p *APIKeySelfServiceRateLimiter) SwitchGroup() gin.HandlerFunc {
	return p.limit("switch_group", keySelfServiceSwitchRPM)
}

func (p *APIKeySelfServiceRateLimiter) limit(scope string, limit int) gin.HandlerFunc {
	return func(c *gin.Context) {
		key, ok := GetAPIKeyFromContext(c)
		if !ok || key == nil || key.ID <= 0 {
			AbortWithError(c, http.StatusUnauthorized, "API_KEY_REQUIRED", "API key authentication is required")
			return
		}
		if p == nil || p.limiter == nil {
			abortKeySelfServiceUnavailable(c)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), keySelfServiceRedisTimeout)
		result, err := p.limiter.Allow(ctx, "key_self_service:"+scope+":"+strconv.FormatInt(key.ID, 10), limit, keySelfServiceWindow)
		cancel()
		if err != nil {
			// Unlike inference, this optional management surface fails closed so
			// a Redis outage cannot turn it into unbounded database traffic.
			slog.WarnContext(c.Request.Context(), "key self-service rate limit unavailable", "scope", scope, "error", err)
			abortKeySelfServiceUnavailable(c)
			return
		}
		if !result.Allowed {
			retry := result.RetryAfter
			if retry <= 0 {
				retry = keySelfServiceWindow
			}
			seconds := int64((retry + time.Second - 1) / time.Second)
			c.Header("Retry-After", strconv.FormatInt(seconds, 10))
			AbortWithError(c, http.StatusTooManyRequests, "API_KEY_SELF_SERVICE_RATE_LIMITED", "Too many key management requests; retry later")
			return
		}
		c.Next()
	}
}

func abortKeySelfServiceUnavailable(c *gin.Context) {
	c.Header("Retry-After", keySelfServiceFailureRetry)
	AbortWithError(c, http.StatusServiceUnavailable, "API_KEY_SELF_SERVICE_UNAVAILABLE", "Key management is temporarily unavailable; retry later")
}
