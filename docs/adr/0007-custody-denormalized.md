# ADR-0007: Current custody stored on the parcel
Status: Accepted
Date: 2026-10-06

## Context
Dispatchers need "which parcels are at my hub" fast.

## Decision
`Parcel.custodianType/custodianId` hold the current custodian; the event log holds history. Both change in one transaction.

## Consequences
Two places to keep consistent; one transaction guarantees it.