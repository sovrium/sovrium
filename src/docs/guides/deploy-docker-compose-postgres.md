# Deploy Sovrium with Docker Compose and PostgreSQL

> Run Sovrium and PostgreSQL together with Docker Compose — one file that wires the app to a database in the same stack through `DATABASE_URL`.

You want the app and its PostgreSQL database to come up together as one stack, with the database wired in by a single `DATABASE_URL`.

## Define the stack

```yaml
# compose.yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: sovrium
      POSTGRES_DB: sovrium
    volumes: ['db-data:/var/lib/postgresql/data']
  app:
    image: ghcr.io/sovrium/sovrium:latest
    command: start /app/app.yaml
    depends_on: [db]
    ports: ['3000:3000']
    volumes: ['./app.yaml:/app/app.yaml:ro']
    environment:
      DATABASE_URL: postgres://postgres:sovrium@db:5432/sovrium
      NODE_ENV: production
      SOVRIUM_ENCRYPTION_KEY: change-me-to-32-byte-hex
      BASE_URL: http://localhost:3000
volumes:
  db-data:
```

Generate the key with `openssl rand -hex 32` and keep it out of the compose file in production — Compose reads a sibling `.env`, or use your orchestrator's secret store. It is the only secret this stack needs: the session-signing secret derives from it.

Set it here rather than letting Sovrium generate one. This stack gives the app container no volume, so a generated key would live in the container layer and disappear the next time the container is recreated — while `db-data` keeps the credentials that key encrypted. Pin the value and that mismatch cannot happen.

This stack publishes the app port directly, so no `TRUSTED_PROXY_HOPS` is set and Sovrium keys rate limits on the connecting address — which is correct here. The moment you put a reverse proxy or CDN in front of it, add `TRUSTED_PROXY_HOPS` set to the number of proxies in the path, or every visitor collapses into the proxy's single rate-limit budget. Setting it before that proxy exists is worse than leaving it out: the count would reach into a header any caller can write.

## Run and verify

```bash
docker compose up -d
curl -fsS http://localhost:3000/ >/dev/null && echo "up"
```

Because `DATABASE_URL` is set, Sovrium runs on PostgreSQL and applies its schema on boot.

## Next

- **Database Infrastructure** — the PostgreSQL engine Sovrium targets.
- **Schema Migrations** — how the schema evolves on each boot.
- **Security Hardening** — replace the placeholder secrets before production.
