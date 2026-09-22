/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * A map whose keys are drawn from a closed set, all of them OPTIONAL.
 *
 * This is what `z.record(someEnum, value)` meant: a partial map — an instance
 * reports only the buckets that actually occurred — that still refuses a key
 * outside the set.
 *
 * Neither obvious Effect spelling gives both halves:
 *
 * - `Schema.Record(Schema.Literals([...]), value)` closes the key set but makes
 *   every key REQUIRED, so a histogram of one bucket stops decoding.
 * - `Schema.Struct` with `optionalKey` fields makes them optional but STRIPS an
 *   unknown key rather than rejecting it — and strips it *before* any check
 *   runs, so a filter cannot see it either. Rejection would need
 *   `onExcessProperty: 'error'`, which is a decode-time option applying to the
 *   whole tree, tightening every sibling struct along with it.
 *
 * An OPEN record does not strip, so the filter still sees the offending key.
 * That is the one combination where both halves hold, and the filter carries no
 * JSON-Schema keyword, so the emitted document is unchanged.
 */
export const enumKeyedRecord = <V extends Schema.Top>(
  keys: readonly string[],
  value: V
): Schema.Codec<Readonly<Record<string, V['Type']>>, Readonly<Record<string, V['Encoded']>>> =>
  Schema.Record(Schema.String, value).pipe(
    Schema.check(
      Schema.makeFilter((entries: Readonly<Record<string, unknown>>) =>
        Object.keys(entries).every((key) => keys.includes(key))
          ? undefined
          : `an object whose keys are among: ${keys.join(', ')}`
      )
    )
  ) as never
