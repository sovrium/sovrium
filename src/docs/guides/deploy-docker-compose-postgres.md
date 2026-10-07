# Deploy Sovrium with Docker Compose and PostgreSQL

> Run Sovrium and PostgreSQL together with Docker Compose — one file that wires the app to a database in the same stack through `DATABASE_URL`, with its secrets kept in a separate file and HTTPS in front.

You want the app and its PostgreSQL database to come up together as one stack, with the database wired in by a single `DATABASE_URL`.

## Put the secrets in a file of their own

The stack needs two secrets: the database password and Sovrium's encryption key. Generate both into a `.env` file beside `compose.yaml`, readable by you only:

```bash
umask 077
printf 'POSTGRES_PASSWORD=%s\nSOVRIUM_ENCRYPTION_KEY=%s\n' \
  "$(openssl rand -hex 24)" "$(openssl rand -hex 32)" > .env
```

Compose reads that file to fill the `${…}` references below, so no secret is written into `compose.yaml` and the compose file can be committed. Keep `.env` out of version control. If your orchestrator has a secret store, feed the same two variables from it instead.

## Define the stack

```yaml
# compose.yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set it in .env}
      POSTGRES_DB: sovrium
    volumes: ['db-data:/var/lib/postgresql/data']
  app:
    image: ghcr.io/sovrium/sovrium:latest
    command: start /app/app.yaml
    depends_on: [db]
    ports: ['127.0.0.1:3000:3000']
    volumes: ['./app.yaml:/app/app.yaml:ro']
    environment:
      DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD:?set it in .env}@db:5432/sovrium
      NODE_ENV: production
      SOVRIUM_ENCRYPTION_KEY: ${SOVRIUM_ENCRYPTION_KEY:?set it in .env}
      BASE_URL: https://app.example.com
      TRUSTED_PROXY_HOPS: 1
volumes:
  db-data:
```

The `:?` form makes Compose refuse to start when a variable is missing, rather than starting with an empty password or key.

The encryption key is the only Sovrium secret this stack needs: the session-signing secret derives from it.

Set it here rather than letting Sovrium generate one. This stack gives the app container no volume, so a generated key would live in the container layer and disappear the next time the container is recreated — while `db-data` keeps the credentials that key encrypted. Pin the value and that mismatch cannot happen.

## Why `BASE_URL` matters

Sovrium decides its security posture from `BASE_URL`, not from `NODE_ENV` and not from which port is published. A `localhost` or other loopback `BASE_URL` tells it the deployment is local: the cross-site request (CSRF) origin check is turned off and session cookies lose their `Secure` attribute — even when the port is reachable from the internet. So on any host other people can reach, `BASE_URL` is the public `https://` address they type, never `http://localhost:3000`.

The stack above therefore publishes the app on the host's loopback interface only (`127.0.0.1:3000`) and expects a TLS-terminating reverse proxy on the same host to serve `https://app.example.com`. With Caddy, the whole site block is:

```text
app.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

`TRUSTED_PROXY_HOPS: 1` matches that one proxy: it lets Sovrium believe the client address the proxy forwards, so rate limits count per visitor instead of lumping everyone onto the proxy's address. Raise it only if you add a CDN in front, and never above the number of proxies actually in the path — a count higher than that reaches into a header any caller can write. If you ever publish the app port straight to the internet with no proxy, set it to `0`.

## Run and verify

```bash
docker compose up -d
curl -fsS http://127.0.0.1:3000/ >/dev/null && echo "app up"
curl -fsS https://app.example.com/ >/dev/null && echo "proxy up"
```

Because `DATABASE_URL` is set, Sovrium runs on PostgreSQL and applies its schema on boot.

## Next

- **Database Infrastructure** — the PostgreSQL engine Sovrium targets.
- **Schema Migrations** — how the schema evolves on each boot.
- **Deploy on a VPS with systemd and Caddy** — the same proxy setup, step by step.
- **Security Hardening** — the posture rules and the production checklist.
