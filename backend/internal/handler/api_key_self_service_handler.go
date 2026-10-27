package handler

import (
	"log/slog"

	"github.com/Wei-Shaw/sub2api/internal/handler/dto"
	"github.com/Wei-Shaw/sub2api/internal/pkg/ip"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/gin-gonic/gin"
)

type switchAPIKeyGroupRequest struct {
	GroupID int64 `json:"group_id" binding:"required,gt=0"`
}

type apiKeyAvailableGroup struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	Platform string `json:"platform"`
}

// GetSelfAvailableGroups lists the owning user's available groups for this key.
// GET /v1/key/groups
func (h *APIKeyHandler) GetSelfAvailableGroups(c *gin.Context) {
	apiKey, ok := middleware.GetAPIKeyFromContext(c)
	if !ok || apiKey == nil {
		response.Unauthorized(c, "API key not authenticated")
		return
	}
	groups, err := h.apiKeyService.GetAvailableGroups(c.Request.Context(), apiKey.UserID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	out := make([]apiKeyAvailableGroup, 0, len(groups))
	for i := range groups {
		group := dto.GroupFromService(&groups[i]).Localized(c.GetHeader("Accept-Language"))
		out = append(out, apiKeyAvailableGroup{ID: group.ID, Name: group.Name, Platform: group.Platform})
	}
	response.Success(c, out)
}

// SwitchSelfGroup changes the group of the key used to authenticate this request.
// PUT /v1/key/group
func (h *APIKeyHandler) SwitchSelfGroup(c *gin.Context) {
	apiKey, ok := middleware.GetAPIKeyFromContext(c)
	if !ok || apiKey == nil {
		response.Unauthorized(c, "API key not authenticated")
		return
	}
	var req switchAPIKeyGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "group_id must be a positive integer")
		return
	}
	updated, err := h.apiKeyService.SwitchGroup(c.Request.Context(), apiKey.ID, apiKey.UserID, req.GroupID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	var previousGroupID int64
	if apiKey.GroupID != nil {
		previousGroupID = *apiKey.GroupID
	}
	slog.InfoContext(c.Request.Context(), "api_key.group_switched",
		"api_key_id", apiKey.ID, "user_id", apiKey.UserID,
		"previous_group_id", previousGroupID, "group_id", updated.Group.ID,
		"ip", ip.GetSecurityClientIP(c, false))
	group := dto.GroupFromService(updated.Group).Localized(c.GetHeader("Accept-Language"))
	response.Success(c, gin.H{
		"api_key_id": updated.ID,
		"group_id":   group.ID,
		"group_name": group.Name,
	})
}
