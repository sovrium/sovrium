# Installation

> Install Sovrium on your machine or run it on a managed host, then create your first configuration file.

You can install Sovrium on your own machine or run it on a cloud host. Pick the path that fits where your app will run.

**There is a third path, and for a first app it is the shortest.** The Sovrium app is a downloadable window around the same engine: it installs the binary for you, makes the project folder, and runs the server, so that editing the configuration is the only thing left to do. Install it from the [download page](https://sovrium.com/download) rather than by command, and see **The Sovrium App**. Everything below still applies to the project it creates — the configuration file is an ordinary one.

## Prerequisites

None. Sovrium ships as a self-contained binary: no runtime, no package manager, nothing to install first.

Tables and authentication work out of the box on an embedded SQLite database. PostgreSQL 15+ is optional and unlocks advanced features such as raw SQL and vector search.

## Local installation

Choose the method that matches your operating system.

```bash
# Install script (macOS, Linux)
curl -fsSL https://sovrium.com/install | sh

# Homebrew (macOS, Linux)
brew install sovrium/tap/sovrium

# Scoop (Windows)
scoop bucket add sovrium https://github.com/sovrium/scoop-bucket
scoop install sovrium

# Docker
docker pull ghcr.io/sovrium/sovrium:latest
```

After installing, the `sovrium` command is available from anywhere.

## Cloud installation

Run Sovrium on a managed host without provisioning a server yourself. Any platform that runs a long-lived container will do: point it at the published `ghcr.io/sovrium/sovrium` image. Render, Railway, Heroku, Platform.sh and Fly.io all run Sovrium this way. Scalingo can too, or you can deploy there from source with the Sovrium buildpack, which downloads the released, checksum-verified binary — see **Deploy on Scalingo**.

Whichever host you pick, set `BASE_URL` (required) and `SOVRIUM_ENCRYPTION_KEY`. Sovrium generates its own encryption key when none is given, but a managed host rebuilds the container filesystem on every deploy, so a self-generated key would not survive one unless it lands on a persistent volume — on a managed host, set it explicitly. There is only one secret to look after: the session-signing secret is derived from the encryption key, so you never set `AUTH_SECRET` alongside it. Generate one with `sovrium secret generate`, or with `openssl rand -hex 32` if you do not have the binary to hand yet. `DATABASE_URL` is optional — Sovrium defaults to embedded SQLite — and so are the `SMTP_*` variables for sending email.

Vercel is not supported, because it is serverless: it offers no persistent server or container, and Sovrium needs a long-running process to serve your app and store its data.

### Docker on your own server

To run Sovrium on a VPS or any host you control, start the container directly and place it behind a reverse proxy:

```bash
docker run -p 3000:3000 \
  -v "$PWD/app.yaml:/app/app.yaml:ro" \
  -v sovrium-data:/data \
  -e SOVRIUM_DATA_DIR=/data \
  -e NODE_ENV=production \
  -e SOVRIUM_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -e BASE_URL="https://app.example.com" \
  ghcr.io/sovrium/sovrium:latest start /app/app.yaml
```

Two mounts, and both matter. The first gives the container your config; the second is where it keeps state. `SOVRIUM_DATA_DIR` has to point at that second mount — Sovrium writes to `./.sovrium` by default, which inside the container is `/app/.sovrium`, so a data volume without this variable persists nothing. That includes the encryption key, which is why it is passed in above: with the volume wired up you could drop it and let Sovrium keep its own key on the volume instead.

Sovrium accepts either entry file, `app.yaml` or `app.ts`, so a guide that shows one works just as well with the other. See **Deploy with Docker** for the full production walkthrough.

## Verify installation

Run the help command to check that Sovrium is installed correctly:

```bash
sovrium --help
```

## Create a config file

Sovrium reads a YAML or JSON configuration file. Create an `app.yaml` with the simplest valid config:

```yaml
name: my-app
```

Both `.yaml`/`.yml` and `.json` are supported. YAML is recommended for readability.

Authoring the config in TypeScript instead? Run `sovrium types` in the project directory. It writes `sovrium.d.ts` and a `tsconfig.json` from the types embedded in the binary, so `app.ts` gets full autocompletion with no `package.json`, no `node_modules` and nothing to install. See **TypeScript Configs**.

## Database setup

Sovrium uses an embedded SQLite database by default — tables and auth work with zero configuration. Set `DATABASE_URL` only to choose the SQLite file location or to switch to PostgreSQL:

```bash
# Default: embedded SQLite — no DATABASE_URL needed

# Optional — choose where the SQLite file lives:
export DATABASE_URL="file:./data/app.db"

# Optional — use PostgreSQL for advanced features:
export DATABASE_URL="postgresql://user:password@localhost:5432/myapp"
```

Leave `DATABASE_URL` unset and Sovrium stores data in a local SQLite file. Use a `file:` URL to pick its location, or a `postgresql://` URL to switch engines. Pure static sites — pages and design only — need no database at all.

## Next steps

- **Quick Start** — build and run your first app.
- **The Sovrium App** — the same engine, in a window that runs it for you.
- **Core Concepts** — the anatomy of a Sovrium app.
- **Configuration Files** — YAML, JSON, TypeScript, and `$ref`.
