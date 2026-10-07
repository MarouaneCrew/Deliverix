# ADR-0008: RBAC plus scoped policies, no ABAC engine
Status: Accepted
Date: 2026-10-06

## Context
Roles alone cannot express "dispatcher of this hub" or "merchant's own parcels".

## Decision
Roles via `@Roles` (handler-level). Scope checks are explicit code in services: dispatcher by `hubId`, merchant by own merchant id, driver by own assignments. Cross-tenant/cross-scope ids return 404.

## Consequences
Every query must apply its scope; covered by tests.