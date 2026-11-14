# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Administrators manage upstream AI accounts, groups, request routing, billing and operational issues. End users manage API keys and consume the gateway. These facts are evidenced by the existing routes, types and product copy; this record does not introduce new product commitments.

## Product Purpose

Sub2API manages access to multiple AI providers through an API gateway. Account administration maintains account availability, credentials, quotas, concurrency and group membership.

## Operating Context

Administrators inspect groups of accounts, check remaining capacity, investigate upstream errors, test connections, update account configuration and perform bulk actions. Accounts can belong to multiple groups. The repository's previously approved account-pool design establishes pool-oriented browsing for the accounts redesign.

## Capabilities and Constraints

- Existing Vue 3 / TypeScript application with server-side account search, filters, sorting and pagination.
- Existing account creation, editing, import/export, cross-page selection, batch editing, token refresh and provider-specific actions must remain reachable.
- Account quota formats vary by provider. Account billing and customer deductions are separate amounts.
- Group capacity summaries describe schedulable group members; groups overlap and must not be summed into a unique global count.
- Simple mode omits advanced billing and group-capacity operations.
- Unknown values, loading, errors and confirmed zero are different states. Preview data cannot become production metrics.
- Chinese and English localization and existing light/dark themes are supported.

## Brand Commitments

Sub2API is the existing product name. The surrounding admin application uses an established teal brand, shared shell, semantic design tokens and platform icons. The accounts redesign is scoped to its workspace.

## Evidence on Hand

- Existing implementation in `frontend/src/views/admin/AccountsView.vue` and related account components.
- Approved account-pool prototype in `design-prototypes/14-admin-account-pools.html` and its screenshot fixtures.
- Prior design decisions and rollback boundaries in `.trellis/tasks/11-10-accounts-redesign/` (local development records).
- API contracts in `frontend/src/api/admin/accounts.ts`, `frontend/src/api/admin/groups.ts` and `frontend/src/types/index.ts`.

## Product Principles

- Make operational scope explicit before presenting totals or actions.
- Prioritize account availability, quota and capacity in routine inspection.
- Preserve advanced actions through clear secondary entry points.
- Preserve server filtering, lightweight loading and user-saved preferences.
