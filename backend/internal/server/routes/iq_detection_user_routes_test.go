package routes

import (
	"strings"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/handler"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestIQDetectionUserRoutesAreReadOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	v1 := router.Group("/api/v1")
	h := mcpRouteHandlers()
	h.IQDetectionUser = handler.NewIQDetectionUserHandler(nil, nil)

	require.NotPanics(t, func() {
		RegisterUserRoutes(v1, h, middleware.JWTAuthMiddleware(mcpRouteNext), middleware.AuditLogMiddleware(mcpRouteNext), nil, nil)
	})

	iqRoutes := map[string]bool{}
	for _, route := range router.Routes() {
		if strings.HasPrefix(route.Path, "/api/v1/iq-detection/") {
			iqRoutes[route.Method+" "+route.Path] = true
		}
	}
	require.Equal(t, map[string]bool{
		"GET /api/v1/iq-detection/visibility": true,
		"GET /api/v1/iq-detection/overview":   true,
		"GET /api/v1/iq-detection/runs":       true,
	}, iqRoutes, "user iq-detection surface must be read-only GET endpoints")
}

func TestIQDetectionUserRoutesSkippedWithoutHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	h := mcpRouteHandlers()
	h.IQDetectionUser = nil
	RegisterUserRoutes(router.Group("/api/v1"), h, middleware.JWTAuthMiddleware(mcpRouteNext), middleware.AuditLogMiddleware(mcpRouteNext), nil, nil)
	for _, route := range router.Routes() {
		require.NotContains(t, route.Path, "/api/v1/iq-detection/")
	}
}
