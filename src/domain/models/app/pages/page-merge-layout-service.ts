/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A container layout a design tool drew, read back onto the token scale and
 * written as the utility class a page sets it with.
 *
 * A page writes a container's layout as utility classes on `props.className`
 * (`flex flex-row gap-4 p-6`) and, per breakpoint, on
 * `responsive.<bp>.props.className` or as a `<bp>:` prefix inside the base
 * list. The page export reads them into the design tree as values with their
 * token (`gap` → `{ value: '1rem', token: 'spacing.4' }`); a tool hands back
 * whatever it drew — a bound variable, a px length, a rem length.
 *
 * ─── ON THE SCALE, OR NOT WRITTEN ──────────────────────────────────────────
 *
 * A spacing value is on the scale when it names, or measures exactly, a step
 * the app's `design.spacing` declares — or, for an app that declares none,
 * a step of the default scale every app renders with (`0.5` is `0.125rem`,
 * `4` is `1rem`, `6` is `1.5rem`), which the utility classes already speak. Anything else is OFF the scale: it is
 * reported with the nearest declared step, so a designer can snap to it, and
 * never rounded into the config. An enumerated value (a direction, an
 * alignment, a keyword width) is on the scale when the utility vocabulary has
 * a class for it.
 *
 * Pure: no I/O, the same input always gives the same class list.
 */

/** `design.spacing`: a step name to its CSS length. */
export type SpacingSteps = Readonly<Record<string, string>>

/**
 * The scale a drawing's lengths are read against: the app's declared steps,
 * or, when it declares none, the default scale the caller hands over.
 *
 * @param declared - the app's `design.spacing`, when it has one.
 * @param defaults - the default scale, by utility step (`0.5`, `4`, `px`).
 */
export const spacingScaleOf = (
  declared: SpacingSteps | undefined,
  defaults: SpacingSteps
): SpacingSteps =>
  declared === undefined || Object.keys(declared).length === 0 ? defaults : declared

/**
 * The default scale by utility step, from the default design's `--spacing-*`
 * token values (`spacing-0-5` is step `0.5`).
 *
 * @param scale - the default design's scale tokens, by token name.
 */
export const defaultSpacingStepsOf = (scale: Readonly<Record<string, string>>): SpacingSteps =>
  Object.fromEntries(
    Object.entries(scale).flatMap(([token, value]) => {
      const step = /^spacing-(.+)$/.exec(token)?.[1]
      return step === undefined ? [] : [[step.replaceAll('-', '.'), value] as const]
    })
  )

/** The layout properties a design tool may change on a container. */
export type LayoutProperty = 'direction' | 'gap' | 'align' | 'justify' | 'padding' | 'width'

/** A layout value as a drawing or the design tree holds it. */
export interface DrawnLayoutValue {
  readonly value: string
  readonly token?: string | undefined
}

/** A drawn value, read against the scale. */
export type ResolvedLayoutValue =
  | { readonly kind: 'step'; readonly step: string; readonly token: string; readonly value: string }
  | { readonly kind: 'keyword'; readonly value: string }
  | { readonly kind: 'off'; readonly value: string; readonly nearestToken?: string | undefined }

/** One rem, in px, as the browser default the export measures with. */
const REM_PX = 16

const SPACED: ReadonlySet<LayoutProperty> = new Set(['gap', 'padding', 'width'])

/**
 * The keyword utilities of each enumerated property: the class prefix, and the
 * suffix of each value. Kept as suffixes so this module names no class the
 * stylesheet scan would read as one a page draws.
 */
const KEYWORD_CLASSES: Readonly<
  Partial<
    Record<
      LayoutProperty,
      { readonly prefix: string; readonly values: Readonly<Record<string, string>> }
    >
  >
> = {
  direction: {
    prefix: 'flex',
    values: {
      row: 'row',
      column: 'col',
      'row-reverse': 'row-reverse',
      'column-reverse': 'col-reverse',
    },
  },
  align: {
    prefix: 'items',
    values: {
      start: 'start',
      center: 'center',
      end: 'end',
      stretch: 'stretch',
      baseline: 'baseline',
    },
  },
  justify: {
    prefix: 'justify',
    values: {
      start: 'start',
      center: 'center',
      end: 'end',
      'space-between': 'between',
      'space-around': 'around',
      'space-evenly': 'evenly',
    },
  },
  width: { prefix: 'w', values: { '100%': 'full', '100vw': 'screen', auto: 'auto' } },
}

