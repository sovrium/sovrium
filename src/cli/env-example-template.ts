/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const ENV_EXAMPLE_CONTENT = `# Sovrium environment variables
# Copy to .env and uncomment what you need. Every variable is OPTIONAL:
# \`sovrium start app.yaml\` runs zero-config with embedded SQLite, local file
# storage, AI disabled, and eco-friendly defaults.

# ── Core ──────────────────────────────────────────────────────────────
# PORT=3000
# BASE_URL=http://localhost:3000
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname   # omit → SQLite

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

# ── Storage (auto: local files with SQLite, Postgres bytea otherwise) ──
# STORAGE_PROVIDER=s3         # s3 | local   (omit → auto)
# STORAGE_S3_ENDPOINT=https://s3.amazonaws.com
# STORAGE_S3_BUCKET=my-app-files
# STORAGE_S3_REGION=us-east-1
# STORAGE_S3_ACCESS_KEY_ID=
# STORAGE_S3_SECRET_ACCESS_KEY=
# STORAGE_LOCAL_DIRECTORY=./uploads     # when STORAGE_PROVIDER=local

# ── Ecoconception (frugal by default — override only to opt OUT) ───────
# ECO_PAGE_CACHE=on                       # on | off
# ECO_IMAGE_FORMAT=avif                   # avif | webp | jpeg | png
# ECO_AI_PROVIDER_PRECEDENCE=local-first  # local-first | cloud-first | local-only

# Full reference: https://sovrium.com/docs/configuration
`
