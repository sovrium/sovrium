/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether a `$ref` value names a FILE to include, or a component template.
 *
 * ─── TWO MEANINGS, ONE KEY ─────────────────────────────────────────────────
 *
 * `$ref` carries two meanings in a YAML or JSON config. The multi-file loader
 * reads it as a file to include (`auth: { $ref: ./config/auth.yaml }`); the
 * component library reads it as the name of an `app.components` template to
 * place (`- $ref: plan-card`). Position cannot tell them apart — the templates
 * include partials inside page component trees, exactly where templates are
 * placed — so the VALUE decides.
 *
 * A value is a file reference when it is path-shaped: it contains a `/` or a
 * `\`, or a `.` (which covers `./`, `../` and any extension), or it is a URL.
 * Anything else is a bare name, which is never read from disk. A template name
 * is kebab-case (`^[a-z][a-z0-9-]*$`), so it can contain none of those: no value
 * can mean both, and no include that works has ever been a bare name — the
 * loader only reads `.yaml`, `.yml` and `.json`.
 *
 * ─── WHY ONE FUNCTION ──────────────────────────────────────────────────────
 *
 * Every reader of the `$ref` graph asks this question: the resolver, the watch
 * set, and `init --from-url`'s remote-reference refusal. Three copies of the
 * rule are how one of them comes to follow a name the other two leave alone.
 */

/** A scheme followed by `//` — `https://…`, `file://…`. */
const URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * Whether a `$ref` value is a file (or URL) reference rather than a template
 * name.
 *
 * @param value - The string held by a `$ref` key.
 * @returns `true` for a path or URL, `false` for a bare name.
 */
export const isFileRefValue = (value: string): boolean =>
  /[/\\.]/.test(value) || URL_PATTERN.test(value)
