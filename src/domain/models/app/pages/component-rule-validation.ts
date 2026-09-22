/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Families 10, 11 and 13 of the page decode rules — the ones about a
 * COMPONENT's own declarations rather than about a page-level binding.
 *
 * Split out of `page-binding-validation.ts` only so that file stays under its
 * per-file `max-lines` cap, exactly as `shared-filter-validation.ts` was. These
 * are called from `collectPageBindingViolations` and from nowhere else, and
 * share its contract: pure, no I/O, human-readable messages, empty when the
 * page is well-formed.
 *
 * @see ./page-binding-validation.ts — the caller, and the other ten families
 */

// ---------------------------------------------------------------------------
// 10. The current-item marker
// ---------------------------------------------------------------------------

/**
 * `activeWhen` decides which item of a set is the CURRENT one; `activeProps` is
 * what that item gets. Each is inert without the other, and both failures are
 * silent: props that are never merged, or a comparison with nothing to do.
 *
 * The third rule is the one worth having. `activeWhen` is evaluated AFTER the
 * `$window` / `$query` / `$param` / `$app` substitution passes, so a reference
 * on either side is what makes the answer vary between renders. Two literals
 * cannot vary — the author wrote either "always current" or "never current",
 * and in a rail of three presets the first marks all three and the second marks
 * none. Anchored on the presence of a `$` on EITHER side, so a comparison
 * between two references (`$query.tab` against `$param.section`) stays legal.
 */
export function activeMarkerViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return nodes.flatMap((node) => {
    const { activeWhen, activeProps } = node
    if (activeWhen === undefined && activeProps === undefined) return []
    if (activeWhen === undefined) {
      return [
        `${label} declares activeProps without activeWhen — props that would never be merged, because nothing says when this item is the current one`,
      ]
    }
    if (activeProps === undefined) {
      return [
        `${label} declares activeWhen without activeProps — a comparison with nothing to apply`,
      ]
    }
    return isRecord(activeWhen) ? literalComparisonViolation(activeWhen, label) : []
  })
}

/**
 * A comparison between two literals cannot vary between renders, so in a rail
 * of three presets either all three are current or none is.
 *
 * Anchored on a `$` appearing on EITHER side, so a comparison between two
 * references stays legal.
 */
function literalComparisonViolation(
  activeWhen: Readonly<Record<string, unknown>>,
  label: string
): readonly string[] {
  const value = typeof activeWhen['value'] === 'string' ? activeWhen['value'] : ''
  const equals = typeof activeWhen['equals'] === 'string' ? activeWhen['equals'] : ''
  return value.includes('$') || equals.includes('$')
    ? []
    : [
        `${label} declares activeWhen comparing two literals ("${value}" against "${equals}") — the answer is the same on every render, so every item of the set is current or none is; one side must be a $-reference`,
      ]
}

// ---------------------------------------------------------------------------
// 11. Visibility polarity
// ---------------------------------------------------------------------------

/**
 * `declares` and `unlessDeclares` are the two halves of an alternating body and
 * belong on SIBLING components, never on one.
 *
 * Together on a single component they are a contradiction the decoder can see:
 * the host app either declares `automations` or it does not, so the component
 * renders on no instance at all. Nothing at runtime would say why — it would
 * simply never appear, which is the failure mode the closed capability set
 * exists to make loud.
 *
 * Only the SAME capability is refused. `declares: automations` beside
 * `unlessDeclares: agents` is a perfectly meaningful "for apps that automate but
 * have no agents", and refusing it would be a false refusal.
 *
 * `runtime` / `unlessRuntime` are refused on the same reading, one subject
 * further out: AI either runs on this deployment or it does not, so a component
 * demanding both renders on no instance at all. The two PAIRS are checked
 * independently — `runtime: ai` beside `unlessDeclares: agents` is the
 * meaningful "an app that can reach a model without declaring an agent of its
 * own", and refusing it would be false.
 */
