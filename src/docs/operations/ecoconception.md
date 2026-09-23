# Ecoconception

> Environmental footprint as a first-class platform property — performance-first by default, frugality opt-in, operator-controlled through `ECO_*` environment variables and measurable through the `X-Eco-Index` header.

Sovrium treats environmental footprint as a **first-class platform property** — not a feature, not a paid tier, not a checkbox. The posture is operator-controlled through environment variables, and the footprint is measurable rather than aspirational. Owning your data and minimising its environmental cost are the same fight against absentee infrastructure.

The eco posture lives in `ECO_*` environment variables — the twin of `DATABASE_URL`, `STORAGE_PROVIDER` and `AI_PROVIDER`. It is **never** part of the app schema: a schema author must not be able to change the environmental posture for the end users of their app.

## Core principles

- **Performance-first, frugality opt-in.** Levers that trade experience for footprint default to the experience-first setting. You opt _in_ to frugality; nothing is quietly degraded on your behalf.
- **Win-win choices are native, not levers.** Where a choice is both smaller and faster — modern image encoding, the page cache, lazy-loaded islands — it is simply how Sovrium is built, with no toggle to find.
- **Operator-controlled, not schema-controlled.** Eco posture is in environment variables. Schema fields for eco are explicitly rejected.
- **Measurable, not aspirational.** The platform commits to an `X-Eco-Index` response header graded from real transfer size; eco badges without a measured number are forbidden.

This direction was reversed deliberately. Sovrium was originally frugal by default, with operators opting _out_. That inverted in 2026: a platform that silently lowers fidelity is making a choice that belongs to you.

## The `ECO_*` contract

Every variable below has an enforcement point in the binary — that is the entry criterion for this table. A setting that is only read and echoed back is not a lever, and several such names were removed rather than documented.

| Variable                     | Default       | Options                                    | Purpose                                                                                    |
| ---------------------------- | ------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `ECO_MODE`                   | `balanced`    | `strict`, `balanced`, `lenient`            | Master eco posture. `strict` turns on the low-data default when you have not set it.       |
| `ECO_PAGE_CACHE`             | `on`          | `on`, `off`                                | In-memory cache of page HTML — request-invariant pages and `contentDir` collections alike. |
| `ECO_PAGE_CACHE_MAX_MB`      | `64`          | integer (MB)                               | Byte budget for that cache; oversized entries are refused and the newest are kept.         |
| `ECO_INDEX_HEADER`           | `on`          | `on`, `off`                                | Emit the `X-Eco-Index` response header graded from transfer size.                          |
| `ECO_LOW_DATA_DEFAULT`       | `off`         | `on`, `off`, `respect-client`              | End-user low-data posture: down-shift assets when on, or on the client hint.               |
| `ECO_AI_PROVIDER_PRECEDENCE` | `local-first` | `local-first`, `cloud-first`, `local-only` | Routing precedence for AI calls; pairs with `AI_PROVIDER`.                                 |
| `ECO_DESIGN_LAYER`           | `on`          | `on`, `off`                                | Emit the design-token override layer. `off` falls back to inline defaults.                 |
| `ECO_FORM_ANALYTICS`         | `on`          | `on`, `off`                                | Set `off` to stop recording form analytics events.                                         |

`ECO_MODE` recognises those three values and nothing else. If you previously ran `ECO_MODE=off`, write `lenient` to keep the relaxed posture; `on` and `auto` already meant `balanced` and can be dropped. Carry that migration out before you upgrade rather than after: those retired spellings are no longer ignored, they stop the boot.

### An unrecognised value refuses the boot

Set one of these variables to something outside its options column and Sovrium does not start. The refusal names the variable, quotes what you typed, and lists what it accepts. It runs at startup before the server binds a port, so a typo lands in your deploy log rather than surfacing hours later on whichever request first happened to read that lever.

**An unset variable is not a typo.** A variable you never set keeps its documented default, so an instance that configures no `ECO_*` variable at all boots exactly as it always did. Only a value that is present and unrecognised is refused — and surrounding whitespace and letter case are forgiven, so `ECO_INDEX_HEADER=" Off "` is read as `off`.

