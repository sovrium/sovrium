# Deploy Sovrium on Scalingo

> Push a Sovrium app to Scalingo — a git-push deploy that runs the released binary, with a managed PostgreSQL add-on and environment-variable secrets.

You want a git-push deploy on a European PaaS, with a managed database and no server to run yourself.

## Configure the app

Scalingo builds with buildpacks, not with your Dockerfile, so the repository needs three files. `.buildpacks` selects the Sovrium buildpack, which downloads the released, checksum-verified binary into `bin/`. `.sovrium-version` pins which release to fetch. The `Procfile` boots it.

```text
# .buildpacks
https://github.com/sovrium/scalingo-buildpack
```

```text
# .sovrium-version — the release to download; bump it to upgrade
0.25.0
```

Pin whichever release you want from the project's releases page; the buildpack verifies the checksum before installing it. A version that does not exist fails the build rather than deploying something unexpected.

```text
# Procfile
web: bin/sovrium start app.yaml
```

The `bin/` prefix matters: the buildpack installs the binary into the app tree, not onto the system `PATH`.

Then add a managed PostgreSQL database so the app runs on PostgreSQL instead of the SQLite default, and set the environment:

```bash
scalingo --app my-app addons-add postgresql postgresql-starter-1024
scalingo --app my-app env-set \
  SOVRIUM_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  BASE_URL=https://my-app.osc-fr1.scalingo.io \
  NODE_ENV=production \
  TRUSTED_PROXY_HOPS=1
```

Pick the add-on plan that fits your data; `scalingo addons-plans postgresql` shows the current list. `NODE_ENV=production` is not cosmetic — it switches Sovrium to immutable caching for content-hashed assets. Without it every asset is re-fetched on each page view.

`SOVRIUM_ENCRYPTION_KEY` is the only secret in that list, and it is set here for a reason worth knowing. Sovrium generates its own key when none is given, but Scalingo rebuilds the container filesystem on every deploy and restart, while the managed database keeps everything that key encrypted. Generated, the key would be new each time and the stored credentials would stop opening. Setting it once removes the problem. The session-signing secret derives from it, so there is no second value to set.

`TRUSTED_PROXY_HOPS=1` accounts for Scalingo's own router, which is what stands between the internet and your container. It lets Sovrium believe the client address the router forwards, so rate limits count per visitor instead of lumping every request onto the router's address. Raise it only if you put your own CDN in front of Scalingo, and never above the number of proxies actually in the path.

**Secrets are echoed.** `scalingo env-set` and `scalingo env` print values to your terminal. Generate secrets inline as shown rather than pasting them, and avoid `scalingo env` in shared or recorded sessions.

Scalingo injects `DATABASE_URL` and `PORT` automatically — Sovrium reads both, so no extra wiring is needed.

## Deploy and verify

Scalingo deploys from `master`, so push your branch to that ref explicitly:

```bash
git push scalingo HEAD:refs/heads/master
curl -fsS https://my-app.osc-fr1.scalingo.io/ >/dev/null && echo "up"
```

## Next

- **Database Infrastructure** — how `DATABASE_URL` switches Sovrium to PostgreSQL.
- **Schema Migrations** — schema evolution applies on the next deploy's boot.
- **Environment Variables** — the secrets to set with `env-set`.
