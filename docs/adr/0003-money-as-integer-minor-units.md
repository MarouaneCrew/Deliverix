# ADR-0003: Money is integer centimes
Status: Accepted
Date: 2026-10-06

## Context
Floats cannot represent decimal money exactly and break cash reconciliation. 1 MAD = 100 centimes.

## Decision
All money columns are `Int` in centimes, named `...Minor`, with a `currency` code (default `MAD`) where a currency applies.

## Consequences
Display layer divides by 100.