export function visibilityPolarityViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return nodes
    .map((node) => node['visibility'])
    .filter(isRecord)
    .flatMap((visibility) => [
      ...contradictoryPolarity(
        visibility,
        'declares',
        'unlessDeclares',
        (capability) =>
          `${label} declares a component requiring the host app to declare "${capability}" AND to not declare it — it could never render`
      ),
      ...contradictoryPolarity(
        visibility,
        'runtime',
        'unlessRuntime',
        (capability) =>
          `${label} declares a component requiring "${capability}" to be runnable on this deployment AND not to be — it could never render`
      ),
    ])
}

/**
 * One polarity pair naming the same capability on one component.
 *
 * Parameterised rather than duplicated because the two pairs differ only in
 * which keys they read and in what the contradiction is ABOUT — the reading,
 * and the "only the same value is refused" scope, are identical.
 */
function contradictoryPolarity(
  visibility: Readonly<Record<string, unknown>>,
  positive: string,
  negative: string,
  message: (capability: string) => string
): readonly string[] {
  const held = visibility[positive]
  return typeof held === 'string' && held === visibility[negative] ? [message(held)] : []
}

// ---------------------------------------------------------------------------
// 13. System row templates are read-only
// ---------------------------------------------------------------------------

/**
 * Types a `{ system }` row template may not contain, at ANY depth.
 *
 * The same one the specimen refuses, for a related but distinct reason. It
 * renders a live submit control unconditionally, on the create branch and the
 * update branch alike, and in both of its modes.
 *
 * WHY THE `{ table }` ARM IS NOT SUBJECT TO THIS. A table-bound row template
 * expands over records of a DECLARED table: the row has an identity the platform
 * knows, the records API is a write path it owns, and `tables[].fields[]
 * .permissions` is enforced on the way through. None of that is true of a system
 * row. It is an arbitrary endpoint's JSON — no table identity, so no field
 * permissions to apply, and no write path the platform can address. A form
 * cloned once per row would be N live submit controls whose targets were
 * interpolated from values the SERVER read on the caller's behalf: a write path
 * minted out of a read the caller never made themselves.
 *
 * Depth-independent for the specimen's reason: a form three levels inside a card
 * is the same live control as one at the top.
 */
const SYSTEM_ROW_TEMPLATE_REFUSED_TYPES: ReadonlySet<string> = new Set(['form'])

/**
 * A `{ system }` rows binding that clones its children per row carries no live
 * submit control.
 *
 * Scoped by two structural facts and no type list, so it cannot go stale into a
 * false refusal: the node binds `dataSource.system`, and it has CHILDREN. A
 * `table` or a `chart` over the same endpoint has no children and is never
 * read here; nor is a `{ table }` binding, which is a different write story
 * entirely.
 */
export function systemRowTemplateViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return nodes
    .filter((node) => {
      const { dataSource, children } = node
      return (
        isRecord(dataSource) &&
        isRecord(dataSource['system']) &&
        (children as unknown[])?.length > 0
      )
    })
    .flatMap((node) =>
      walk(node['children'])
        .map((child) => child['type'])
        .filter(
          (type): type is string =>
            typeof type === 'string' && SYSTEM_ROW_TEMPLATE_REFUSED_TYPES.has(type)
        )
        .map(
          (type) =>
            `${label} clones a \`${type}\` once per row of a system source — a system row has no table identity, so no field permissions to apply and no write path the platform owns; the submit control would be minted from a read the server made on the caller's behalf. Put the form on a page of its own.`
        )
    )
}

// ---------------------------------------------------------------------------
// 14. A code block composed from a system endpoint's rows (`contentFrom`)
// ---------------------------------------------------------------------------

