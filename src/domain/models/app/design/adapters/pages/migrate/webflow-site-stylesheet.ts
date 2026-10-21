/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The site stylesheet of a Webflow code export, read INERT: which layout
 * declarations each class rule sets, and whether `:root` declares Variables.
 *
 * Webflow writes three stylesheets (fact c2): `normalize.css`, its own
 * `webflow.css`, and the site's `<site>.webflow.css`. Only the site's is read:
 * the other two are Webflow's runtime defaults, the same on every site, and
 * describe no choice the site made.
 *
 * ─── WHAT IS READ ──────────────────────────────────────────────────────────
 *
 * Top-level rules whose every selector is a class or a compound of classes
 * (`.services`, `.button.is-primary`). A rule inside an at-rule (`@media`,
 * `@font-face`, `@supports`) is a breakpoint or a font, not the base layout,
 * and is set aside; so is a selector with a combinator, an attribute, a
 * pseudo-class or a tag, which no single element's class list decides.
 * Comments and quoted strings are dropped before anything is matched, so a
 * brace inside a `url("…")` cannot open a rule.
 *
 * ─── BOUNDS ────────────────────────────────────────────────────────────────
 *
 * A stylesheet past {@link MAX_STYLESHEET_LENGTH} characters, or holding more
 * than {@link MAX_STYLESHEET_RULES} rules, is refused rather than read in part:
 * a layout read from half a stylesheet would be wrong without saying so.
 * Nothing in the CSS is resolved, fetched or run.
 */

/** The longest site stylesheet read: 4 MB, far beyond any exported site's. */
export const MAX_STYLESHEET_LENGTH = 4 * 1024 * 1024

/** The most rules a site stylesheet may hold. */
export const MAX_STYLESHEET_RULES = 50_000

/** One class rule: the classes an element must all carry, and what the rule declares. */
export interface ClassRule {
  readonly classes: readonly string[]
  readonly declarations: ReadonlyMap<string, string>
}

/** The stylesheet read, or why it was refused. */
export type SiteStylesheetRead =
  | {
      readonly ok: true
      readonly rules: readonly ClassRule[]
      /** Whether `:root` declares at least one custom property (fact c5). */
      readonly declaresVariables: boolean
    }
  | { readonly ok: false; readonly reason: string }

/**
 * The text with each closed comment emptied; an opener never closed is left as
 * written. Read part by part between openers rather than with a lazy pattern,
 * which rescans the rest of the text from every unclosed opener.
 */
const withoutComments = (css: string): string => {
  const [head = '', ...parts] = css.split('/*')
  const read = parts.reduce<{ readonly out: string; readonly open: string | undefined }>(
    ({ out, open }, part) => {
      const end = part.indexOf('*/')
      if (end === -1) return { out, open: `${open ?? ''}/*${part}` }
      return { out: `${out} ${part.slice(end + 2)}`, open: undefined }
    },
    { out: head, open: undefined }
  )
  return read.out + (read.open ?? '')
}

/** Comments, then quoted strings, emptied: neither can hold a brace that opens a rule. */
const inertText = (css: string): string =>
  withoutComments(css).replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, '""')

// Each pattern below starts where nothing before it could have: an at-rule's
// prelude never crosses another `@`, and a rule starts at the start of the text
// or after a brace. Without that, a run of `@` or of brace-free text is
// rescanned to its end from every character, which is quadratic.

/** An at-rule block holding rules of its own (`@media`), or a flat one (`@font-face`). */
const AT_RULE_BLOCK = /@[^{};@]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g

/** A statement at-rule (`@import …;`, `@charset …;`). */
const AT_RULE_STATEMENT = /@[^{};@]*;/g

/** One plain rule: its selector list, then its declaration block. */
const RULE = /(?<![^{}])([^{}]+)\{([^{}]*)\}/g

/** A selector made of classes only, compounded, with nothing else. */
const CLASS_COMPOUND = /^(?:\.[A-Za-z_][\w-]*)+$/

/** A declaration block's properties, the last of a repeated property winning. */
export const declarationsOf = (body: string): ReadonlyMap<string, string> =>
  new Map(
    body.split(';').flatMap((declaration) => {
      const colon = declaration.indexOf(':')
      if (colon < 0) return []
      const property = declaration.slice(0, colon).trim().toLowerCase()
      const value = declaration
        .slice(colon + 1)
        .replace(/!important\s*$/i, '')
        .trim()
      return property === '' || value === '' ? [] : [[property, value] as const]
    })
  )

/** The class compounds of a selector list, or none when any selector is not one. */
const classCompoundsOf = (selectors: string): readonly (readonly string[])[] => {
  const list = selectors.split(',').map((selector) => selector.trim())
  if (!list.every((selector) => CLASS_COMPOUND.test(selector))) return []
  return list.map((selector) => selector.slice(1).split('.'))
}

/** Whether a `:root` block declares a custom property, in either spelling (`--x`, `--_x`). */
const rootDeclaresVariables = (plain: string): boolean =>
  [...plain.matchAll(/(?:^|[}\s,]):root\s*\{([^{}]*)\}/g)].some((match) =>
    /(?:^|[;\s])--[\w-]+\s*:/.test(match[1] ?? '')
  )

/** Read a site stylesheet's top-level class rules, in source order. */
export const readSiteStylesheet = (css: string): SiteStylesheetRead => {
  if (css.length > MAX_STYLESHEET_LENGTH) {
    return { ok: false, reason: `is a stylesheet larger than ${MAX_STYLESHEET_LENGTH} characters` }
  }
  const plain = inertText(css).replace(AT_RULE_BLOCK, ' ').replace(AT_RULE_STATEMENT, ' ')
  const matches = [...plain.matchAll(RULE)]
  if (matches.length > MAX_STYLESHEET_RULES) {
    return { ok: false, reason: `is a stylesheet of more than ${MAX_STYLESHEET_RULES} rules` }
  }
  const rules = matches.flatMap((match) => {
    const compounds = classCompoundsOf(match[1] ?? '')
    if (compounds.length === 0) return []
    const declarations = declarationsOf(match[2] ?? '')
    return compounds.map((classes) => ({ classes, declarations }))
  })
  return { ok: true, rules, declaresVariables: rootDeclaresVariables(plain) }
}

/**
 * What the rules set on an element of `classes`: every rule whose classes the
 * element all carries, applied in source order, a later declaration winning.
 */
export const declarationsForClasses = (
  rules: readonly ClassRule[],
  classes: readonly string[]
): ReadonlyMap<string, string> => {
  const carried = new Set(classes)
  return rules
    .filter((rule) => rule.classes.every((name) => carried.has(name)))
    .reduce<ReadonlyMap<string, string>>(
      (applied, rule) => new Map([...applied, ...rule.declarations]),
      new Map()
    )
}
