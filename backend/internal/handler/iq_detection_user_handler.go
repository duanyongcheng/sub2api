package handler

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
)

// IQDetectionUserHandler 用户侧只读智商检测视图（/api/v1/iq-detection/*）。
// 只读：不提供任何触发检测或修改配置的入口；访问受管理员「对用户可见」开关与用户可用分组双重约束。
type IQDetectionUserHandler struct {
	svc           *service.IQDetectionService
	apiKeyService iqDetectionUserGroupAuthorizer
}

// iqDetectionUserGroupAuthorizer 复用站内统一的「用户可用分组」口径（与 /groups/available、渠道监控一致）。
type iqDetectionUserGroupAuthorizer interface {
	GetAvailableGroups(ctx context.Context, userID int64) ([]service.Group, error)
}

// NewIQDetectionUserHandler 创建 IQDetectionUserHandler。
func NewIQDetectionUserHandler(svc *service.IQDetectionService, apiKeyService *service.APIKeyService) *IQDetectionUserHandler {
	h := &IQDetectionUserHandler{svc: svc}
	if apiKeyService != nil {
		h.apiKeyService = apiKeyService
	}
	return h
}

// GetVisibility GET /api/v1/iq-detection/visibility
func (h *IQDetectionUserHandler) GetVisibility(c *gin.Context) {
	if h.svc == nil {
		response.Success(c, service.IQDetectionPublicVisibility{Enabled: false})
		return
	}
	visibility, err := h.svc.GetUserVisibility(c.Request.Context())
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, visibility)
}

// GetOverview GET /api/v1/iq-detection/overview
func (h *IQDetectionUserHandler) GetOverview(c *gin.Context) {
	if h.svc == nil {
		response.ErrorFrom(c, service.ErrIQDetectionNotPublic)
		return
	}
	// 先执行可见性守卫，避免在功能关闭时仍查询用户分组
	if !h.ensurePublic(c) {
		return
	}
	groups, ok := h.availableGroups(c)
	if !ok {
		return
	}
	overview, err := h.svc.GetPublicOverview(c.Request.Context(), groups)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, overview)
}

// ListRuns GET /api/v1/iq-detection/runs?group_id=&benchmark_type=&page=1&page_size=20
func (h *IQDetectionUserHandler) ListRuns(c *gin.Context) {
	if h.svc == nil {
		response.ErrorFrom(c, service.ErrIQDetectionNotPublic)
		return
	}
	if !h.ensurePublic(c) {
		return
	}

	page, pageSize := response.ParsePagination(c)
	if pageSize > 100 {
		pageSize = 100
	}

	var groupID int64
	if rawGroupID := strings.TrimSpace(c.Query("group_id")); rawGroupID != "" {
		parsed, err := strconv.ParseInt(rawGroupID, 10, 64)
		if err != nil || parsed < 0 {
			response.BadRequest(c, "invalid group_id")
			return
		}
		groupID = parsed
	}

	groups, ok := h.availableGroups(c)
	if !ok {
		return
	}

	items, total, err := h.svc.ListPublicRuns(c.Request.Context(), groups, service.IQDetectionRunFilter{
		GroupID:       groupID,
		BenchmarkType: strings.TrimSpace(c.Query("benchmark_type")),
		Page:          page,
		PageSize:      pageSize,
	})
	if err != nil {
		if errors.Is(err, service.ErrIQDetectionInvalidConfig) {
			response.BadRequest(c, err.Error())
			return
		}
		response.ErrorFrom(c, err)
		return
	}
	response.Paginated(c, items, total, page, pageSize)
}

func (h *IQDetectionUserHandler) ensurePublic(c *gin.Context) bool {
	visibility, err := h.svc.GetUserVisibility(c.Request.Context())
	if err != nil {
		response.ErrorFrom(c, err)
		return false
	}
	if !visibility.Enabled {
		response.ErrorFrom(c, service.ErrIQDetectionNotPublic)
		return false
	}
	return true
}

func (h *IQDetectionUserHandler) availableGroups(c *gin.Context) ([]service.Group, bool) {
	if h.apiKeyService == nil {
		response.Error(c, http.StatusInternalServerError, "iq detection group authorization unavailable")
		return nil, false
	}
	subject, ok := middleware.GetAuthSubjectFromContext(c)
	if !ok || subject.UserID <= 0 {
		response.Unauthorized(c, "user not found in context")
		return nil, false
	}
	groups, err := h.apiKeyService.GetAvailableGroups(c.Request.Context(), subject.UserID)
	if err != nil {
		response.ErrorFrom(c, err)
		return nil, false
	}
	return groups, true
}
