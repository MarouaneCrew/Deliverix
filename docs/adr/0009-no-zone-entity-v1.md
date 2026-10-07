# ADR-0009: No Zone entity in V1
Status: Accepted
Date: 2026-10-06

## Context
A hub belongs to one city and each dispatcher to one hub.

## Decision
No `Zone` table; routing assumes exactly one active hub per city.

## Consequences
If a city later needs several zones/hubs this is an additive change.