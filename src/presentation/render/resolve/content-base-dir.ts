/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Content base-directory anchor for relative markdown/contentDir paths.
 *
 * Markdown sources declared via `markdown.file`, `page.source.file`, and
 * `contentDir.directory` are RELATIVE paths in the schema. Historically the
 * resolvers anchored them to `process.cwd()`, which only works when the server
 * happens to be started from the config-file directory. The deployed binary
 * (and the E2E harness, which spawns the CLI from the repo root with an inline
 * `APP_SCHEMA`) run from an arbitrary CWD, so a relative `content/docs/en`
 * resolved to nothing and the article rendered empty.
 *
 * The anchor is read from the `SOVRIUM_CONTENT_DIR` env var. The CLI sets it to
 * the config-file directory at startup (`dirname(configPath)`), mirroring
 * `resolveDefaultPublicDir`'s config-dir anchoring. The E2E harness sets it
 * explicitly (it has no config-file path to derive an anchor from). When unset,
 * the resolvers fall back to `process.cwd()` so non-docs apps (and existing
 * callers) keep their current behaviour.
 *
 * Reading the env var here (rather than threading a value through the SSR call
 * chain) keeps the wiring inside the presentation-rendering layer and avoids a
 * cross-layer dependency from `infrastructure-server` into this module.
 */

/**
 * The directory relative content paths should be resolved against. Returns the
 * `SOVRIUM_CONTENT_DIR` env override when set, otherwise `process.cwd()`
 * (the historical default).
 */
export const getContentBaseDir = (): string => {
  const override = process.env['SOVRIUM_CONTENT_DIR']
  return typeof override === 'string' && override.length > 0 ? override : process.cwd()
}
