/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The component `type` values that were RETIRED, and what each one is now.
 *
 * ## Why a table rather than an alias
 *
 * The catalogue reshape merges overlapping component types instead of keeping
 * both spellings alive. Aliasing was refused deliberately: two names for one
 * component means two entries in the kit index, two published doc sections, and
 * a config corpus that drifts into using whichever the author saw last. So the
 * old literal is DELETED from the union and the author is told where it went.
 *
 * That trade only pays if the message names the remedy. Without this table a
 * retired type falls through to the generic unknown-discriminant report, which
 * prints every legal value on one line — a list of ninety names that says
 * `responsive-grid` is not among them and nothing about `grid` being the thing
 * it became. The author has to know the answer to find it.
 *
 * ## The sibling table, and why they are separate
 *
 * `design/removed-keys.ts` does the same job one level up, for a removed
 * PROPERTY NAME. This one is for a rejected `type` VALUE — a different decode
 * finding (`unknown-discriminant`, not `excess-property`), reached down a
 * different branch of the reporter. They are deliberately not merged: a key and
 * a discriminant value share a shape but not a lookup, and folding them would
 * mean one table keyed on a path that means two different things.
 *
 * ## What a message has to do
 *
 * The same three properties its sibling states, for the same reasons:
 *
 * 1. it names the DESTINATION type, not just the offence — or, when there is
 *    no destination, says so outright and explains why, which is a different
 *    answer and not a weaker one;
 * 2. it fires on the FIRST offending value, without the rest of the config
 *    having to be valid;
 * 3. it reaches every decode seam — boot, `sovrium validate`, the
 *    `design-system` command and the `--watch` reload loop — which it does by
 *    riding the one shared decode boundary rather than being installed at four
 *    call sites.
 *
 * The watch loop is again why the wording is worth care: an author saving an
 * unmigrated config under `sovrium start --watch` reads this in the dev journal
 * at the moment they can act on it.
 */

/** One retired type: where it went, and what to tell the author. */
interface Retirement {
  /**
   * The type that replaces it, or `undefined` for an outright REMOVAL.
   *
   * Load-bearing, not documentation: the test beside this file asserts that a
   * named replacement is a type the union still accepts AND is named in the
   * message. A migration pointing at something that does not decode moves the
   * author from one invalid config to another.
   */
  readonly replacement: string | undefined
  /** What the author reads at the point of failure. */
  readonly message: string
}

/**
 * Every retired component type, mapped to the migration it earns.
 *
 * Keyed by the literal the author wrote. A key here MUST no longer be a member
 * of the component union — a name that is both retired and accepted would
 * advertise a migration nobody needs to make, and is caught by the unit test
 * beside this file rather than left to review.
 *
 * A `replacement` of `undefined` is a real and different answer, not a gap: it
 * says the capability is gone from this product and there is nothing to rename
 * to. Saying so plainly is the whole point — an author who reads "removed" and
 * an author who reads "renamed" have to do different things.
 */
