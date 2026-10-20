#!/bin/sh
# Least-privilege role for the API, the only component that talks to the database.
# It can insert tickets, read them and change their state; it can't delete rows,
# alter the schema or modify the encrypted data or the AI classification afterwards.
#
# The password comes from a Docker secret file (or $API_DB_PASSWORD in CI), so
# nothing secret lives in the repo or in environment variables of the container.
set -eu

API_PW="${API_DB_PASSWORD:-$(cat /run/secrets/api_db_password)}"

psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
     -v api_pw="$API_PW" <<'SQL'
CREATE ROLE panel_api LOGIN PASSWORD :'api_pw';
GRANT CONNECT ON DATABASE triage TO panel_api;
GRANT USAGE ON SCHEMA public TO panel_api;
GRANT SELECT, INSERT ON tickets TO panel_api;
GRANT UPDATE (estado) ON tickets TO panel_api;
GRANT USAGE ON SEQUENCE tickets_id_seq TO panel_api;
SQL
