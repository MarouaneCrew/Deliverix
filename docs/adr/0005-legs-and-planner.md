# ADR-0005: Routes are legs produced by a planner module
Status: Accepted
Date: 2026-10-06

## Context
Parcels travel pickup → linehaul → delivery, sometimes fewer legs, and return trips reverse them.

## Decision
A leg is `(type PICKUP/LINEHAUL/DELIVERY, direction FORWARD/RETURN, from, to, sequence)`. A `routing` module computes legs. Re-planning marks old unfinished legs SUPERSEDED (kept forever) and creates new ones; history is never edited.

## Consequences
The planner is real code with table-driven tests.