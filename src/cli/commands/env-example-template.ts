/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Canonical `.env.example` content.
 *
 * Single source of truth for the env-var reference, used both by
 * `sovrium init` (scaffolds this into new projects) and the repo-root
 * `.env.example`. Keep them in sync by sourcing both from this constant.
 *
 * Principles:
 *   - EVERY variable is optional — Sovrium runs zero-config. Per ADR 023 the
 *     defaults are performance- and experience-first; operators opt *in* to
 *     frugality. Win-win choices (AVIF, page cache) are native, not toggles.
 *   - Only IMPLEMENTED variables appear here. Every ECO_* row below has a real
 *     enforcement point in the binary — a lever that only echoed itself back
 *     through the admin overview is not a lever and does not belong here.
 *   - Storage is spelled `STORAGE_S3_*`. The bare `S3_*` aliases were removed;
 * `[internal ref]` pins that they never come back.
 */
export const ENV_EXAMPLE_CONTENT = `# Sovrium environment variables
# Copy to .env and uncomment what you need. Every variable is OPTIONAL:
# \`sovrium start app.yaml\` runs zero-config with embedded SQLite, local file
# storage, AI disabled, and eco-friendly defaults.

# ── Core ──────────────────────────────────────────────────────────────
# PORT=3000
# BASE_URL=http://localhost:3000
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname   # omit → SQLite
# SOVRIUM_TIMEZONE=UTC                   # IANA zone for schedules and displayed dates; TZ is ignored
# SOVRIUM_DEV_CLOCK=                    # development only: ISO 8601 instant every "today" answers at
# API_IP_RATE_LIMIT=1200                 # API requests per client address per window; raise when many users share one address
# RATE_LIMIT_WINDOW_SECONDS=60           # seconds in every per-address rate-limit window; a whole number above zero

# ── Running under a supervisor ─────────────────────────────────────────
# A supervising process — the Sovrium desktop app, a systemd unit, a CI step —
# knows which folder holds the app but does not choose the working directory the
# binary is launched from. These four let it say so without a \`cd\`. A relative
# SOVRIUM_DATA_DIR resolves against the project directory, so one value means a
# different folder under each project.
# SOVRIUM_PROJECT_DIR=/srv/contact-book   # config discovery root, and the $ref jail
# SOVRIUM_CONFIG_FILE=app.yaml            # the config file WITHIN that root
# SOVRIUM_SHUTDOWN_ON_STDIN_CLOSE=1       # stop on end-of-file; Windows has no SIGTERM
# SOVRIUM_INSTALL_METHOD=desktop          # binary | homebrew | scoop | docker | desktop

# ── Letting your AI client edit the config ────────────────────────────
# Read by \`sovrium mcp\` alone, and only when the project directory was named
# explicitly — by --project or SOVRIUM_PROJECT_DIR above. Off by default; set on
# a deployed server it does nothing, and the boot says so.
# MCP_CONFIG_WRITE=1                      # offer the config write + undo tools

# ── Auth (only when app.auth is enabled) ──────────────────────────────
# Generate both with: sovrium secret generate
# AUTH_SECRET=
# SOVRIUM_ENCRYPTION_KEY=
# Bootstrap an admin on first start — or run: sovrium admin create <email>
# AUTH_ADMIN_EMAIL=admin@example.com
# AUTH_ADMIN_PASSWORD=

# ── AI (disabled unless AI_PROVIDER is set) ───────────────────────────
# AI_PROVIDER=ollama          # ollama | openai | anthropic | mistral | google
# AI_API_KEY=                 # cloud providers only (not ollama)
# AI_BASE_URL=http://localhost:11434   # ollama endpoint
# On an app without auth, every caller is anonymous: this caps each client
# address's chat messages and transcriptions (counted separately) per window.
# AI_ANON_RATE_LIMIT=10       # anonymous requests per window, per address
# AI_ANON_RATE_WINDOW=60      # window length, in seconds

# ── Speech-to-text (disabled unless STT_PROVIDER is set) ──────────────
# Its own endpoint, never derived from AI_BASE_URL. Sovrium ships no speech
# model: point it at a server you run, or at a hosted provider with a key.
# STT_PROVIDER=openai-compatible   # openai-compatible | whisper-cpp | openai | mistral
# STT_BASE_URL=http://127.0.0.1:8000/v1   # whisper.cpp: http://127.0.0.1:8080
# STT_API_KEY=                     # required for openai and mistral
# STT_MODEL=                       # default model for every tier
# STT_MODEL_FAST=                  # live dictation (chat)
# STT_MODEL_ACCURATE=              # recordings you keep (automations)
# STT_TIMEOUT_MS=600000            # upper bound on one transcription
# STT_MAX_FILE_BYTES=104857600     # largest recording sent

# ── Storage (auto: local files with SQLite, Postgres bytea otherwise) ──
# STORAGE_PROVIDER=s3         # s3 | local   (omit → auto)
# STORAGE_S3_ENDPOINT=https://s3.amazonaws.com
# STORAGE_S3_BUCKET=my-app-files
# STORAGE_S3_REGION=us-east-1
# STORAGE_S3_ACCESS_KEY_ID=
# STORAGE_S3_SECRET_ACCESS_KEY=
# STORAGE_LOCAL_DIRECTORY=./uploads     # when STORAGE_PROVIDER=local

# ── Operator console ──────────────────────────────────────────────────
# Sovrium's built-in admin console is served at /_admin. Whether it is served
# at all is config (admin: true|false); this is the deployment-side kill
# switch, and it wins over whatever the config declares.
# SOVRIUM_ADMIN=on                        # on | off

# ── Operator emails ───────────────────────────────────────────────────
# A failed or timed-out automation emails every admin-tier account that left
# "Automation alerts" on in its profile, plus the addresses listed here — the
# only audience of an app with no auth block. Set BASE_URL for working links.
# SOVRIUM_NOTIFY_AUTOMATIONS=on           # on | off
# SOVRIUM_NOTIFY_TO=                      # comma-separated extra addresses
# SOVRIUM_AUTOMATION_AUTOPAUSE=           # pause after N failures in a row; unset = never
# A weekly summary of the instance goes to every admin-tier account that left
# "Weekly summary" on, plus SOVRIUM_NOTIFY_TO. Runs in SOVRIUM_TIMEZONE.
# SOVRIUM_NOTIFY_DIGEST=weekly            # weekly | off
# SOVRIUM_NOTIFY_DIGEST_CRON="0 8 * * 1"  # five-field cron; default Mondays 08:00

# ── Automations ───────────────────────────────────────────────────────
# How long a run of an automation that sets no timeout may execute, in ms
# (1000 to 3600000). Time spent waiting for a concurrency slot does not count.
# SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS=900000   # default 15 minutes

# ── Ecoconception (performance-first defaults; opt IN to frugality) ────
# Win-win defaults — smaller AND faster. Change only for a specific reason.
# ECO_PAGE_CACHE=on                       # on | off
# ECO_PAGE_CACHE_MAX_MB=64                # rendered-page cache byte budget
# ECO_DESIGN_LAYER=on                     # off drops the theme token layer
# ECO_AI_PROVIDER_PRECEDENCE=local-first  # local-first | cloud-first | local-only
#
# Frugality levers — trade experience for footprint. Off unless you opt in.
# ECO_MODE=balanced                       # strict | balanced | lenient
# ECO_LOW_DATA_DEFAULT=off                # on serves the low-data variant
# ECO_INDEX_HEADER=on                     # off stops emitting X-Eco-Index
# ECO_FORM_ANALYTICS=on                   # off stops recording form analytics

# ── Observability export (all OFF unless set; any Sentry/OTLP backend) ─
# Point these at a self-hosted GlitchTip (or any Sentry/OTLP backend). Every
# signal is off unless its gate is set; secrets are never printed to the console.
# SENTRY_DSN=https://<key>@monitor.example.com/<project_id>   # errors + performance
# SENTRY_ENVIRONMENT=production               # event environment (else NODE_ENV)
# SENTRY_TRACES_SAMPLE_RATE=0.1               # (0,1] arms sampled perf; 0/unset → off
# OTEL_EXPORTER_OTLP_ENDPOINT=https://monitor.example.com   # OTLP logs base (+ /v1/logs)
# OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=           # full logs URL, used verbatim (overrides base)
# OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=         # explicit endpoint to arm dormant OTel traces
# OTEL_EXPORTER_OTLP_HEADERS=                 # k=v,k2=v2 — GlitchTip: Authorization=Bearer <dsn-public-key>
# OTEL_SERVICE_NAME=                          # OTLP service.name (else app name)

# Full reference (SMTP, OAuth providers, MCP, advanced tuning):
# https://sovrium.com/docs/configuration
`