/** The keyword utility class of a value, when the vocabulary has one. */
const keywordClassOf = (property: LayoutProperty, value: string): string | undefined => {
  const table = KEYWORD_CLASSES[property]
  const suffix = table?.values[value]
  return table === undefined || suffix === undefined ? undefined : `${table.prefix}-${suffix}`
}

/** The spacing utility prefix of each spaced property. */
const SPACING_PREFIX: Readonly<Partial<Record<LayoutProperty, string>>> = {
  gap: 'gap',
  padding: 'p',
  width: 'w',
}

/**
 * Which class of a list sets a property, unprefixed: the family a new utility
 * replaces. A spacing family takes a step named by the app (its `line` step) as it takes a
 * numbered one, so a write lands on the class already there, never beside it.
 */
const FAMILY: Readonly<Record<LayoutProperty, RegExp>> = {
  direction: /^flex-(?:row|col)(?:-reverse)?$/,
  gap: /^gap-(?![xy]-)[a-z0-9.-]+$/,
  padding: /^p-[a-z0-9.-]+$/,
  width: /^w-[a-z0-9.-]+$/,
  align: /^items-(?:start|center|end|stretch|baseline)$/,
  justify: /^justify-(?:start|center|end|between|around|evenly)$/,
}

/** A CSS length in px, or `undefined` for anything that is not a plain px or rem length. */
export const pxOf = (length: string): number | undefined => {
  const match = /^(-?\d+(?:\.\d+)?)(px|rem)?$/.exec(length.trim())
  if (match === null) return undefined
  const amount = Number(match[1])
  return match[2] === 'rem' ? amount * REM_PX : amount
}

/** The step a token names (`spacing.6`, `spacing/6`), when the scale declares it. */
const declaredStepOf = (token: string | undefined, spacing: SpacingSteps): string | undefined => {
  const match = /^spacing[./](.+)$/.exec(token ?? '')
  const step = match?.[1]
  return step !== undefined && spacing[step] !== undefined ? step : undefined
}

/** The declared steps, each with its length in px, smallest first. */
const measuredSteps = (spacing: SpacingSteps): readonly (readonly [string, number])[] =>
  Object.entries(spacing)
    .flatMap(([step, length]) => {
      const px = pxOf(length)
      return px === undefined ? [] : [[step, px] as const]
    })
    .toSorted((a, b) => a[1] - b[1])

const stepValue = (step: string, spacing: SpacingSteps): ResolvedLayoutValue => ({
  kind: 'step',
  step,
  token: `spacing.${step}`,
  value: spacing[step] ?? '',
})

/** A spaced value read against the scale: its named step, its exact step, or off with the nearest. */
const resolveSpaced = (drawn: DrawnLayoutValue, spacing: SpacingSteps): ResolvedLayoutValue => {
  const named = declaredStepOf(drawn.token, spacing)
  if (named !== undefined) return stepValue(named, spacing)
  const px = pxOf(drawn.value)
  const steps = measuredSteps(spacing)
  if (px === undefined) return { kind: 'off', value: drawn.value }
  const exact = steps.find(([, length]) => Math.abs(length - px) < 0.01)
  if (exact !== undefined) return stepValue(exact[0], spacing)
  const nearest = steps.reduce<readonly [string, number] | undefined>(
    (best, candidate) =>
      best === undefined || Math.abs(candidate[1] - px) < Math.abs(best[1] - px) ? candidate : best,
    undefined
  )
  return {
    kind: 'off',
    value: drawn.value,
    ...(nearest === undefined ? {} : { nearestToken: `spacing.${nearest[0]}` }),
  }
}

/**
 * Read one drawn layout value against the scale.
 *
 * @param property - the layout property it was drawn for.
 * @param drawn - the value and the token the tool drew it with.
 * @param spacing - the app's declared spacing steps.
 */
export const resolveLayoutValue = (
  property: LayoutProperty,
  drawn: DrawnLayoutValue,
  spacing: SpacingSteps
): ResolvedLayoutValue => {
  if (keywordClassOf(property, drawn.value) !== undefined) {
    return { kind: 'keyword', value: drawn.value }
  }
  if (SPACED.has(property)) return resolveSpaced(drawn, spacing)
  return { kind: 'off', value: drawn.value }
}

