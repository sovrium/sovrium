# Connect Sovrium to PostgreSQL

> Point Sovrium at a PostgreSQL database instead of the SQLite default — a single `DATABASE_URL`, no config change, with automatic schema migration on boot.

Sovrium runs on an embedded SQLite database out of the box. When you need concurrent writers, replication or a managed database, point it at PostgreSQL — no config change, just one environment variable.

## Set DATABASE_URL

```bash
export DATABASE_URL="postgres://user:password@db.example.com:5432/mydb"
sovrium start app.yaml
```

When `DATABASE_URL` is set, Sovrium selects the PostgreSQL engine, connects, and applies your schema inside a transaction on boot. Unset it and Sovrium falls back to the zero-config SQLite default.

## Verify

The startup summary names the active engine — a boot log that still says SQLite means `DATABASE_URL` never reached the process. To confirm from the database side, list the tables Sovrium created:

```bash
psql "$DATABASE_URL" -c '\dt'
```

Your configured tables appear there once the app has booted. An empty result means the app connected to a different database than the one you are inspecting. For a deployed app the URL lives on the platform rather than in your shell — reach it through the host's own console.

## Next

- **Database Infrastructure** — how the dual-dialect engine picks SQLite or PostgreSQL.
- **Schema Migrations** — the boot-time migration that runs on connect.
- **Deploy with Docker Compose and PostgreSQL** — run both as one stack.
