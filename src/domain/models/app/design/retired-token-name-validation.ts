/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The retired `--sv-*` colour names, refused where a page NAMES a token.
 *
 * Sixteen `--sv-*` variables were a second spelling of shadcn/ui's own: each
 * was declared as `--sv-<role>: var(--<shadcn>)` and nothing else. They are
 * gone from the stylesheet rather than renamed in place, because the shadcn
 * name is the one every component, utility and author stylesheet already reads
 * — two names for one value is the drift this removal ends.
 *
 * A `swatch` and a contrast `badge` name a token as a STRING, so a retired
 * spelling would not fail anywhere: it would resolve to nothing, and the page
 * would draw a transparent chip or an unmeasurable pair as if that were the
 * design. Refusing at startup, naming the replacement, turns the silent hole
 * into a one-line fix. The Sovrium extension tokens that remain (`--sv-density-*`,
 * `--sv-primary-hover`, the status ramps, …) are not in this table and keep
 * resolving.
 */

/** Retired `--sv-*` name → the shadcn/ui variable that carries its value. */
const RETIRED_COLOR_TOKENS: Readonly<Record<string, string>> = {
  '--sv-bg': '--background',
  '--sv-fg': '--foreground',
  '--sv-bg-raised': '--card',
  '--sv-bg-overlay': '--popover',
  '--sv-primary': '--primary',
  '--sv-primary-fg': '--primary-foreground',
  '--sv-bg-subtle': '--muted',
  '--sv-fg-muted': '--muted-foreground',
  '--sv-error-solid': '--destructive',
  '--sv-border': '--border',
  '--sv-focus-ring': '--ring',
  '--sv-chart-1': '--chart-1',
  '--sv-chart-2': '--chart-2',
  '--sv-chart-3': '--chart-3',
  '--sv-chart-4': '--chart-4',
  '--sv-chart-5': '--chart-5',
}

/** One token name a page wrote, and the key it was written under. */
interface NamedToken {
  readonly type: string
  readonly key: string
  readonly token: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The keys of one node that name a COLOUR token.
 *
 * A swatch under `variant: 'curve'` names an easing, which has its own rule, so
 * only the colour variant is read. A badge names tokens only as a contrast
 * badge; any other badge's `foreground` is not a token reference.
 */
const colourTokenKeys = (node: Readonly<Record<string, unknown>>): readonly string[] => {
  if (node['type'] === 'swatch' && node['variant'] !== 'curve') return ['token', 'contrastAgainst']
  if (node['type'] === 'badge' && node['variant'] === 'contrast')
    return ['foreground', 'background']
  return []
}

/** Every colour token name written anywhere in a page tree. */
const collectColourTokens = (node: unknown): readonly NamedToken[] => {
  if (Array.isArray(node)) return node.flatMap(collectColourTokens)
  if (!isRecord(node)) return []

  const nested = Object.values(node).flatMap(collectColourTokens)
  const own = colourTokenKeys(node).flatMap((key) => {
    const token = node[key]
    return typeof token === 'string' ? [{ type: String(node['type']), key, token }] : []
  })
  return [...own, ...nested]
}

/** The refusal for one name, or `undefined` when it is not a retired spelling. */
const retiredTokenRefusal = (named: NamedToken): string | undefined => {
  const replacement = RETIRED_COLOR_TOKENS[named.token.trim()]
  return replacement === undefined
    ? undefined
    : `A ${named.type} names \`${named.key}: ${named.token}\`, a retired spelling: ${named.token} was a second name for shadcn/ui's ${replacement} and has been removed from the stylesheet, so it would draw nothing. Write \`${replacement}\`.`
}

/**
 * The first retired colour token named in the page tree, as a refusal message,
 * or `undefined` when none is.
 */
export const validateRetiredTokenNames = (pages: unknown): string | undefined =>
  collectColourTokens(pages)
    .map(retiredTokenRefusal)
    .find((error) => error !== undefined)