/**
 * The four ways `code.contentFrom` can be declared and mean nothing.
 *
 * They live here rather than in a `Schema.check` on `CodeContentFromSchema`
 * because three of them are about the field's SIBLINGS — and a check on the
 * field alone cannot see them — while `buildComponentUnion` has no per-branch
 * refinement hook that could see the whole `code` node.
 *
 * Each refusal is a silent failure made loud:
 *
 *  - `content` beside it — two answers to "what is in this block", one of which
 *    the resolver discards without saying so;
 *  - `children` beside it — `renderCode` falls back to `content ?? children`, so
 *    a declared child becomes unreachable the moment the fold produces content;
 *  - a `template` with no `$record.` reference — every row renders the same
 *    constant, so a four-row endpoint prints one line four times and the author
 *    reads it as "the endpoint returned one row";
 *  - a `contentFrom` INSIDE a system row template — the node is cloned once per
 *    row and each clone carries its own binding, so one declaration becomes N
 *    render-path fetches. `MAX_EXPANDED_ROWS` caps the clones at 1000; nothing
 *    would cap the reads they each make.
 */
export function codeContentFromViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return [
    ...contentFromSiblingViolations(nodes, label),
    ...contentFromNestingViolations(nodes, label),
  ]
}

/** The three per-node refusals: a sibling answer, dead children, a dead template. */
function contentFromSiblingViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return nodes
    .filter((node) => isRecord(node['contentFrom']))
    .flatMap((node) => {
      const { content, children } = node
      const { template } = node['contentFrom'] as Record<string, unknown>
      return [
        ...(content === undefined
          ? []
          : [
              `${label} declares both \`content\` and \`contentFrom\` on one code block — two answers to what the block holds, and the composed one wins silently. Keep the fold, or keep the literal.`,
            ]),
        ...((children as unknown[])?.length > 0
          ? [
              `${label} declares \`children\` on a code block that composes its content from \`contentFrom\` — the renderer falls back to children only when there is no content, so these would never render.`,
            ]
          : []),
        ...(typeof template === 'string' && !template.includes('$record.')
          ? [
              `${label} declares a \`contentFrom.template\` with no \`$record.\` reference — every row would render the same constant, so a four-row endpoint prints one line four times and reads as a one-row result.`,
            ]
          : []),
      ]
    })
}

/**
 * The nesting refusal: a `contentFrom` anywhere below a node that clones its
 * children per row.
 *
 * Scoped by the same two structural facts as {@link systemRowTemplateViolations}
 * — the node binds `dataSource.system` and it HAS children — so it cannot go
 * stale into a false refusal as component types come and go.
 */
function contentFromNestingViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return nodes
    .filter((node) => {
      const { dataSource, children } = node
      return (
        isRecord(dataSource) &&
        isRecord(dataSource['system']) &&
        (children as unknown[])?.length > 0
      )
    })
    .flatMap((node) =>
      walk(node['children'])
        .filter((child) => isRecord(child['contentFrom']))
        .map(
          () =>
            `${label} nests a \`contentFrom\` code block inside a system row template — the block is cloned once per row and every clone fetches its own binding, so one declaration becomes one render-path read per row. Bind the endpoint once, outside the template.`
        )
    )
}

// ---------------------------------------------------------------------------
// 15. System row templates nest exactly one level deep
// ---------------------------------------------------------------------------

