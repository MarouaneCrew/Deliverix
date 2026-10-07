# ADR-0001: Tenant-ready, single company in V1
Status: Accepted
Date: 2026-10-06

## Context
V1 serves one delivery company; a SaaS model for many companies is plausible later and retrofitting tenancy into populated tables is costly and risks cross-company data leaks.

## Decision
A `Company` table exists with one row. Every tenant-owned table has a required `companyId`. Services take `companyId` as the first parameter and filter every query by it (it comes from the authenticated user, never from client input). `City` is shared reference data and has no `companyId`. User email stays globally unique.

## Consequences
Slightly more code per query; mandatory cross-company isolation tests per module.