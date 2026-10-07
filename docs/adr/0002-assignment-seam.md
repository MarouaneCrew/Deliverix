# ADR-0002: Driver assignment goes through one seam
Status: Accepted
Date: 2026-10-06

## Context
V1 drivers are contractors who obey the dispatcher; later, freelancers will accept or reject offers.

## Decision
In V1 an assignment is created only through one service function `assignDriver`. Assignment statuses in V1: ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED. No accept/reject exists. A later version swaps the function's policy and adds OFFERED/ACCEPTED/REJECTED/EXPIRED. `Driver.engagement` is CONTRACTOR in V1.

## Consequences
No `mode` column now (it can be added later with default DIRECT).