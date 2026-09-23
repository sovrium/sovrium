/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Default Config Filenames - Pure Data
 *
 * The filenames every config-consuming CLI command probes, in the order it
 * probes them, when no config was named explicitly and no env var supplied one.
 *
 * YAML first because that is what `sovrium init` scaffolds — the `init` → `start`
 * flow is the reason auto-discovery exists, so the file `init` writes has to be
 * the file discovery finds first. `.yml` follows as the alternate spelling of the
 * same format, then TypeScript.
 *
 * First match wins; there is deliberately no ambiguity warning. A documented,
 * deterministic order is more useful than a prompt.
 *
 * `app.json` is deliberately NOT a candidate, and that asymmetry is the one thing
 * to preserve when editing this list: `detectFormat` still accepts `.json`, so
 * `sovrium start app.json` keeps working exactly as before. Only the IMPLICIT
 * lookup skips it. The reason is that `app.json` is already taken — it is the
 * published deploy-manifest filename for Heroku, Scalingo and Render, so a user
 * deploying to any of those has one in their repository root for reasons that have
 * nothing to do with Sovrium. Probing it would load a manifest and refuse with
 * `Validation failed: Unknown property 'repository'` instead of the clean usage
 * message the user needs. This was not hypothetical — it is how the case was
 * found: Sovrium's own repository root carried exactly such a manifest until the
 * one-click PaaS deploy surface was retired (those buttons pointed at mirror
 * paths that were never published, so they had always 404'd). The manifest is
 * gone from THIS repository; the reason to decline the name is not, because it
 * was never about us — every Heroku, Scalingo or Render user has one. A filename
 * we cannot claim unambiguously is worth less as a convenience than it costs as a
 * confusing refusal, so implicit discovery declines to guess and explicit naming
 * stays the way to load JSON.
 */

/** Candidate config filenames probed in `process.cwd()`, in probe order. */
export const DEFAULT_CONFIG_FILENAMES = ['app.yaml', 'app.yml', 'app.ts'] as const

/**
 * The one-line notice every command prints when it resolved a config the user
 * never named.
 *
 * Identical across `start`, `build`, `admin create`, `validate` and `seed` on
 * purpose: `--watch`, the lock-file hash, the content dir and the seed dir all
 * key off the resolved file, so a discovered config must never be mysterious.
 * Kept here rather than at the call sites so the wording cannot drift between
 * the five commands that print it.
 */
export const formatDiscoveredConfigNotice = (filename: string): string =>
  `Using ${filename} (auto-discovered)`

/**
 * The line a refusal prints to say what it probed for, and where.
 *
 * Without it the user is told a config is missing but not what to call one.
 *
 * `root` is the PROJECT directory rather than the working directory, and the
 * two differ whenever a supervisor set `SOVRIUM_PROJECT_DIR`. Naming the
 * working directory there would send the user to look in a folder the engine
 * never probed.
 */
export const formatConfigCandidatesLine = (root: string): string =>
  `Looked for ${DEFAULT_CONFIG_FILENAMES.join(', ')} in ${root}.`