Seven of the eight levers behave this way: every row of the table above **except** `ECO_AI_PROVIDER_PRECEDENCE`, which still resolves an unrecognised value to `local-first`, and which is additionally case-sensitive — `Local-First` falls back without complaint. That row is a deliberate exception rather than an oversight.

The reasoning is the one that already governs the app config, which rejects a property name it does not know: **the config refuses an unknown key, so the environment refuses an unknown value.** Resolving quietly to a default makes a typo indistinguishable from a variable you never set, and those two mean opposite things. `ECO_PAGE_CACHE=0` used to read as `on`, so an operator chasing a stale page went on serving cached HTML while believing the cache was off. `ECO_MODE=strcit` ran `balanced`, and the dashboard confirmed `balanced` without ever saying the typed value had been discarded.

**You opt in to frugality, not out of it.** The levers that trade experience for footprint — low-data mode above all — ship in their experience-first setting. Set the variable to turn frugality on. The choices that cost nothing, such as modern image encoding and the page cache, are already on and have no knob, because there is no reason to want them off.

Image transcoding is one of those. Server-side transforms encode to WebP — roughly a quarter to a third fewer bytes than JPEG at the same visual quality, with transparency kept — and that is not configurable per instance. An automation that needs another codec passes an output format on the action itself.

AVIF would be smaller still, and it is deliberately not offered as a runtime output: the runtime Sovrium's transforms run on carries no AV1 encoder on Linux, so an AVIF option would have worked on some hosts and failed on the ones the binary and the container image actually run on. A frugality choice that only holds on a developer's laptop is not a frugality choice.

## Already-aligned foundations

Several Sovrium decisions serve frugality before any `ECO_*` variable is touched:

- **Standalone binary distribution** — one static binary, no separate runtime, fewer dependencies at boot.
- **SQLite and local-storage zero-config defaults** — a single process, with no managed cloud database required.
- **Server rendering with islands** — only the active island ships; heavy editors lazy-load.
- **The programmatic CSS compiler** — compiled per theme on demand and cached in memory, with no megabyte static stylesheet.
- **Soft delete instead of hard accumulation** — deleted rows stay recoverable and countable rather than silently duplicated.
- **The local-first AI option** — local inference avoids cross-continental round trips.

## Low-data mode

`ECO_LOW_DATA_DEFAULT` controls how aggressively Sovrium down-shifts asset weight for end users. When `on`, low-data variants — lower-resolution images, simpler renders — are served by default; with `respect-client`, the posture follows the visitor's `Save-Data` and reduced-data client hints; `off` always serves the full variant.

Low-data mode **down-shifts gracefully** — it never refuses to render a chart or a rich-text editor. Paternalistic feature-blocking is an explicit anti-pattern: eco posture lowers fidelity, it does not break a user's workflow.

## Measurement: `X-Eco-Index`

When `ECO_INDEX_HEADER=on`, page responses carry an `X-Eco-Index` header graded A to G from the response transfer size against fixed tiered thresholds. This makes the footprint observable per response rather than a marketing claim.

Read the grade for what it measures: response **bytes**, nothing more. It is not a Lighthouse score and not an EcoIndex score, and it does not inspect what the page contains.

## Anti-patterns

- **Greenwashing badges** — rendering an "eco mode on" badge without a measured footprint number.
- **Paternalistic feature blocking** — refusing to render content because of an eco posture; always down-shift gracefully.
- **A paid eco tier** — gating eco features behind a licence key. All eco posture is free in self-hosted mode.
- **Schema-level eco config** — adding an `eco` block to the app config. Eco is operator-controlled; use environment variables.
- **Hardcoded cloud AI calls** — bypassing `ECO_AI_PROVIDER_PRECEDENCE`. Always route through the precedence resolver.

## Related reading

- **Database Infrastructure** — `ECO_PAGE_CACHE` and the static render cache.
- **Theme** — the programmatic CSS compiler and `ECO_DESIGN_LAYER`.
- **Image Formats** — how delivery negotiates a format per request.
- **GDPR & Privacy** — data minimisation as a privacy-and-frugality twin.
- **Analytics** — bounded retention and cookie-free tracking.
- **Environment Variables** — the full reference.