/**
 * How many `{ system }` row templates may sit inside one another.
 *
 * TWO — an outer template and one inner. That is the shape with a real
 * consumer: a card drawn once per subject, listing that subject's OWN rows
 * inside itself, which is the one thing a single flat rows binding cannot
 * express because `rowsKey` is one flat `body[key]` lookup and `$record.` walks
 * no path.
 *
 * ─── WHY IT IS BOUNDED AT ALL ──────────────────────────────────────────────
 *
 * The reads are SEQUENTIAL IN THE RENDER PATH and they multiply. An outer
 * template expands up to `MAX_EXPANDED_ROWS` rows, and each clone carrying an
 * inner binding costs one more render-path read: an outer read of N rows
 * becomes 1 + N reads before a byte of HTML is written. That is an N+1, it is
 * accepted deliberately for depth 2 because the per-row read is the page's
 * whole purpose (each card genuinely lists different rows), and it is refused
 * at depth 3 because a third level makes it N x M — a page-weight and
 * render-latency cliff an author cannot see coming from the config, in exactly
 * the way `MAX_EXPANDED_ROWS` exists to prevent one level up.
 *
 * ─── WHY A DEPTH BOUND AND NOT A COST BOUND ────────────────────────────────
 *
 * A cost bound is not decidable here. Decode time knows the SHAPE of the
 * binding and nothing about how many rows the endpoint will answer with, so the
 * only honest static question is how many levels an author wrote. The runtime
 * fan-out ceiling is a separate, additional guard and lives with the resolver
 * that spends it.
 *
 * ─── WHY THIS DOES NOT REOPEN RULE 14 ──────────────────────────────────────
 *
 * `contentFrom` stays refused inside a row template at ANY depth, and the two
 * rules do not disagree. A nested rows template's N reads are N DIFFERENT reads
 * — that is what makes them worth their cost — and it has no non-nested
 * spelling. A `contentFrom` block has one: bind the endpoint once, outside the
 * template. Where a cheaper spelling of the same page exists, the expensive one
 * is refused; where none does, it is bounded instead.
 */
const MAX_SYSTEM_ROW_TEMPLATE_DEPTH = 2

/** Whether a node is a `{ system }` binding that clones its children per row. */
function isSystemRowTemplate(node: Readonly<Record<string, unknown>>): boolean {
  const { dataSource, children } = node
  return (
    isRecord(dataSource) && isRecord(dataSource['system']) && (children as unknown[])?.length > 0
  )
}

/**
 * A `{ system }` row template nested more than one level inside another.
 *
 * Counts TEMPLATES on the path and not nodes, so the ordinary containers
 * between a card and its list cost nothing — an author nests markup freely and
 * only a second data binding consumes depth.
 *
 * `nodes` is the caller's FLATTENED walk, so every template on a chain appears
 * in it. That is why the test looks three deep from each one rather than
 * carrying a depth counter down: the middle link of a depth-3 chain finds only
 * two levels below itself and stays silent, so one over-deep chain reports
 * exactly once, from its outermost template.
 */
export function systemRowTemplateDepthViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  const nestedTemplates = (
    node: Readonly<Record<string, unknown>>
  ): readonly Record<string, unknown>[] => walk(node['children']).filter(isSystemRowTemplate)

  return nodes
    .filter(isSystemRowTemplate)
    .flatMap(nestedTemplates)
    .flatMap(nestedTemplates)
    .map(
      () =>
        `${label} nests a \`{ system }\` row template more than ${MAX_SYSTEM_ROW_TEMPLATE_DEPTH} levels deep — each level multiplies the render-path reads by its own row count, so a third level is an N x M fan-out before any HTML is written. Two levels is the bound: a template, and one template inside it.`
    )
}

// ---------------------------------------------------------------------------
// 16. `repeat` sits in exactly one position, and what it may contain
// ---------------------------------------------------------------------------

