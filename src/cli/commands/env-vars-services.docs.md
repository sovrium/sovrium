# Environment Variables: Storage, AI, Email and Observability

> Every service here is off, local or frugal by default. You opt _out_ of the default posture by setting a variable; you never have to opt in to get a working app.

## Storage

The backend is operator-controlled, so the same config runs against a local disk in development and object storage in production.

| Variable                       | Default              | Description                                                                                                     |
| ------------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `STORAGE_PROVIDER`             | auto                 | `s3` or `local`. Unset selects PostgreSQL bytes when a database URL is set, local files otherwise               |
| `STORAGE_LOCAL_DIRECTORY`      | `<data dir>/storage` | Upload directory; required for `local`                                                                          |
| `STORAGE_S3_ENDPOINT`          | —                    | S3-compatible endpoint URL; required for `s3`                                                                   |
| `STORAGE_S3_BUCKET`            | —                    | Bucket name; required for `s3`                                                                                  |
| `STORAGE_S3_REGION`            | `us-east-1`          | Region                                                                                                          |
| `STORAGE_S3_ACCESS_KEY_ID`     | —                    | Access key; required for `s3`                                                                                   |
| `STORAGE_S3_SECRET_ACCESS_KEY` | —                    | Secret key; required for `s3`                                                                                   |
| `STORAGE_S3_FORCE_PATH_STYLE`  | `false`              | `true` for MinIO and other path-style endpoints                                                                 |
| `STORAGE_DEFAULT_ACCESS`       | `private`            | `public` serves every stored file without authentication                                                        |
| `STORAGE_PUBLIC_PATHS`         | —                    | Comma-separated key prefixes served without authentication; literal prefixes only, wildcards refused at startup |
| `STORAGE_MAX_FILE_SIZE`        | —                    | Per-file upload cap, in bytes                                                                                   |
| `STORAGE_MAX_TOTAL_SIZE`       | —                    | Total stored-bytes cap, in bytes                                                                                |
| `STORAGE_TEMP_CLEANUP_AFTER`   | `86400000`           | Age in milliseconds at which automation temp files become sweepable; `0` disables sweeping                      |

## AI

AI is disabled until a provider is set, and an unrecognised value aborts the boot rather than failing silently later. Leaving it unset is not silent either when it matters: if the config actually uses AI, the startup banner warns that agents are inert and AI fields fall back to their baseline. An app with no AI surface starts without that warning.

| Variable                  | Default          | Description                                                                                            |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| `AI_PROVIDER`             | unset (disabled) | `anthropic`, `openai`, `mistral`, `google`, `ollama` or `openai-compatible`; `gemini` aliases `google` |
| `AI_API_KEY`              | —                | Provider API key; required for every provider except `ollama`                                          |
| `AI_BASE_URL`             | provider default | Endpoint URL; required for `ollama` and `openai-compatible`                                            |
| `AI_MODEL`                | per provider     | Model identifier                                                                                       |
| `AI_TEMPERATURE`          | provider default | Sampling temperature, 0 to 1 inclusive                                                                 |
| `AI_MAX_TOKENS`           | provider default | Maximum output tokens                                                                                  |
| `AI_EMBEDDING_MODEL`      | —                | Embedding model identifier                                                                             |
| `AI_EMBEDDING_DIMENSIONS` | —                | Embedding vector dimensions                                                                            |