const RETIRED_COMPONENT_TYPES: ReadonlyMap<string, Retirement> = new Map<string, Retirement>([
  [
    'responsive-grid',
    {
      replacement: 'grid',
      message: [
        '`responsive-grid` is now `grid`. The two declared exactly the same fields, so renaming',
        'the `type` and changing nothing else is a complete migration.',
        '',
        'A `grid` also does what the old name promised and the old renderer never did: it reads',
        '`props.columns` and `props.responsive.{sm,md,lg}` and emits the matching `grid-cols-*`',
        'utilities per breakpoint. Note that `props.responsive` (breakpoint → column count) is a',
        'different key from the top-level `responsive` field (breakpoint → prop overrides); both',
        'are legal on a `grid`.',
      ].join('\n'),
    },
  ],
  [
    'commentCount',
    {
      replacement: 'comments',
      message: [
        '`commentCount` is now `comments` with `display: count`. It was the same feature at a',
        'smaller size — same `table`, same `recordId`, same record resolution — so the two',
        'became one type with two displays.',
        '',
        'Migration: rename the `type` to `comments` and add `display: count`. `format` and',
        '`emptyText` carry over unchanged, and `emptyText` still defaults to "0 comments" under',
        '`display: count` (a thread defaults to "No comments yet" instead).',
      ].join('\n'),
    },
  ],
  [
    'pageSearch',
    {
      replacement: 'search-input',
      message: [
        '`pageSearch` is now `search-input` with `scope: page`.',
        '',
        'It merged with `searchInput`, which is the same box searching something else, into one',
        'type whose `scope` names the mechanism. `placeholder` and `maxResults` carry over',
        'unchanged, and `scope` is REQUIRED — the two mechanisms look alike and a default would',
        'silently hand you the other one.',
      ].join('\n'),
    },
  ],
  [
    'searchInput',
    {
      replacement: 'search-input',
      message: [
        '`searchInput` is now `search-input` with `scope: subscribers`.',
        '',
        'It merged with `pageSearch`, which is the same box searching something else, into one',
        'type whose `scope` names the mechanism. `debounceMs` and `minQueryLength` carry over',
        'unchanged, and `scope` is REQUIRED — the two mechanisms look alike and a default would',
        'silently hand you the other one.',
      ].join('\n'),
    },
  ],
  [
    'speech-bubble',
    {
      replacement: 'card',
      message: [
        '`speech-bubble` is now `card` with `variant: bubble`.',
        '',
        'It was a card with a tail and nothing else, so the tail became a variant. `content`,',
        '`children` and `side` carry over unchanged — `side: right` still flips the tail to the',
        'receiver, and omitting it still leaves it on the sender.',
      ].join('\n'),
    },
  ],
  [
    'record-drawer',
    {
      replacement: 'drawer',
      message: [
        '`record-drawer` is now `drawer` with a `dataSource`.',
        '',
        'It was a drawer bound to one record, so its keys became keys on `drawer`: `dataSource`,',
        '`recordFields`, `canEdit`, `actions`, `role` and `id` all carry over unchanged, and a',
        '`drawer` still takes `drawerSide` and `drawerSize` besides.',
        '',
        'Migration: rename the `type` to `drawer` and change nothing else. The `dataSource` is',
        'what makes it record-bound, so a drawer that has one still mounts the record island and',
        'still answers the table’s openDrawer dispatch.',
      ].join('\n'),
    },
  ],
  [
    'data-timeline',
    {
      replacement: 'timeline',
      message: [
        '`data-timeline` is now `timeline` with a `dataSource`.',
        '',
        'The two drew the same thing at different sizes — a structural rail of authored children,',
        'or a Gantt of bound records — so they became one type whose `dataSource` decides. Every',
        'key carries over unchanged, including the `props.startField` / `endField` / `groupBy`',
        'bindings and `defaultZoom`.',
        '',
        'Migration: rename the `type` to `timeline` and change nothing else. Note that a timeline',
        'may not declare both `children` and `dataSource` — the binding would win and the children',
        'would be dropped, so that combination is refused rather than resolved.',
      ].join('\n'),
    },
  ],
  [
    'tab-panel',
    {
      replacement: 'tabs',
      message: [
        '`tab-panel` is now an entry of `tabs.panels[]`.',
        '',
        'It was a component type with no renderer: the tabs island filtered its parent’s children',
        'for the literal and folded each one into a strip. So it existed to be a marker, and a',
        'reader who looked it up found a component that draws nothing.',
        '',
        'Migration: move each panel’s `props.id` / `props.label` / `props.description` /',
        '`props.disabled` and `content.body` into an entry of `panels[]` on the parent `tabs`,',
        'and leave each panel’s CHILDREN in the parent’s `children`, in the same order. `panels[i]`',
        'names the tab that shows `children[i]`, and declaring a different number of each is',
        'refused.',
      ].join('\n'),
    },
  ],
  [
    'modal',
    {
      replacement: 'dialog',
      message: [
        '`modal` is now `dialog` with `hydrate: false`.',
        '',
        'They drew the same overlay and answered the same trigger — an `onClick: { modal: <id> }`',
        'on any component — and the only real difference was that a `modal` shipped no JavaScript.',
        'That is now a property a `dialog` can have: `hydrate: false` renders the same',
        'enhancer-driven markup and mounts no island.',
        '',
        'Migration: rename the `type` to `dialog` and add `hydrate: false`. You GAIN two things',
        'the old type quietly withheld — a modal dropped its `children` on the floor, and it',
        'claimed `aria-modal="true"` while containing no focus. Omit `hydrate` to get the hydrated',
        'dialog instead, which does contain focus and restores it on close.',
      ].join('\n'),
    },
  ],
  [
    'token-swatch',
    {
      replacement: 'swatch',
      message: [
        '`token-swatch` is now `swatch`. The two drew the same chip from the same token, so the',
        'console-only spelling was folded into the public kit type.',
        '',
        'Migration: rename the `type` to `swatch` and change nothing else. `token`, `source`,',
        '`label`, `showHex`, `showOklch` and `contrastAgainst` all carry over unchanged, and',
        '`token` still names a token rather than a literal colour — a hex stops being true the',
        'moment the ramp it was copied from is retuned.',
      ].join('\n'),
    },
  ],
  [
    'easing-curve',
    {
      replacement: 'swatch',
      message: [
        '`easing-curve` is now `swatch` with `variant: curve`.',
        '',
        'It merged with `token-swatch`, which draws the other kind of design token, into one type',
        'whose `variant` says which is being drawn. A colour token is painted as a chip; a curve is',
        'plotted, because four control points are a shape and nobody chooses between two of them by',
        'reading the digits.',
        '',
        'Migration: rename the `type` to `swatch` and add `variant: curve`. `token`, `label`,',
        '`showValue` and `size` carry over unchanged, and `token` still takes either an easing name',
        'resolved against `design.motion.easings` or a `cubic-bezier(...)` literal. A name that',
        'resolves to nothing is still refused when the config is read.',
      ].join('\n'),
    },
  ],
  [
    'contrast-badge',
    {
      replacement: 'badge',
      message: [
        '`contrast-badge` is now `badge` with `variant: contrast`.',
        '',
        'It was a badge whose label is a measurement rather than a word, so the measurement became',
        'a variant. `foreground`, `background` and `threshold` carry over unchanged: both operands',
        'are still required, and `threshold` still grades at `AA` (4.5:1) by default or `AAA` (7:1),',
        'always at normal body-text size.',
      ].join('\n'),
    },
  ],
  [
    'design-scope',
    {
      replacement: 'card',
      message: [
        '`design-scope` is now `card` with `variant: scoped`.',
        '',
        'It was a boundary with no fields of its own, and a card already had a `variant` axis for',
        'exactly this kind of rendering mode. A scoped card emits the same `[data-design-app-scope]`',
        'marker and holds its children inside it, so the design being documented paints within the',
        'boundary while the page around it keeps its own.',
        '',
        'Migration: rename the `type` to `card` and add `variant: scoped`. `children` carries over',
        'unchanged. The scoped card draws no surface of its own, so the boundary stays invisible',
        'exactly as it was.',
      ].join('\n'),
    },
  ],
  [
    'data-table',
    {
      replacement: 'table',
      message: [
        '`data-table` is now `table`.',
        '',
        'It merged with `static-table`, which drew the same thing without fetching it, into one',
        'type whose `dataSource` decides. Declare one and you get the grid you had: sorting,',
        'filtering, grouping, selection, paging, saved views, inline edit — every key carries over',
        'unchanged, including `columns`, `columnsFrom`, `toolbar`, `views`, `rowExpand` and',
        '`onRowClick`.',
        '',
        'Migration: rename the `type` to `table` and change nothing else.',
      ].join('\n'),
    },
  ],
  [
    'static-table',
    {
      replacement: 'table',
      message: [
        '`static-table` is now `table` with no `dataSource`.',
        '',
        'It merged with `data-table`. Everything that made it a separate type was the ABSENCE of a',
        'binding, and an absence is not a name: a `table` that declares no `dataSource` fetches',
        'nothing and draws the rows you wrote, exactly as before.',
        '',
        'Migration: rename the `type` to `table` and change nothing else. `tableHeaders`,',
        '`tableRows` and `caption` keep their spellings — the type moved, the keys did not.',
        '',
        'One new refusal comes with the merge: a `table` may not declare both `tableRows` and',
        '`dataSource`. The binding would win and your authored rows would vanish with nothing on',
        'the page to say so, so that pair is refused rather than resolved.',
      ].join('\n'),
    },
  ],
  [
    'data-form',
    {
      replacement: 'form',
      message: [
        '`data-form` is now `form`.',
        '',
        'The two were built from the same field definition and drawn by the same renderer, so the',
        'only thing that ever differed between them was which name the author had last seen. A',
        '`form` is table-bound when it declares a `dataSource` and static when it does not, which',
        'is the distinction the second name was standing in for — now visible on the config',
        'itself rather than implied by a type name.',
        '',
        'Migration: rename the `type` to `form` and change nothing else. Every key carries over',
        'unchanged — `dataSource`, `fields`, `fieldGroups`, `layout`, `wizard`, `formRef`,',
        '`inlinePrefill`, `endpoint` and `action` — so a record-detail form or a quick-edit drawer',
        'still writes back through the records API exactly as it did.',
      ].join('\n'),
    },
  ],
  ...(
    [
      ['schema-json-editor', 'a JSON config editor'],
      ['schema-yaml-editor', 'a YAML config editor'],
      ['schema-form-editor', 'a no-code config builder'],
      ['schema-ai-agent', 'a natural-language config agent'],
    ] as const
  ).map<readonly [string, Retirement]>(
    ([name, what]) =>
      [
        name,
        {
          replacement: undefined,
          message: [
            `\`${name}\` has been removed, and nothing replaces it. It was ${what}: a surface`,
            'that edits the configuration from inside the running app.',
            '',
            'Self-hosted Sovrium is configuration-as-code. The config is the file you already',
            'have; edit it and restart, or run with `--watch`. The Admin Space is a read-only',
            'operational data console and never writes configuration (ADR-022), and the hosted',
            'visual and AI config-editing plane belongs to Sovrium Cloud (ADR-020).',
          ].join('\n'),
        },
      ] as const
  ),
])

/**
 * The migration message for a retired component type, or `undefined` when this
 * module has nothing to say about the value the author wrote.
 *
 * `undefined` is the common case and means "fall back to the accepted-values
 * list" — a typo deserves the list and a near-miss suggestion, which is exactly
 * what a retired name does not deserve.
 *
 * @param value - The `type` string the author wrote.
 */
export const migrationHintForRetiredComponentType = (value: string): string | undefined =>
  RETIRED_COMPONENT_TYPES.get(value)?.message

/**
 * The retirements, for the tests that keep the table honest.
 *
 * Exported for those assertions alone: a retired entry whose literal came back,
 * or one pointing at a replacement the union does not accept, would make this
 * module claim a migration that must not be made, and there is no way to notice
 * that by reading either file.
 */
export const RETIRED_COMPONENT_TYPE_ENTRIES: readonly (readonly [string, Retirement])[] = [
  ...RETIRED_COMPONENT_TYPES.entries(),
]
