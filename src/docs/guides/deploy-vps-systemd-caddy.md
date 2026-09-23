# Deploy Sovrium on a VPS with systemd and Caddy

> Run the Sovrium binary as a systemd service behind Caddy for automatic HTTPS — no Docker.

You have a Linux VPS and want the Sovrium binary to run as a managed service with automatic HTTPS.

## Run it as a service

Install the binary to a fixed system path. The install script defaults to `~/.sovrium`, which is the wrong place for a service that runs as a dedicated user, so point it somewhere stable:

```bash
sudo useradd --system --home /srv/app --shell /usr/sbin/nologin sovrium
sudo install -d -o sovrium -g sovrium /srv/app
sudo env SOVRIUM_INSTALL_DIR=/opt/sovrium sh -c \
  'curl -fsSL https://sovrium.com/install | sh -s -- --no-modify-path'
```

`useradd --system` does not create the home directory, so `install -d` is not optional — without it the service fails to start with `200/CHDIR`. The `sudo env` form matters too: default sudoers policy rejects a bare `sudo VAR=value …`.

That lands the binary at `/opt/sovrium/bin/sovrium`. Put your config at `/srv/app/app.yaml` — the unit below runs with `/srv/app` as its working directory, so `ExecStart` names it relatively.

Keep credentials out of the unit file — everything in `/etc/systemd/system/` is world-readable. Put the environment in a mode-`600` file instead, which is also where any provider credentials belong when you add them:

```bash
sudo install -m 600 -o root -g root /dev/null /etc/sovrium.env
sudo sh -c 'cat > /etc/sovrium.env' <<'EOF'
PORT=3000
NODE_ENV=production
BASE_URL=https://app.example.com
SOVRIUM_DATA_DIR=/srv/app/.sovrium
TRUSTED_PROXY_HOPS=1
EOF
```

The quoted `<<'EOF'` is deliberate: an unquoted heredoc would expand substitutions in your shell before `sudo` ever runs.

**No secret in that file, and that is not an omission.** This host has a durable disk, so on first start Sovrium generates its own encryption key and writes it to `/srv/app/.sovrium/encryption-key` — mode `0600`, owned by the service user, beside the SQLite database it protects. The session-signing secret derives from that key, so there is nothing else to generate and nothing to keep in sync.

One obligation comes with it: **the key file is part of your backup.** Take it with the database — a database restored without its key leaves stored credentials nobody can decrypt. The first restart confirms the key is stable: the banner reads `Encryption key: from /srv/app/.sovrium/encryption-key`, not `generated at`.

To manage the value yourself instead, add `SOVRIUM_ENCRYPTION_KEY` to `/etc/sovrium.env` before the first start and no key file is written at all.

`TRUSTED_PROXY_HOPS=1` is what tells Sovrium that Caddy is the only thing in front of it, so the client address Caddy forwards is believed and rate limits apply per visitor. Omit it and every request looks like it came from Caddy, putting all your visitors in one shared rate-limit budget. If you later add a CDN in front of Caddy, raise it to `2` — and no higher than the number of proxies you actually run.

Then define the unit:

```ini
# /etc/systemd/system/sovrium.service
[Unit]
Description=Sovrium
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=sovrium
Group=sovrium
WorkingDirectory=/srv/app
EnvironmentFile=/etc/sovrium.env
ExecStart=/opt/sovrium/bin/sovrium start app.yaml
Restart=on-failure
RestartSec=5

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/srv/app
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true
CapabilityBoundingSet=

[Install]
WantedBy=multi-user.target
```

`ProtectSystem=strict` makes the whole filesystem read-only except the paths in `ReadWritePaths`, so `SOVRIUM_DATA_DIR` must sit under `/srv/app`. On a host running several apps, add `MemoryMax=` so one runaway process cannot take down its neighbours.

Front it with Caddy for TLS — it fetches and renews the certificate for you. Install it first if the host does not have it; Caddy's own apt repository has to be added before the package resolves.

Then replace the default site with your own:

```text
# /etc/caddy/Caddyfile
app.example.com {
  reverse_proxy localhost:3000
}
```

Point `app.example.com` at the server's public IP before reloading — Caddy issues the certificate on the first request, and the ACME challenge fails without working DNS.

## Verify

```bash
sudo systemctl enable --now sovrium && sudo systemctl reload caddy
sudo grep -c . /etc/sovrium.env    # expect 5 — every variable landed
curl -fsS https://app.example.com/ >/dev/null && echo "up"
```

## Next

- **CLI Overview** — `start`, `reload`, and the flags the unit can use.
- **Security Hardening** — firewall, non-root user and secret handling.
- **Environment Variables** — everything the `[Service]` block can set.
