package admin

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
)

// IQDetectionHandler 管理后台智商检测（Codex 降智抽检）HTTP 处理器。
type IQDetectionHandler struct {
	svc *service.IQDetectionService
}

// NewIQDetectionHandler 创建 IQDetectionHandler。
func NewIQDetectionHandler(svc *service.IQDetectionService) *IQDetectionHandler {
	return &IQDetectionHandler{svc: svc}
}

// GetConfig GET /api/v1/admin/iq-detection/config
func (h *IQDetectionHandler) GetConfig(c *gin.Context) {
	cfg, err := h.svc.GetConfig(c.Request.Context())
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, cfg)
}

// UpdateConfig PUT /api/v1/admin/iq-detection/config
func (h *IQDetectionHandler) UpdateConfig(c *gin.Context) {
	var input service.IQDetectionConfig
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "invalid iq detection config payload")
		return
	}

	var actorID int64
	if subject, ok := middleware.GetAuthSubjectFromContext(c); ok && subject.UserID > 0 {
		actorID = subject.UserID
	}

	updated, err := h.svc.UpdateConfig(c.Request.Context(), input, input.Version, actorID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrIQDetectionConfigConflict):
			response.Error(c, http.StatusConflict, err.Error())
		case errors.Is(err, service.ErrIQDetectionInvalidConfig):
			response.BadRequest(c, err.Error())
		default:
			response.ErrorFrom(c, err)
		}
		return
	}
	response.Success(c, updated)
}

// GetOverview GET /api/v1/admin/iq-detection/overview
func (h *IQDetectionHandler) GetOverview(c *gin.Context) {
	overview, err := h.svc.GetOverview(c.Request.Context())
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, overview)
}

// ListRuns GET /api/v1/admin/iq-detection/runs
func (h *IQDetectionHandler) ListRuns(c *gin.Context) {
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

	verdict := strings.TrimSpace(c.Query("verdict"))
	items, total, err := h.svc.ListRuns(c.Request.Context(), service.IQDetectionRunFilter{
		GroupID:  groupID,
		Verdict:  verdict,
		Page:     page,
		PageSize: pageSize,
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

// RunNow POST /api/v1/admin/iq-detection/run
func (h *IQDetectionHandler) RunNow(c *gin.Context) {
	var input service.IQDetectionRunNowInput
	if err := c.ShouldBindJSON(&input); err != nil && !errors.Is(err, io.EOF) {
		response.BadRequest(c, "invalid run request payload")
		return
	}

	result, err := h.svc.RunNow(c.Request.Context(), input)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrIQDetectionNoGroups),
			errors.Is(err, service.ErrIQDetectionInvalidConfig):
			response.BadRequest(c, err.Error())
		default:
			response.ErrorFrom(c, err)
		}
		return
	}
	response.Success(c, result)
}
