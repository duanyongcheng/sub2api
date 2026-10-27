//go:build unit

package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type selectionGroupRepo struct {
	GroupRepository
	fullCalls, selectionCalls int
	groups                    []Group
	err                       error
}

func (r *selectionGroupRepo) ListActive(context.Context) ([]Group, error) {
	r.fullCalls++
	return r.groups, r.err
}

func (r *selectionGroupRepo) ListActiveForSelection(context.Context) ([]Group, error) {
	r.selectionCalls++
	out := make([]Group, 0, len(r.groups))
	for _, group := range r.groups {
		out = append(out, Group{ID: group.ID, Name: group.Name, Platform: group.Platform, I18n: group.I18n,
			IsExclusive: group.IsExclusive, SubscriptionType: group.SubscriptionType, Status: group.Status})
	}
	return out, r.err
}

func TestKeyGroupSelectionKeepsPageQueryAndPermissions(t *testing.T) {
	for _, restricted := range []bool{true, false} {
		t.Run(map[bool]string{true: "restricted", false: "public"}[restricted], func(t *testing.T) {
			repo := &selectionGroupRepo{groups: []Group{
				{ID: 1, Name: "Public", Status: StatusActive, RateMultiplier: 1.5, AccountCount: 5, Description: "page"},
				{ID: 2, Name: "Allowed exclusive", IsExclusive: true, AccountCount: 8},
				{ID: 3, Name: "Forbidden exclusive", IsExclusive: true},
				{ID: 4, Name: "Other public"},
				{ID: 5, Name: "Active subscription", SubscriptionType: SubscriptionTypeSubscription, IsExclusive: true},
				{ID: 6, Name: "Expired subscription", SubscriptionType: SubscriptionTypeSubscription},
				{ID: 7, Name: "Another user's subscription", SubscriptionType: SubscriptionTypeSubscription},
			}}
			subs := &visibilitySubRepo{subscriptions: []UserSubscription{
				{UserID: 9, GroupID: 5, Status: SubscriptionStatusActive, ExpiresAt: time.Now().Add(time.Hour)},
				{UserID: 9, GroupID: 6, Status: SubscriptionStatusActive, ExpiresAt: time.Now().Add(-time.Hour)},
				{UserID: 10, GroupID: 7, Status: SubscriptionStatusActive, ExpiresAt: time.Now().Add(time.Hour)},
			}}
			svc := &APIKeyService{groupRepo: repo, userSubRepo: subs,
				userRepo: &visibilityUserRepo{user: &User{ID: 9, AllowedGroups: []int64{1, 2}, RestrictPublicGroups: restricted}}}
			pageGroups, err := svc.GetAvailableGroups(context.Background(), 9)
			require.NoError(t, err)
			require.Equal(t, 1, repo.fullCalls)
			require.Zero(t, repo.selectionCalls)
			require.EqualValues(t, 5, pageGroups[0].AccountCount)
			require.Equal(t, 1.5, pageGroups[0].RateMultiplier)
			require.Equal(t, "page", pageGroups[0].Description)

			keyGroups, err := svc.GetAvailableGroupsForKey(context.Background(), 9)
			require.NoError(t, err)
			require.Equal(t, 1, repo.fullCalls, "self-service must not call the page query")
			require.Equal(t, 1, repo.selectionCalls)
			wantIDs := []int64{1, 2, 5}
			if !restricted {
				wantIDs = []int64{1, 2, 4, 5}
			}
			for _, groups := range [][]Group{pageGroups, keyGroups} {
				ids := make([]int64, 0, len(groups))
				for _, group := range groups {
					ids = append(ids, group.ID)
				}
				require.Equal(t, wantIDs, ids)
			}
			require.Zero(t, keyGroups[0].AccountCount)
		})
	}
}

func TestKeyGroupSelectionErrorsDoNotFallBackToHeavyQuery(t *testing.T) {
	failure := errors.New("database unavailable")
	for _, phase := range []string{"user", "groups", "subscriptions"} {
		t.Run(phase, func(t *testing.T) {
			user := &visibilityUserRepo{user: &User{ID: 1}}
			repo := &selectionGroupRepo{}
			subs := &visibilitySubRepo{}
			switch phase {
			case "user":
				user.err = failure
			case "groups":
				repo.err = failure
			case "subscriptions":
				subs.err = failure
			}
			svc := &APIKeyService{userRepo: user, groupRepo: repo, userSubRepo: subs}
			groups, err := svc.GetAvailableGroupsForKey(context.Background(), 1)
			require.ErrorIs(t, err, failure)
			require.Nil(t, groups)
			require.Zero(t, repo.fullCalls)
		})
	}
	// A repository without the capability must not silently fall back to stats.
	svc := &APIKeyService{groupRepo: &visibilityGroupRepo{}}
	_, err := svc.GetAvailableGroupsForKey(context.Background(), 1)
	require.ErrorContains(t, err, "lightweight selection")
}
