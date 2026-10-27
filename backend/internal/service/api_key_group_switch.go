package service

import (
	"context"
	"fmt"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
)

// SwitchGroup changes only the authenticated key's group. The caller must derive
// keyID and userID from API key authentication, never from the request body.
func (s *APIKeyService) SwitchGroup(ctx context.Context, keyID, userID, groupID int64) (*APIKey, error) {
	if groupID <= 0 {
		return nil, infraerrors.BadRequest("INVALID_GROUP_ID", "group_id must be positive")
	}
	apiKey, err := s.apiKeyRepo.GetByID(ctx, keyID)
	if err != nil {
		return nil, fmt.Errorf("get api key: %w", err)
	}
	if apiKey.UserID != userID {
		return nil, ErrInsufficientPerms
	}
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}
	group, err := s.groupRepo.GetByID(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("get group: %w", err)
	}
	if !group.IsActive() {
		return nil, infraerrors.BadRequest("GROUP_NOT_ACTIVE", "target group is not active")
	}
	if !s.canUserBindGroup(ctx, user, group) {
		return nil, ErrGroupNotAllowed
	}

	apiKey.GroupID = &groupID
	apiKey.Group = group
	if err := s.apiKeyRepo.Update(ctx, apiKey, APIKeyUpdateFields{GroupID: true}); err != nil {
		return nil, fmt.Errorf("update api key group: %w", err)
	}
	s.InvalidateAuthCacheByKey(ctx, apiKey.Key)
	return apiKey, nil
}
