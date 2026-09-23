# Deploy Sovrium with Docker

> Run a Sovrium app as a Docker container — pull the official image, pass the config and secrets as environment, and persist the data directory with a volume.

You want to run a Sovrium app on any host that has Docker, with nothing to install but the image.

## Run the container

Mount your config and a data volume, and pass one secret. On the SQLite default, the whole database lives in the mounted `/data` volume:

```bash
docker run -d --name my-app -p 3000:3000 \
  -v "$PWD/app.yaml:/app/app.yaml:ro" \
  -v my-app-data:/data \
  -e SOVRIUM_DATA_DIR=/data \
  -e NODE_ENV=production \
  -e SOVRIUM_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -e BASE_URL=https://app.example.com \
  -e TRUSTED_PROXY_HOPS=1 \
  ghcr.io/sovrium/sovrium:latest start /app/app.yaml
```

`SOVRIUM_DATA_DIR` is what makes the volume useful. Sovrium writes to `./.sovrium` by default — inside the container that resolves to `/app/.sovrium`, not to your mount — so a volume without this variable persists nothing.

One secret is the whole list. The session-signing secret derives from `SOVRIUM_ENCRYPTION_KEY`, so there is no second value to generate, store or rotate in step with it.

The key itself is optional — Sovrium generates one on first start and keeps it in the data directory. Passing it explicitly, as above, is the safer habit for a container: it stays correct even if the volume is later dropped, recreated or swapped for an external database. Generate it once and keep it wherever you keep your other deployment secrets, because a different key on the next `docker run` makes every stored connection token unreadable.

`NODE_ENV=production` switches content-hashed assets to immutable caching. Leave it out and every asset is re-fetched on each page view.

`TRUSTED_PROXY_HOPS=1` matches the `https://` base URL above: something is terminating TLS in front of the container, and this is what lets Sovrium believe the client address that something forwards. Without it every request resolves to the proxy, so all visitors share one rate-limit budget. Drop it to `0` if you publish the container port straight to the internet, and never set it higher than the number of proxies you actually run.

## Verify

```bash
curl -fsS http://localhost:3000/ >/dev/null && echo "up"
```

The container serves your app on port 3000; the SQLite database and uploaded files persist in the `my-app-data` volume across restarts and upgrades.

## Next

- **Environment Variables** — every secret and toggle you can pass with `-e`.
- **Database Infrastructure** — stay on SQLite or point `DATABASE_URL` at PostgreSQL.
- **Security Hardening** — the production checklist before you expose the port.
