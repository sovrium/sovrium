/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The structured-input pass of a template that declares `inputs`.
 *
 * ─── ONE PASS, OVER THE TEMPLATE'S OWN TEXT ────────────────────────────────
 *
 * Every field of the template is walked, at any depth and under any key. A
 * string whose WHOLE value is `$name`, for a declared input, is replaced by the
 * placement's value of any JSON type; an optional input left out removes the
 * key (or drops the array element). `$name` inside a longer string takes a
 * scalar's text, and `$$` writes a literal `$`. Object keys are never
 * substituted. A value is inserted as written and the walk does not descend
 * into it, so a `$other`, a `$t:` key or a `$query.*` token inside a value is
 * left for the page passes, which read it exactly as if it were written inline.
 *
 * Only the DECLARED names are this pass's. The text between them is handed to
 * `interpolateRest`, which the renderer fills with the substitution every other
 * template has always had, so an undeclared `$token` reads as it did. The slot
 * markers (`$children`, `$slots.<name>`) are left for the slot fill.
 *
 * Pure: the same function serves the renderer and the startup checks, so the
 * node a placement is checked as is the node it draws.
 */

/** A path into a node: object keys and array indexes. */
export type NodePointer = readonly (string | number)[]

/** One field a placement's input filled whole, at its place in the expanded node. */
export interface InputDrawnAt {
  readonly input: string
  readonly pointer: NodePointer
}

/** A declared input: its kind and whether a placement must pass it. */
interface DeclaredInput {
  readonly kind: string
  readonly required?: boolean
}

/** The keys a template carries about itself; they are never a placed field. */
const TEMPLATE_META_KEYS: ReadonlySet<string> = new Set(['name', 'render', 'inputs', 'guidance'])

const INPUT_TOKEN = /^\$([a-zA-Z][a-zA-Z0-9]*)$/
const SLOT_MARKER = /^\$(?:children|slots\.[a-zA-Z][a-zA-Z0-9]*)$/

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The inputs a template declares that substitute — every kind but `slot` — or
 * `undefined` when it declares none, which keeps it on the plain substitution.
 */
export const substitutableInputsOf = (
  template: unknown
): ReadonlyMap<string, DeclaredInput> | undefined => {
  if (!isRecord(template) || !isRecord(template['inputs'])) return undefined
  const entries = Object.entries(template['inputs']).flatMap(([name, input]) =>
    isRecord(input) && typeof input['kind'] === 'string' && input['kind'] !== 'slot'
      ? [[name, { kind: input['kind'], required: input['required'] === true }] as const]
      : []
  )
  return entries.length === 0 ? undefined : new Map(entries)
}

/** The tokens of one string: `$$`, then each declared name, longest first. */
const tokenPatternOf = (inputs: ReadonlyMap<string, DeclaredInput>): Readonly<RegExp> => {
  const names = [...inputs.keys()].toSorted((a, b) => b.length - a.length)
  return new RegExp(`\\$\\$|\\$(${names.join('|')})(?![a-zA-Z0-9_])`, 'g')
}

/** What one placement's expansion works from. */
interface Expansion {
  readonly inputs: ReadonlyMap<string, DeclaredInput>
  readonly vars: Readonly<Record<string, unknown>>
  readonly pattern: Readonly<RegExp>
  readonly interpolateRest: (text: string) => string
}

/** The value passed for an input, or `undefined` when the placement left it out. */
const passedValue = (state: Expansion, name: string): unknown =>
  Object.hasOwn(state.vars, name) ? state.vars[name] : undefined

/** A scalar's text inside a longer string; a structured value keeps its token. */
const embeddedText = (value: unknown, token: string): string => {
  if (value === undefined || value === null) return ''
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : token
}

/** One template string with its declared tokens, `$$` escapes and the rest filled. */
const interpolate = (text: string, state: Expansion): string => {
  const matches = [...text.matchAll(state.pattern)]
  const { out, last } = matches.reduce(
    (acc, match) => {
      const [token, name] = match
      const filled =
        token === '$$' || name === undefined ? '$' : embeddedText(passedValue(state, name), token)
      return {
        out: acc.out + state.interpolateRest(text.slice(acc.last, match.index)) + filled,
        last: match.index + token.length,
      }
    },
    { out: '', last: 0 }
  )
  return out + state.interpolateRest(text.slice(last))
}

/** A field's expansion: the value (`absent` when removed) and the inputs it drew whole. */
interface Expanded {
  readonly absent: boolean
  readonly value: unknown
  readonly drawn: readonly InputDrawnAt[]
}

const kept = (value: unknown, drawn: readonly InputDrawnAt[] = []): Expanded => ({
  absent: false,
  value,
  drawn,
})