/** The utility class a value on the scale is written as. */
export const utilityOf = (
  property: LayoutProperty,
  resolved: ResolvedLayoutValue
): string | undefined => {
  if (resolved.kind === 'off') return undefined
  if (resolved.kind === 'keyword') return keywordClassOf(property, resolved.value)
  const prefix = SPACING_PREFIX[property]
  return prefix === undefined ? undefined : `${prefix}-${resolved.step}`
}

/** A class list with one property's utility replaced in place, or appended when none set it. */
const replaceInList = (
  className: string,
  property: LayoutProperty,
  utility: string,
  prefix: string
): { readonly className: string; readonly replaced: boolean } => {
  const tokens = className.split(/\s+/).filter((token) => token !== '')
  const index = tokens.findIndex(
    (token) => token.startsWith(prefix) && FAMILY[property].test(token.slice(prefix.length))
  )
  if (index === -1) return { className, replaced: false }
  return {
    className: tokens.map((token, at) => (at === index ? `${prefix}${utility}` : token)).join(' '),
    replaced: true,
  }
}

const append = (className: string, utility: string): string =>
  className.trim() === '' ? utility : `${className.trim()} ${utility}`

type Node = Readonly<Record<string, unknown>>

const classNameOf = (holder: unknown): string => {
  const className = (holder as { readonly props?: { readonly className?: unknown } } | undefined)
    ?.props?.className
  return typeof className === 'string' ? className : ''
}

const withClassName = (holder: Node, className: string): Node => ({
  ...holder,
  props: { ...((holder['props'] as Node | undefined) ?? {}), className },
})

/**
 * A node with one layout utility written, at the base or at a breakpoint.
 *
 * At the base, the class that set the property is replaced where it stands,
 * or the utility is appended. At a breakpoint, the breakpoint's own class list
 * is preferred, then a `<bp>:` class inside the base list, then a new `<bp>:`
 * class appended to the base list.
 *
 * @param node - the page node, as the config writes it.
 * @param property - the layout property.
 * @param utility - the utility class of the new value (`gap-6`).
 * @param breakpoint - the breakpoint, or `undefined` for the base.
 */
export const withLayoutUtility = (
  node: Node,
  property: LayoutProperty,
  utility: string,
  breakpoint?: string
): Node => {
  const base = classNameOf(node)
  if (breakpoint === undefined) {
    const next = replaceInList(base, property, utility, '')
    return withClassName(node, next.replaced ? next.className : append(base, utility))
  }
  const responsive = (node['responsive'] ?? {}) as Readonly<Record<string, Node>>
  const variant = responsive[breakpoint]
  const own = replaceInList(classNameOf(variant), property, utility, '')
  if (variant !== undefined && own.replaced) {
    return {
      ...node,
      responsive: { ...responsive, [breakpoint]: withClassName(variant, own.className) },
    }
  }
  const prefixed = replaceInList(base, property, utility, `${breakpoint}:`)
  if (prefixed.replaced) return withClassName(node, prefixed.className)
  if (variant !== undefined && classNameOf(variant) !== '') {
    return {
      ...node,
      responsive: {
        ...responsive,
        [breakpoint]: withClassName(variant, append(classNameOf(variant), utility)),
      },
    }
  }
  return withClassName(node, append(base, `${breakpoint}:${utility}`))
}

/**
 * Of a value a tool drew as several lengths — four paddings that are no longer
 * equal, `13px 24px 24px 24px` — the one length the designer changed, when
 * every other side still measures the unedited value. Reported alone, it names
 * what was drawn and gets its nearest step; any other value is kept whole.
 *
 * @param drawn - the value as drawn.
 * @param baseline - the same value in an unedited drawing.
 */
export const editedLength = (
  drawn: DrawnLayoutValue,
  baseline: DrawnLayoutValue | undefined
): DrawnLayoutValue => {
  const lengths = drawn.value.trim().split(/\s+/)
  const unedited = baseline === undefined ? undefined : pxOf(baseline.value)
  if (lengths.length < 2 || unedited === undefined) return drawn
  const edited = [...new Set(lengths.filter((length) => pxOf(length) !== unedited))]
  const [only] = edited
  return edited.length === 1 && only !== undefined ? { value: only } : drawn
}
