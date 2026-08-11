/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure interpolation of a `contentDir.editUrl` template into a concrete
 * "Edit this page" href. Consumed by the
 * presentation-layer markdown-page resolver, which already holds the derived
 * article slug and the active request language.
 *
 * It lives in `domain/utils/` — the pure, cross-layer home — because the
 * interpolation is a pure function of the template string plus plain scalar
 * inputs, with no I/O (mirrors the sibling `content-dir-slug.ts`).
 *
 * Placeholders (each may appear zero or more times):
 *   - `{slug}` → the resolved article slug (e.g. `installation`, or
 *     `guides/setup` for `slugFrom: 'filepath'` collections).
 *   - `{path}` → the source file path relative to the collection `directory`,
 *     i.e. `${slug}.md`.
 *   - `{lang}` → the active request language (e.g. `en` / `fr`); the empty
 *     string when the request carries no `/:lang/` prefix (`lang` undefined).
 *
 * A template with no placeholders passes through verbatim.
 */

interface BuildContentDirEditUrlInput {
  /** The `contentDir.editUrl` template with `{slug}` / `{path}` / `{lang}` tokens. */
  readonly template: string
  /** The resolved article slug substituted for `{slug}` (and into `{path}`). */
  readonly slug: string
  /** The active request language substituted for `{lang}`; empty when undefined. */
  readonly lang?: string
}

/**
 * Interpolate `{slug}` / `{path}` / `{lang}` into an edit-this-page href.
 *
 * `{path}` is substituted with `${slug}.md` directly from the `slug` input
 * (NOT from the already-substituted text), so the three tokens are independent
 * and the substitution order is irrelevant.
 */
export const buildContentDirEditUrl = ({
  template,
  slug,
  lang,
}: BuildContentDirEditUrlInput): string =>
  template
    .replaceAll('{slug}', slug)
    .replaceAll('{path}', `${slug}.md`)
    .replaceAll('{lang}', lang ?? '')