Provider-specific aliases are read when the generic variable is absent: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MISTRAL_API_KEY` and `GOOGLE_API_KEY` stand in for the generic key, and `OLLAMA_BASE_URL` for the generic base URL. **The generic name always wins when both are set**, which is worth knowing before debugging a key that appears to be ignored.

## Speech-to-text

A separate endpoint from the language model, never derived from `AI_BASE_URL`. Unset `STT_PROVIDER` keeps transcription off without stopping the app.

| Variable             | Default          | Purpose                                                                      |
| -------------------- | ---------------- | ---------------------------------------------------------------------------- |
| `STT_PROVIDER`       | unset (disabled) | `openai-compatible`, `whisper-cpp`, `openai` or `mistral`                    |
| `STT_BASE_URL`       | provider default | Speech server URL (`/audio/transcriptions`, or `/inference` for whisper.cpp) |
| `STT_API_KEY`        | —                | Key for a cloud speech provider                                              |
| `STT_MODEL`          | per provider     | Default speech model                                                         |
| `STT_MODEL_FAST`     | `STT_MODEL`      | Model for the `fast` tier                                                    |
| `STT_MODEL_ACCURATE` | `STT_MODEL`      | Model for the `accurate` tier                                                |
| `STT_TIMEOUT_MS`     | `600000`         | Upper bound on one transcription request                                     |
| `STT_MAX_FILE_BYTES` | `104857600`      | Largest recording sent                                                       |

## Email

With no SMTP host set, email is disabled and sends are logged rather than delivered — there is never a silent fallback to a local mail catcher. In development the whole message reaches the journal, links included; in production only a one-line notice does. The startup banner warns only when the config makes email load-bearing, so a bare email-and-password app boots quietly.

| Variable         | Default               | Description                                  |
| ---------------- | --------------------- | -------------------------------------------- |
| `SMTP_HOST`      | unset (disabled)      | SMTP server hostname                         |
| `SMTP_PORT`      | `587`                 | SMTP server port                             |
| `SMTP_SECURE`    | `false`               | Implicit TLS; port 465 enables it regardless |
| `SMTP_USER`      | —                     | Authentication username                      |
| `SMTP_PASS`      | —                     | Authentication password                      |
| `SMTP_FROM`      | `noreply@sovrium.com` | Sender address                               |
| `SMTP_FROM_NAME` | `Sovrium`             | Sender display name                          |

## MCP server

Off by default. The operator mounts the route; the config decides what the tools may touch. There is no credential variable — the endpoint authenticates on the header a request carries, so enabling it requires an auth block and refuses the boot without one. The retired strategy and static-token variables also refuse the boot.

The first eight reach the HTTP route only. `sovrium mcp`, the local stdio path, serves a client on your own machine with no route and no credential, and reads exactly one variable of its own — the last row.

| Variable                    | Default           | Description                                                                                                                          |
| --------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `MCP_ENABLED`               | `false`           | Master switch; the route is mounted only when true                                                                                   |
| `MCP_TRANSPORT`             | `streamable-http` | `streamable-http` mounts the route; `stdio` un-mounts it and reads no stdin                                                          |
| `MCP_MOUNT_PATH`            | `/mcp`            | Route prefix under `streamable-http`                                                                                                 |
| `MCP_RATE_LIMIT_PER_MINUTE` | `60`              | Requests per credential per minute                                                                                                   |
| `MCP_RATE_LIMIT_PER_DAY`    | `5000`            | Requests per credential per day                                                                                                      |
| `MCP_AUDIT_ENABLED`         | `true`            | Log every tool call to the audit trail                                                                                               |
| `MCP_EXPOSE_INTERNALS`      | `true`            | Expose internal tables read-only to the admin role                                                                                   |
| `MCP_CONFIRM_DESTRUCTIVE`   | `true`            | Mark delete tools destructive so clients confirm first                                                                               |
| `MCP_CONFIG_WRITE`          | `false`           | `sovrium mcp` only: offer the config write tools, when the project is named explicitly. Inert on the HTTP route, which warns at boot |

The reverse direction — your own agents calling tools on someone else's server — is declared with a different family (`MCP_CLIENT_SERVERS` and the positional `MCP_AUTH_TYPE_{N}` / `MCP_AUTH_TOKEN_{N}` / `MCP_AUTH_HEADER_{N}`), none of which is read here. **Client Mode** covers them.

## Ecoconception

Experience-first defaults you override to opt _in_ to frugality. Eco posture is operator configuration and never appears in the app config.

| Variable                     | Default       | Description                                                   |
| ---------------------------- | ------------- | ------------------------------------------------------------- |
| `ECO_MODE`                   | `balanced`    | `strict`, `balanced` or `lenient`                             |
| `ECO_PAGE_CACHE`             | `on`          | In-memory cache for request-invariant page HTML               |
| `ECO_PAGE_CACHE_MAX_MB`      | `64`          | Byte budget for that cache; oversized entries are refused     |
| `ECO_INDEX_HEADER`           | `on`          | Emit the response eco grade, A to G                           |
| `ECO_LOW_DATA_DEFAULT`       | `off`         | `on`, `off`, or `respect-client` to honour reduced-data hints |
| `ECO_AI_PROVIDER_PRECEDENCE` | `local-first` | `local-first`, `cloud-first` or `local-only`                  |
| `ECO_DESIGN_LAYER`           | `on`          | Emit the design-token override layer                          |
| `ECO_FORM_ANALYTICS`         | `on`          | `off` stops recording form analytics events                   |

Every row above **except the AI precedence one** refuses the boot on a value it does not recognise, naming the variable and listing what it accepts. Leaving a variable unset is untouched by this — it keeps its default. The precedence lever is the one that still resolves an unrecognised value to its default, and `local-only` against an unreachable local model refuses the boot, but only for an app that uses AI.

## Observability export

Every signal is off unless its own gate is set, and a set-but-malformed value aborts the boot rather than starting a broken exporter. That check is on the **value**, not on the destination: the grammar of what you set is validated, then emitted. What your backend does with what arrives is the backend's business.

**A backend that does not implement an OTLP signal answers its route with a `404`, and the exporter drops the batch silently** — no banner line, no warning, nothing at the default log level. The Sentry protocol and OTLP are families of routes rather than a single switch, so a backend can accept errors and logs while mounting no traces or metrics route at all. Probe the route before trusting the signal:

```bash
curl -i -X POST <endpoint>/v1/traces -H 'Content-Type: application/json' -d '{}'
```

A `404` means the route is not mounted and every span you export is discarded. Any other `4xx` means the route exists and is rejecting an empty or unauthenticated body — which is what you want to see.

This is why traces and metrics each have their own gate. The base endpoint arms log export and nothing else; spans and metric datapoints need their own variables. One variable per signal is what lets you run logs against a backend that mounts a logs route without pushing metrics at one that answers `404`, and lets you turn either off without losing the other. **The per-signal variables are used verbatim**: include the path yourself, since nothing is appended for you.

| Variable                              | Default                        | Description                                                |
| ------------------------------------- | ------------------------------ | ---------------------------------------------------------- |
| `SENTRY_DSN`                          | unset (off)                    | Gates error reporting                                      |
| `SENTRY_ENVIRONMENT`                  | `NODE_ENV`, else `development` | Environment label attached to events                       |
| `SENTRY_TRACES_SAMPLE_RATE`           | unset (off)                    | Performance sampling rate in (0,1]; needs a DSN            |
| `OTEL_EXPORTER_OTLP_ENDPOINT`         | unset (off)                    | Base OTLP URL. Arms **log export only**                    |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`    | derived from base              | Full logs URL, used verbatim                               |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | unset (off)                    | Arms metric export; the base endpoint alone does not       |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`  | unset (off)                    | Arms trace export; the backend must mount the traces route |
| `OTEL_EXPORTER_OTLP_HEADERS`          | —                              | Export headers as `k=v,k2=v2`                              |
| `OTEL_SERVICE_NAME`                   | the app name                   | The service-name resource attribute                        |
| `OTEL_METRIC_EXPORT_INTERVAL`         | `10000`                        | Metrics poll interval, in milliseconds                     |
| `OTEL_TRACES_SAMPLER`                 | `parentbased_traceidratio`     | Sampler name; an unknown one aborts the boot               |
| `OTEL_TRACES_SAMPLER_ARG`             | `0.1`                          | Sampling ratio in [0,1] for ratio-based samplers           |
| `LOG_LEVEL`                           | `info`                         | `debug`, `info`, `warn` or `error`                         |

## Static builds

Read when generating a static site.

| Variable                      | Default  | Description                                                    |
| ----------------------------- | -------- | -------------------------------------------------------------- |
| `SOVRIUM_OUTPUT_DIR`          | `./dist` | Output directory                                               |
| `SOVRIUM_BASE_URL`            | —        | Base URL for sitemap entries and canonical links               |
| `SOVRIUM_BASE_PATH`           | —        | Path prefix for subdirectory deployments                       |
| `SOVRIUM_DEPLOYMENT`          | —        | `github-pages` or `generic`                                    |
| `SOVRIUM_LANGUAGES`           | —        | Comma-separated language codes to build                        |
| `SOVRIUM_DEFAULT_LANGUAGE`    | —        | Default language code                                          |
| `SOVRIUM_GENERATE_SITEMAP`    | `false`  | Generate a sitemap                                             |
| `SOVRIUM_GENERATE_ROBOTS`     | `false`  | Generate a robots file                                         |
| `SOVRIUM_GENERATE_MANIFEST`   | `false`  | Generate a web app manifest                                    |
| `SOVRIUM_HYDRATION`           | `false`  | Enable client-side hydration                                   |
| `SOVRIUM_BUNDLE_OPTIMIZATION` | —        | `split` or `none`                                              |
| `SOVRIUM_PUBLIC_DIR`          | —        | Static-asset directory to copy; `none` disables static serving |

## Demo instances

Renders a banner marking an instance as a throwaway demo. Off unless explicitly enabled, so a production deployment can never announce itself as disposable by accident.

| Variable                | Description                                                                       |
| ----------------------- | --------------------------------------------------------------------------------- |
| `SOVRIUM_DEMO_NOTICE`   | Master switch; `on`, `true`, `1` or `yes` enables it, anything else leaves it off |
| `SOVRIUM_DEMO_NAME`     | Template display name shown in the panel title                                    |
| `SOVRIUM_DEMO_URL`      | Target of the notice's call to action                                             |
| `SOVRIUM_DEMO_EMAIL`    | Display-only sign-in email, never sourced from the admin seed                     |
| `SOVRIUM_DEMO_PASSWORD` | Display-only sign-in password, never sourced from the admin seed                  |

Those last two are display-only on purpose: a demo banner that read the real seeded credentials would publish them the moment someone enabled the banner on a real instance.
