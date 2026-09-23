/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Typed accessors over the generated manual payload.
 *
 * The two generated modules are `@ts-nocheck` because a `with { type: 'file' }`
 * import has no static type; this module re-types them and is the only place
 * that cast is written.
 *
 * ## Read it lazily, or the binary pays for a manual nobody asked for
 *
 * NOTHING on the boot path may import this module. `sovrium docs` reaches it
 * through an `await import()` inside its handler, so a `sovrium start` loads
 * neither the fragment manifest nor the behaviour payload — asserted by a
 * child-process probe in `embedded-docs-boot.test.ts`, modelled on the
 * better-auth probe in `src/infrastructure/layers/app-layer.test.ts`.
 *
 * The mechanism works identically in both modes: in dev the embedded value is a
 * real on-disk path, in the compiled binary a `$bunfs/...` path, and
 * `Bun.file()` reads either.
 */

import { EMBEDDED_DOCS_BEHAVIOUR as RAW_BEHAVIOUR } from './embedded-docs-behaviour.generated'
import { EMBEDDED_DOCS as RAW_DOCS } from './embedded-docs.generated'

/** One story's contribution to an article's Behaviour block. */
export interface EmbeddedBehaviourStory {
  readonly id: string
  readonly title: string
  /**
   * The ✅ acceptance criteria, verbatim.
   *
   * A ✅ means the spec is AUTHORED and is not `test.fixme()`. It is not a
   * claim that it passes — `bun run progress` never runs Playwright — and
   * [internal ref] D9 says so where a reader of the manual can see it.
   */
  readonly criteria: readonly string[]
}

// `with { type: 'file' }` imports return a path string at runtime while TS
// types them as the imported module's shape. Cast through `unknown` to recover
// the true runtime type — the same recovery `embedded-static-assets.ts` makes.
const DOCS = RAW_DOCS as unknown as Readonly<Record<string, string>>
const BEHAVIOUR = RAW_BEHAVIOUR as unknown as Readonly<
  Record<string, readonly EmbeddedBehaviourStory[]>
>

/** Every documentation file the binary ships, by repo-relative path. */
export const embeddedDocPaths = (): readonly string[] => Object.keys(DOCS).toSorted()

// eslint-disable-next-line functional/no-let -- one-shot module-level memo for the value→keys index; built on the first read that needs it rather than on import, so a caller whose key already resolves never pays for it
let keysByEmbeddedValue:
  Readonly<Partial<Record<string, readonly (readonly [string, string])[]>>> | undefined

/**
 * Every repo-relative key the payload files one embedded VALUE under.
 *
 * Usually exactly one — but it CAN be more than one, and that is why this
 * answers a list rather than a key. The `$bunfs` name a `with { type: 'file' }`
 * import resolves to inside the compiled binary is derived from the file's
 * CONTENT, not from its path: two byte-identical fragments at different paths
 * collapse onto a single `/$bunfs/root/<name>-<hash>.md`, and the reverse
 * lookup is then genuinely ambiguous. Every fragment in the manual has unique
 * content today, so no collision exists — but `readEmbeddedDoc` refuses a
 * collision by name rather than picking one, because rendering the wrong
 * article silently is worse than the loud failure this replaced.
 */
const keysForEmbeddedValue = (embeddedValue: string): readonly (readonly [string, string])[] => {
  if (keysByEmbeddedValue === undefined) {
    // eslint-disable-next-line functional/no-expression-statements -- module-level memo assignment
    keysByEmbeddedValue = Object.groupBy(Object.entries(DOCS), ([, value]) => value)
  }
  return keysByEmbeddedValue[embeddedValue] ?? []
}

/**
 * The markdown of one fragment, by the repo-relative path the manifest keys it
 * under — `src/domain/models/app/llms/llms.docs.md`.
 *
 * It ALSO accepts the embedded value itself, which is what a caller holding a
 * manifest's `body` ends up with inside the compiled binary. A
 * `with { type: 'file' }` import resolves to a real on-disk path under
 * `bun run` and to `/$bunfs/root/<name>-<hash>.md` in the standalone binary;
 * the `$bunfs` form carries no directory at all, so cutting it back to a
 * repo-relative key is impossible and the raw path arrives here instead. Two
 * imports of one file share one `$bunfs` path, so that raw path IS this
 * payload's value for the fragment — recovering the key by a reverse lookup is
 * exact, and `Bun.file()` then reads either form.
 *
 * Refuses an unresolvable reference BY NAME rather than returning an empty
 * string. A manual that answers an unknown article with silence is a manual
 * whose reader cannot tell a missing fragment from an empty one, and the caller
 * here is a typed manifest: an unknown key means the manifest and the payload
 * have diverged, which is exactly what `Generated Assets Drift` exists to
 * catch.
 */
export const readEmbeddedDoc = async (reference: string): Promise<string> => {
  const embedded = DOCS[reference]
  if (embedded !== undefined) return Bun.file(embedded).text()

  const aliases = keysForEmbeddedValue(reference)
  if (aliases.length === 1) return Bun.file(reference).text()

  const message =
    aliases.length > 1
      ? `Ambiguous embedded documentation at '${reference}': the payload files it under ` +
        `${aliases.map(([key]) => key).join(', ')}. Two fragments with identical bytes share ` +
        'one embedded path, so the fragment cannot be identified; give them distinct content.'
      : `No embedded documentation at '${reference}'. The manual ships ` +
        `${Object.keys(DOCS).length} file(s); regenerate with \`bun run build:docs\` if a ` +
        'fragment was added or moved.'
  // eslint-disable-next-line functional/no-throw-statements -- refusal by name: an unresolvable reference means the manifest and the payload have diverged, and answering with an empty string would render a blank article instead
  throw new Error(message)
}

/**
 * The stories and criteria one article publishes, or an empty list.
 *
 * Empty is a legitimate answer here, unlike above: an article that cites no
 * story renders no Behaviour block, and the coverage analysis in `bun run
 * progress` is what decides whether that is acceptable. Throwing would make
 * this reader adjudicate a question it cannot see the denominator of.
 */
export const embeddedBehaviourFor = (slug: string): readonly EmbeddedBehaviourStory[] =>
  BEHAVIOUR[slug] ?? []
