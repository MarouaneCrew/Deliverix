# ADR-0010: V1 business decisions
Status: Accepted
Date: 2026-10-06

## Context
Decisions recorded from discovery.

## Decision
Drivers are contractors under dispatcher command. Merchants may have a login or not; a dispatcher can create a merchant record and attach a login later. Returns are reverse legs through the hubs. The receiver pays the shipping fee at delivery (collected together with COD). The dispatcher confirms COD cash handover. A merchant may submit parcels in a batch with different destinations. Multi-leg delivery is required in V1.

## Consequences
Pricing is a per-company city-pair tariff.