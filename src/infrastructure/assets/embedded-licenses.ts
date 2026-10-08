/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Typed access to the third-party license texts the binary embeds
 * (`sovrium licenses`).
 *
 * The payload is `embedded-licenses.generated.json`, written from `licenses/`
 * by `scripts/build/generate-embedded-licenses.ts` and held byte-current by
 * `Generated Assets Drift`. Some of Sovrium's dependencies (MPL-2.0, OFL-1.1,
 * PSF-2.0) require their license text to travel with the code; a standalone
 * binary has no directory beside it to carry a file, so it carries the texts.
 *
 * Read lazily: nothing on the `sovrium start` boot path imports this module.
 * The `with { type: 'file' }` value is a path (a `/$bunfs/...` one inside the
 * compiled binary) and is only ever handed to `Bun.file()`.
 */

import {
  isEmbeddedLicensesPayload,
  type EmbeddedLicensesPayload,
} from './embedded-licenses-payload'
// eslint-disable-next-line import/extensions -- a `with { type: 'file' }` import names one file, and its extension is part of the name
import RAW_PAYLOAD from './embedded-licenses.generated.json' with { type: 'file' }

export type { EmbeddedLicensesPayload } from './embedded-licenses-payload'

// A `with { type: 'file' }` import is a path string at runtime, while TypeScript
// types it as the JSON's shape — the same recovery `embedded-changelog.ts` makes.
// eslint-disable-next-line sovrium/no-double-assertion -- a `with { type: 'file' }` import is a path at runtime but typed as the JSON; the decoded payload is checked by isEmbeddedLicensesPayload
const PAYLOAD_PATH = RAW_PAYLOAD as unknown as string

/**
 * The embedded payload. Rejects rather than returning an empty list: "this
 * binary carries no third-party licenses" would be a false statement.
 */
export const loadEmbeddedLicenses = async (): Promise<EmbeddedLicensesPayload> => {
  const decoded: unknown = await Bun.file(PAYLOAD_PATH).json()
  if (!isEmbeddedLicensesPayload(decoded) || decoded.notices.length === 0) {
    throw new Error(
      'The embedded third-party license payload is not readable by this binary. ' +
        'Regenerate it with `bun run build:licenses`.'
    )
  }
  return decoded
}
