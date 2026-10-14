/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The keys a promoted component type refuses, with the sentence that names the
 * replacement.
 *
 * Each of these types was an option of an older one (`select` with `native:
 * true`, `input` with `inputType: one-time-code` …) and now carries the
 * behaviour in its own name, under the name shadcn/ui gives it. The key that
 * selected the behaviour on the older type means nothing on the new one, so an author who
 * carries it across is told what to do instead of being shown a bare "unknown
 * key". Wired into the decode-failure reporter beside the table and form
 * precedents (`data/table/removed-keys.ts`, `data/form/removed-keys.ts`).
 */

/**
 * Refused keys, per type: the key, then the message. The promoted types refuse
 * the switch that selected them on the older type; `select` and `card` refuse the keys that
 * left with the behaviour they promoted.
 */
const REFUSED_ON_PROMOTED_TYPE: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map([
  [
    'card',
    new Map([
      [
        'side',
        '`side` does not apply to a `card`: a speech bubble is now `type: bubble` with `align: start` or `align: end`.',
      ],
    ]),
  ],
  [
    'select',
    new Map([
      [
        'native',
        "`native` does not apply to a `select`: the browser's own control is now `type: native-select`.",
      ],
      [
        'searchable',
        '`searchable` does not apply to a `select`: type-ahead is now `type: combobox`.',
      ],
      [
        'searchPlaceholder',
        '`searchPlaceholder` does not apply to a `select`: type-ahead is now `type: combobox`.',
      ],
      [
        'allowCustomValue',
        '`allowCustomValue` does not apply to a `select`: type-ahead is now `type: combobox`.',
      ],
      [
        'chips',
        '`chips` does not apply to a `select`: chips are drawn by `type: combobox` with `multiple: true`.',
      ],
    ]),
  ],
  [
    'bubble',
    new Map([
      [
        'side',
        '`side` does not apply to a `bubble`: it is now `align: start` or `align: end` (`side: left` is `align: start`, `side: right` is `align: end`).',
      ],
    ]),
  ],
  [
    'carousel',
    new Map([
      [
        'layout',
        '`layout` does not apply to a `carousel`: a `carousel` is always one track; drop the key.',
      ],
      [
        'gridColumns',
        '`gridColumns` does not apply to a `carousel`: it is for grid layout only and stays on `type: gallery`.',
      ],
      [
        'featured',
        '`featured` does not apply to a `carousel`: it is for grid layout only and stays on `type: gallery`.',
      ],
    ]),
  ],
  [
    'combobox',
    new Map([
      [
        'searchable',
        '`searchable` does not apply to a `combobox`: a `combobox` is always searchable; drop the key.',
      ],
      [
        'native',
        "`native` does not apply to a `combobox`: the browser's own control is `type: native-select`.",
      ],
    ]),
  ],
  [
    'input-otp',
    new Map([
      [
        'inputType',
        '`inputType` does not apply to an `input-otp`: an `input-otp` is always a one-time code; drop the key.',
      ],
    ]),
  ],
  [
    'native-select',
    new Map([
      [
        'native',
        "`native` does not apply to a `native-select`: it is always the browser's own control; drop the key.",
      ],
      [
        'searchable',
        '`searchable` does not apply to a `native-select`: type-ahead is `type: combobox`.',
      ],
      [
        'searchPlaceholder',
        '`searchPlaceholder` does not apply to a `native-select`: type-ahead is `type: combobox`.',
      ],
      [
        'allowCustomValue',
        '`allowCustomValue` does not apply to a `native-select`: type-ahead is `type: combobox`.',
      ],
    ]),
  ],
])

/**
 * The message for a key a promoted type refuses, or `undefined` when this
 * module has nothing to say about it.
 *
 * @param discriminant - The node's `type` literal.
 * @param key - The property name the author wrote.
 */
export const migrationHintForPromotedTypeKey = (
  discriminant: string | undefined,
  key: string
): string | undefined =>
  discriminant === undefined ? undefined : REFUSED_ON_PROMOTED_TYPE.get(discriminant)?.get(key)

/** Every refused key, per type, for the test that pins each message. @internal */
export const PROMOTED_TYPE_REFUSED_KEYS: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(
    [...REFUSED_ON_PROMOTED_TYPE].map(([type, keys]) => [type, [...keys.keys()]] as const)
  )
