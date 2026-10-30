//go:build unit

package service

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

type switchGroupKeyRepo struct {
	APIKeyRepository
	key     *APIKey
	updated bool
}

func (r *switchGroupKeyRepo) GetByID(context.Context, int64) (*APIKey, error) {
	key := *r.key
	return &key, nil
}

func (r *switchGroupKeyRepo) Update(_ context.Context, key *APIKey, fields APIKeyUpdateFields) error {
	r.updated = true
	r.key = key
	return nil
}

type switchGroupRepo struct {
	GroupRepository
	group *Group
}

func (r switchGroupRepo) GetByID(context.Context, int64) (*Group, error) { return r.group, nil }

type switchGroupSubRepo struct {
	UserSubscriptionRepository
	sub *UserSubscription
	err error
}

func (r switchGroupSubRepo) GetActiveByUserIDAndGroupID(context.Context, int64, int64) (*UserSubscription, error) {
	return r.sub, r.err
}

func TestAPIKeySwitchGroupChecksOwnershipBeforeWriting(t *testing.T) {
	repo := &switchGroupKeyRepo{key: &APIKey{ID: 1, UserID: 7}}
	svc := &APIKeyService{apiKeyRepo: repo}
	_, err := svc.SwitchGroup(context.Background(), 1, 8, 12)
	require.ErrorIs(t, err, ErrInsufficientPerms)
	require.False(t, repo.updated)
}

func TestAPIKeySwitchGroupCannotUnbind(t *testing.T) {
	svc := &APIKeyService{}
	for _, id := range []int64{0, -1} {
		_, err := svc.SwitchGroup(context.Background(), 1, 7, id)
		require.Error(t, err)
	}
}

func TestAPIKeySwitchGroupRequiresSubscription(t *testing.T) {
	for _, tc := range []struct {
		name string
		err  error
	}{
		{"active subscription", nil},
		{"no active subscription", ErrSubscriptionNotFound},
		{"subscription lookup fails closed", errors.New("unavailable")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			group := &Group{ID: 12, Status: StatusActive, SubscriptionType: SubscriptionTypeSubscription, IsExclusive: true}
			repo := &switchGroupKeyRepo{key: &APIKey{ID: 1, UserID: 7, Key: "sk-employee"}}
			svc := &APIKeyService{apiKeyRepo: repo,
				userRepo:    &visibilityUserRepo{user: &User{ID: 7}},
				groupRepo:   switchGroupRepo{group: group},
				userSubRepo: switchGroupSubRepo{err: tc.err, sub: &UserSubscription{UserID: 7, GroupID: 12}},
			}
			updated, err := svc.SwitchGroup(context.Background(), 1, 7, 12)
			if tc.err != nil {
				require.ErrorIs(t, err, ErrGroupNotAllowed)
				require.False(t, repo.updated)
				return
			}
			require.NoError(t, err)
			require.True(t, repo.updated)
			require.Equal(t, int64(12), *updated.GroupID)
		})
	}
}
