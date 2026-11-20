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

const pelicanSandboxHTTPCSP = "sandbox allow-scripts; default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self';"

var pelicanSandboxHostHTML = []byte(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:;">
<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;}</style>
</head>
<body>
<script>
(function(){
  if (window.self === window.top) return;
  var rendered = false;
  window.addEventListener('message', function(e) {
    if (rendered || e.source !== window.parent) return;
    var data = e.data;
    if (!data || data.type !== 'iq-pelican-sandbox-render' || typeof data.html !== 'string') return;
    rendered = true;
    document.open();
    document.write(data.html);
    document.close();
  });
  function notifyReady() {
    window.parent.postMessage({ type: 'iq-pelican-sandbox-ready' }, '*');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', notifyReady);
  } else {
    notifyReady();
  }
})();
</script>
</body>
</html>`)

// NewIQDetectionHandler 创建 IQDetectionHandler。
func NewIQDetectionHandler(svc *service.IQDetectionService) *IQDetectionHandler {
	return &IQDetectionHandler{svc: svc}
}

// ServePelicanSandbox GET /api/v1/iq-detection-sandbox
// 提供用于渲染“鹈鹕骑自行车 SVG 2D 动画”工件的独立断网沙箱承载页。
// 通过独立 HTTP CSP（sandbox allow-scripts + default-src 'none' + script-src 'unsafe-inline'）避免
// iframe srcdoc 继承主站 nonce-only script-src 导致模型内联 JS 动画全部被拦截，同时保证无同源与无联网权限。
func (h *IQDetectionHandler) ServePelicanSandbox(c *gin.Context) {
	c.Header("Cache-Control", "public, max-age=3600")
	c.Header("Referrer-Policy", "no-referrer")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("X-Frame-Options", "SAMEORIGIN")
	c.Header("Cross-Origin-Resource-Policy", "same-origin")
	c.Header("Content-Security-Policy", pelicanSandboxHTTPCSP)
	c.Data(http.StatusOK, "text/html; charset=utf-8", pelicanSandboxHostHTML)
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
	var req struct {
		service.IQDetectionConfig
		IntervalMinutesPtr  *int `json:"interval_minutes"`
		LegacyIntervalHours *int `json:"interval_hours"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid iq detection config payload")
		return
	}
	input := req.IQDetectionConfig
	switch {
	case req.IntervalMinutesPtr != nil:
		if *req.IntervalMinutesPtr <= 0 {
			input.IntervalMinutes = -1
		} else {
			input.IntervalMinutes = *req.IntervalMinutesPtr
		}
	case req.LegacyIntervalHours != nil:
		if *req.LegacyIntervalHours <= 0 {
			input.IntervalMinutes = -1
		} else {
			input.IntervalMinutes = *req.LegacyIntervalHours * 60
		}
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
	benchmarkType := strings.TrimSpace(c.Query("benchmark_type"))
	items, total, err := h.svc.ListRuns(c.Request.Context(), service.IQDetectionRunFilter{
		GroupID:       groupID,
		Verdict:       verdict,
		BenchmarkType: benchmarkType,
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