/**
 * The four refusals around `container.repeat`.
 *
 * `repeat` renders a container's children once per element of an array the
 * BOUND RECORD already carries. That is resolvable in exactly one place -- the
 * client-side slot of a record-bound `drawer`, where a record has been fetched
 * -- and every other position is inert config with no visible symptom. So the
 * position is a decode rule rather than a runtime fallback, for the reason
 * family 1 already gives: it fails silently at runtime and is decidable offline.
 *
 * Four rules, one walk, because all four need the SAME two bits of ancestry
 * that a flat node list throws away -- whether the node is inside a record-bound
 * drawer's `children`, and whether some ancestor already repeats:
 *
 *  1. a `repeat` OUTSIDE that slot -- nothing would iterate it;
 *  2. a `repeat` INSIDE another `repeat` -- nested iteration is a named
 *     non-goal, and `$record.` becomes ambiguous the moment it is allowed:
 *     the token would name a key on the inner element and on the outer one
 *     with no way to say which;
 *  3. a `visibility.record` on or under a `repeat` -- see below, this is v1's
 *     honest cost and the one refusal that says "v1" rather than "never";
 *  4. a `{ system }` READ inside the drawer slot whose binding carries a
 *     `$record.` reference -- the silent-empty trap, see below.
 *
 * ---- WHY (3) IS REFUSED RATHER THAN IGNORED OR EVALUATED -------------------
 *
 * A per-element gate that fires on the SERVER for a system row template and
 * silently does nothing in a CLIENT-side repeat is the failure
 * `system-rows-template-resolver.ts` warns about by name: an access-control
 * shape that holds in one path and evaporates in the other. Ignoring it ships
 * that. Evaluating it means importing the visibility evaluator into the island
 * and spending payload budget, which is a follow-up with a measurement
 * attached. v1 refuses, loudly, and the message says v1.
 *
 * ---- WHY (4) IS HERE AT ALL -----------------------------------------------
 *
 * This one predates `repeat` and is the trap that made it necessary.
 * `expandSystemRowTemplates` runs at SSR and walks `children` unconditionally;
 * `isSystemRowTemplate` skips island types, so the `drawer` itself is skipped,
 * but NOT a plain `container` nested inside its children. So an author binding
 * `endpoint: '/.../runs/$record.id'` in the slot gets the template expanded at
 * SSR against the LITERAL token, the read resolves to nothing, and
 * `expandTemplate`'s fail-closed arm returns `children: []`. An empty slot, no
 * error, no log. A STATIC endpoint in the slot is untouched -- it expands
 * correctly and shows the same rows for every record, which is a real thing to
 * want -- so the rule is anchored on the `$record.` reference and not on the
 * binding.
 */
export function repeatPlacementViolations(
  page: Readonly<Record<string, unknown>>,
  label: string
): readonly string[] {
  const root: RepeatContext = { inDrawerSlot: false, inRepeat: false }
  return [
    ...walkRepeatContext(page['components'], root, label),
    ...walkRepeatContext(page['layout'], root, label),
  ]
}

/** The two bits of ancestry the four rules above need, and a flat walk loses. */
interface RepeatContext {
  /** Some ancestor is a record-bound `drawer`, reached through its `children`. */
  readonly inDrawerSlot: boolean
  /** Some ancestor declares `repeat`. */
  readonly inRepeat: boolean
}

/** A `drawer` carrying a `dataSource` -- the record-bound surface. */
function isRecordBoundDrawer(node: Readonly<Record<string, unknown>>): boolean {
  return node['type'] === 'drawer' && isRecord(node['dataSource'])
}

/**
 * Depth-first walk carrying {@link RepeatContext} down.
 *
 * `inDrawerSlot` is set only when descending into a record-bound drawer's
 * `children` -- not its `recordFields`, not its `actions`. Those are the
 * record's own facts and the footer, and a `repeat` in either would be just as
 * inert as one on the page.
 */
function walkRepeatContext(
  value: unknown,
  context: RepeatContext,
  label: string
): readonly string[] {
  if (Array.isArray(value)) return value.flatMap((item) => walkRepeatContext(item, context, label))
  if (!isRecord(value)) return []
  const below: RepeatContext = {
    inDrawerSlot: context.inDrawerSlot,
    inRepeat: context.inRepeat || isRecord(value['repeat']),
  }
  const slot: RepeatContext = { inDrawerSlot: true, inRepeat: below.inRepeat }
  const opensSlot = isRecordBoundDrawer(value)
  return [
    ...repeatNodeViolations(value, context, label),
    ...Object.entries(value).flatMap(([key, child]) =>
      walkRepeatContext(child, opensSlot && key === 'children' ? slot : below, label)
    ),
  ]
}

