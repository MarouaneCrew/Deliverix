# ADR-0004: Lifecycles are state machines in domain code
Status: Accepted
Date: 2026-10-06

## Context
A database enum allows any value in any order.

## Decision
Parcel, Leg, Run, Assignment and cash-collection statuses change only through one domain function per aggregate that checks an allowed-transition table, then writes the status and an event in one transaction. Direct `update({ status })` is forbidden outside that function.

## Consequences
A transition table + tests per aggregate.