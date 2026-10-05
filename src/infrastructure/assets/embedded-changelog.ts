/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Typed access to the release notes the binary embeds (`sovrium changelog`).
 *
 * The payload is `embedded-changelog.generated.json`, written from
 * `CHANGELOG.public.md` by `scripts/build/generate-embedded-changelog.ts` and
 * held byte-current by `Generated Assets Drift`. Its shape and grammar are the
 * kernel's (`@/domain/kernel/markdown/release-notes`); this module only loads it.
 *
 * ## Read it lazily
 *
 * Nothing on the `sovrium start` boot path may import this module. The CLI verb
 * reaches it through an `await import()` at the point of use, as `sovrium docs`
 * does for the manual — the payload is ~250 KB nobody else needs.
 *
 * ## No keys derived from a path
 *
 * The file is embedded with `with { type: 'file' }`, whose runtime value is a
 * path: a real one in dev, a directory-less `/$bunfs/root/<name>-<hash>.json`
 * inside the compiled binary. That value is only ever handed to `Bun.file()` —
 * never parsed, split or compared — so nothing here can depend on which of the
 * two it is. Releases are addressed by the `version` field INSIDE the payload.
 */

import {
  isEmbeddedChangelogPayload,
  type EmbeddedChangelogPayload,
  type ReleaseNotes,
} from '@/domain/kernel/markdown/release-notes'
// eslint-disable-next-line import/extensions -- a `with { type: 'file' }` import names one file, and its extension is part of the name
import RAW_PAYLOAD from './embedded-changelog.generated.json' with { type: 'file' }

export type { EmbeddedChangelogPayload, ReleaseNotes } from '@/domain/kernel/markdown/release-notes'

// A `with { type: 'file' }` import is a path string at runtime, while TypeScript
// types it as the JSON's shape. Cast through `unknown` to recover the runtime
// type — the same recovery `embedded-skills.ts` and `embedded-docs.ts` make.
const PAYLOAD_PATH = RAW_PAYLOAD as unknown as string

/**
 * The embedded payload, decoded once per call.
 *
 * Rejects rather than returning an empty list when the payload cannot be read
 * or has a shape this code predates: an empty changelog would read as "this
 * binary has no releases", which is false, and the caller should say the
 * payload is broken instead.
 */
export const loadEmbeddedChangelog = async (): Promise<EmbeddedChangelogPayload> => {
  const decoded: unknown = await Bun.file(PAYLOAD_PATH).json()
  if (!isEmbeddedChangelogPayload(decoded)) {
    // eslint-disable-next-line functional/no-throw-statements -- a payload of the wrong shape is a build defect, not an empty answer
    throw new Error(
      'The embedded changelog payload is not readable by this binary. ' +
        'Regenerate it with `bun run build:changelog`.'
    )
  }
  return decoded
}

/** Every embedded release, newest first as `CHANGELOG.public.md` orders them. */
export const embeddedReleases = async (): Promise<readonly ReleaseNotes[]> =>
  (await loadEmbeddedChangelog()).releases