/** The three refusals decidable at ONE node, given its ancestry. */
function repeatNodeViolations(
  node: Readonly<Record<string, unknown>>,
  context: RepeatContext,
  label: string
): readonly string[] {
  const repeats = isRecord(node['repeat'])
  return [
    ...repeatPositionViolations(repeats, context, label),
    ...repeatVisibilityViolations(node, repeats || context.inRepeat, label),
    ...drawerSlotReadViolations(node, context, label),
  ]
}

/** Rules 1 and 2: where a `repeat` may stand. */
function repeatPositionViolations(
  repeats: boolean,
  context: RepeatContext,
  label: string
): readonly string[] {
  if (!repeats) return []
  if (!context.inDrawerSlot) {
    return [
      `${label} declares \`repeat\` on a container that is not inside a record-bound \`drawer\`'s \`children\` — \`repeat\` iterates an array carried by a record the drawer has already fetched, and there is no record anywhere else, so nothing would iterate it and the container would render its template exactly once. In v1 that slot is the one supported position: nest it under a \`drawer\` declaring a \`dataSource\`, or read the rows yourself with a \`dataSource\` row template.`,
    ]
  }
  return context.inRepeat
    ? [
        `${label} nests a \`repeat\` inside another \`repeat\` — \`$record.<field>\` would name a key on the inner element and on the outer one at once, with nothing in the grammar to say which, so every token inside the nested copies is ambiguous. Iterate one array per container.`,
      ]
    : []
}

/** Rule 3: `visibility.record` on or under a `repeat`, refused in v1. */
function repeatVisibilityViolations(
  node: Readonly<Record<string, unknown>>,
  underRepeat: boolean,
  label: string
): readonly string[] {
  const { visibility } = node
  return underRepeat && isRecord(visibility) && visibility['record'] !== undefined
    ? [
        `${label} declares \`visibility.record\` on or inside a \`repeat\` — the per-row gate is evaluated on the SERVER for a row template, and a repeat expands in the BROWSER, so the gate would silently apply to nothing and every element would render. v1 refuses it rather than shipping a filter that holds in one path and evaporates in the other; filter the array before it reaches the record, or drop the gate.`,
      ]
    : []
}

/** Rule 4: a `$record.`-carrying `{ system }` read inside the drawer slot. */
function drawerSlotReadViolations(
  node: Readonly<Record<string, unknown>>,
  context: RepeatContext,
  label: string
): readonly string[] {
  const { dataSource } = node
  if (!context.inDrawerSlot || !isRecord(dataSource)) return []
  const { system } = dataSource
  return isRecord(system) && containsRecordReference(system)
    ? [
        `${label} binds a \`dataSource.system\` carrying a \`$record.\` reference inside a record-bound \`drawer\`'s \`children\` — the row template is expanded on the SERVER, where the drawer's record id is not yet known (it arrives from a row click or a \`?record=\` link), so the endpoint would be requested with the literal token in it, resolve to nothing, and fail closed to an EMPTY slot with no error and no log. To iterate an array the record already carries, use \`repeat: { record: '<field>' }\`; to read rows of your own, bind a static endpoint here or move the read to a page that knows the id from its own \`path\`.`,
      ]
    : []
}

/** Does any string anywhere under `value` carry a `$record.` reference? */
function containsRecordReference(value: unknown): boolean {
  if (typeof value === 'string') return value.includes('$record.')
  if (Array.isArray(value)) return value.some(containsRecordReference)
  return isRecord(value) && Object.values(value).some(containsRecordReference)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Depth-first collection of every object node reachable from `value`.
 *
 * A local copy of the caller's walk, deliberately: this module imports nothing
 * from `page-binding-validation.ts`, so the dependency runs one way and there is
 * no cycle to get wrong at module-initialisation time.
 */
function walk(value: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(walk)
  if (!isRecord(value)) return []
  return [value, ...Object.values(value).flatMap(walk)]
}
