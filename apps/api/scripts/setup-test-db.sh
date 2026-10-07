#!/usr/bin/env bash
set -euo pipefail
# Creates the deliverix_test database inside the docker postgres container if it does not exist.
CONTAINER="${POSTGRES_CONTAINER:-deliverix-postgres}"
PG_USER="${POSTGRES_USER:-deliverix}"
exists=$(docker exec "$CONTAINER" psql -U "$PG_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='deliverix_test'")
if [ "$exists" != "1" ]; then
  docker exec "$CONTAINER" psql -U "$PG_USER" -d postgres -c "CREATE DATABASE deliverix_test"
  echo "Created deliverix_test"
else
  echo "deliverix_test already exists"
fi