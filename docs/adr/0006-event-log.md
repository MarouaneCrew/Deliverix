# ADR-0006: Append-only parcel event log
Status: Accepted
Date: 2026-10-06

## Context
Tracking, audit and analytics all need "what happened and when".

## Decision
Every parcel state/custody change inserts a `ParcelEvent` row in the same transaction. Rows are never updated or deleted by application code.

## Consequences
All write paths must go through domain services.