/** A string field: a whole-value input, a slot marker, or text to interpolate. */
const expandString = (text: string, pointer: NodePointer, state: Expansion): Expanded => {
  if (SLOT_MARKER.test(text)) return kept(text)
  const name = INPUT_TOKEN.exec(text)?.[1]
  if (name !== undefined && state.inputs.has(name)) {
    const value = passedValue(state, name)
    return value === undefined
      ? { absent: true, value: undefined, drawn: [] }
      : kept(value, [{ input: name, pointer }])
  }
  return kept(interpolate(text, state))
}

/** A list: each element expanded at its expanded index, an absent one dropped. */
const expandList = (list: readonly unknown[], pointer: NodePointer, state: Expansion): Expanded => {
  const { items, drawn } = list.reduce<{
    readonly items: readonly unknown[]
    readonly drawn: readonly InputDrawnAt[]
  }>(
    (acc, item) => {
      const expanded = expandValue(item, [...pointer, acc.items.length], state)
      return expanded.absent
        ? acc
        : { items: [...acc.items, expanded.value], drawn: [...acc.drawn, ...expanded.drawn] }
    },
    { items: [], drawn: [] }
  )
  return kept(items, drawn)
}

/** An object: each value expanded under its own key, an absent one removed. */
const expandRecord = (
  record: Readonly<Record<string, unknown>>,
  pointer: NodePointer,
  state: Expansion,
  skip: ReadonlySet<string>
): Expanded => {
  const fields = Object.entries(record).map(([key, value]) =>
    skip.has(key)
      ? { key, expanded: kept(value) }
      : { key, expanded: expandValue(value, [...pointer, key], state) }
  )
  const present = fields.filter(({ expanded }) => !expanded.absent)
  return kept(
    Object.fromEntries(present.map(({ key, expanded }) => [key, expanded.value])),
    present.flatMap(({ expanded }) => expanded.drawn)
  )
}

const NO_KEYS: ReadonlySet<string> = new Set()

/** Any template value, walked. */
const expandValue = (value: unknown, pointer: NodePointer, state: Expansion): Expanded => {
  if (typeof value === 'string') return expandString(value, pointer, state)
  if (Array.isArray(value)) return expandList(value, pointer, state)
  if (isRecord(value)) return expandRecord(value, pointer, state, NO_KEYS)
  return kept(value)
}

/** The node a placement draws, and where each input filled a whole field. */
export interface TemplateInputExpansion {
  readonly node: Readonly<Record<string, unknown>>
  readonly drawn: readonly InputDrawnAt[]
}

/**
 * Expand a template that declares inputs for one placement.
 *
 * @param template - the template entry, `inputs` and all
 * @param inputs - its substitutable inputs ({@link substitutableInputsOf})
 * @param vars - the placement's values
 * @param interpolateRest - fills the template text between declared tokens
 *   (the renderer's plain substitution; the identity for the startup checks)
 * @returns the expanded template, its own keys (`name`, `inputs`…) kept as they are
 */
export const expandTemplateInputs = (
  template: Readonly<Record<string, unknown>>,
  inputs: ReadonlyMap<string, DeclaredInput>,
  vars: Readonly<Record<string, unknown>> | undefined,
  interpolateRest: (text: string) => string = (text) => text
): TemplateInputExpansion => {
  const state: Expansion = {
    inputs,
    vars: vars ?? {},
    pattern: tokenPatternOf(inputs),
    interpolateRest,
  }
  const { value, drawn } = expandRecord(template, [], state, TEMPLATE_META_KEYS)
  return { node: value as Readonly<Record<string, unknown>>, drawn }
}

/** A `json` input a template writes inside a longer string, and the string. */
export interface EmbeddedJsonInput {
  readonly input: string
  readonly text: string
}

/** Every string a template value holds, keys excluded. */
const stringsOf = (value: unknown): readonly string[] => {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringsOf)
  return isRecord(value) ? Object.values(value).flatMap(stringsOf) : []
}

/**
 * The first `json` input a template writes inside a longer string, where only
 * its text could go: a structured value has no text, so it must fill a whole
 * field.
 */
export const embeddedJsonInputOf = (
  template: Readonly<Record<string, unknown>>,
  inputs: ReadonlyMap<string, DeclaredInput>
): EmbeddedJsonInput | undefined => {
  const pattern = tokenPatternOf(inputs)
  const texts = Object.entries(template)
    .filter(([key]) => !TEMPLATE_META_KEYS.has(key))
    .flatMap(([, value]) => stringsOf(value))
    .filter((text) => !INPUT_TOKEN.test(text))
  return texts
    .flatMap((text) =>
      [...text.matchAll(pattern)].flatMap((match) => {
        const name = match[1]
        return name !== undefined && inputs.get(name)?.kind === 'json'
          ? [{ input: name, text }]
          : []
      })
    )
    .at(0)
}
