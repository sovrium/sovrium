/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The editor's own surface, painted from the design tokens rather than from
 * CodeMirror's built-in light theme.
 *
 * ─── WHY THE LIBRARY DEFAULT HAD TO GO, NOT BE OVERRIDDEN ──────────────────
 *
 * `@uiw/react-codemirror` defaults its `theme` prop to `'light'`, which pushes
 * `defaultLightThemeOption` — a one-rule theme pinning `.cm-editor` to `#fff`.
 * Beside it, `@codemirror/view`'s base theme paints `.cm-gutters` `#f5f5f5`
 * under its `&light` scope. Neither knows about `.dark`, so the ground stayed
 * white in both schemes while the TEXT kept inheriting Sovrium's foreground
 * token — near-white on white once the scheme flipped, where only the
 * syntax-highlighted keywords survived because CodeMirror colours those itself.
 *
 * So this is passed as the `theme` PROP rather than appended to `extensions`.
 * The prop REPLACES the library default (`getDefaultExtensions` switches on it
 * and pushes nothing for a supplied extension), which is what makes the ground
 * a single declaration instead of two competing ones settled by injection
 * order.
 *
 * ─── EVERY VALUE IS A `var()`, SO THE SCHEME MOVES IT ──────────────────────
 *
 * A CodeMirror theme is static for the life of the mount and the scheme flips
 * at runtime by adding `.dark` to an ancestor, so a theme that resolved the
 * colours at mount could never follow it. Custom properties inherit through the
 * shadow-free DOM CodeMirror renders into, so `var(--sv-bg-raised)` re-resolves
 * on the flip with no remount and no listener. Each carries the literal
 * `TOKENS` default beside it, exactly as the class recipes do, so an editor
 * still paints correctly if the theme layer has not been emitted.
 *
 * ─── SELECTORS ARE ONE PER KEY, NEVER A COMMA LIST ────────────────────────
 *
 * `EditorView.theme` prefixes each key with the generated theme class, so
 * `.cm-gutters` becomes `.<base>.<theme> .cm-gutters` — specificity (0,3,0),
 * which outranks the base theme's `&light .cm-gutters` at (0,2,0). Splitting a
 * comma list across keys keeps that rewrite obvious per selector rather than
 * resting on how the style compiler tokenises a list.
 */

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { EditorView } from '@uiw/react-codemirror'
import { TOKENS as T } from '@/presentation/design/css-var'
import type { TagStyle } from '@codemirror/language'
import type { Extension } from '@codemirror/state'

/**
 * `var(--<name>, <literal>)` for a CSS-in-JS declaration.
 *
 * The sibling of `withVarFallback`, minus its Tailwind concession: that helper
 * rewrites spaces to `_` because Tailwind's arbitrary-value parser splits on
 * whitespace, and these strings never reach Tailwind — they are injected as raw
 * CSS by CodeMirror's style module, where an underscore inside `oklch(...)`
 * would be a parse error rather than a space.
 */
const token = (name: string, fallback: string): string => `var(--${name},${fallback})`

const GROUND = token('sv-bg-raised', T.bgRaised)
const INK = token('sv-fg', T.fg)
const MUTED_INK = token('sv-fg-muted', T.fgMuted)
const GUTTER = token('sv-bg-subtle', T.bgSubtle)
const EDGE = token('sv-border', T.border)
const HIGHLIGHT = token('sv-bg-inset', T.bgInset)
const MONO = 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)'
const SUBTLE_INK = token('sv-fg-subtle', T.fgSubtle)
const DISABLED_INK = token('sv-fg-disabled', T.fgDisabled)
// `sv-chart-1` has no `TOKENS` entry — the ramp is generated into the theme
// layer rather than into the catalog — so the fallback is spelled out, exactly
// as `KPI_SPARKLINE_STROKE` does for the same variable and the same reason.
// Keep the two literals equal if the default series hue ever moves.
const LITERAL = 'var(--sv-chart-1, #398ad6)'
const ERROR_INK = token('sv-error-fg', T.errorFg)

/**
 * The token-bound surface for every `code-editor` and every `code` form field.
 *
 * Deliberately covers the ground AND the ink together. Two grounds can differ
 * and both be wrong, so the text colour is declared here rather than left to
 * inherit from whatever encloses the editor — that inheritance is exactly how a
 * white ground came to carry near-white text.
 */
export const sovriumEditorTheme: Extension = EditorView.theme({
  '&': {
    backgroundColor: GROUND,
    color: INK,
  },
  // 12px on 1.7 — `variants.mjs:166` and `chrome.mjs:77` put every code surface
  // in the system on that pair, and the editor was the one that did not: it
  // inherited CodeMirror's own 13px on a tighter leading, so a formula field
  // and the code block documenting it were set differently on the same page.
  // Declared on `.cm-editor` rather than `.cm-content` so the gutter's digits
  // sit on the same baseline grid as the lines they number.
  '.cm-scroller': {
    fontFamily: MONO,
    fontSize: '0.75rem',
    lineHeight: '1.7',
  },
  '.cm-content': {
    caretColor: INK,
    padding: '0',
  },
  // A 1px caret, not CodeMirror's 2px: the caret should be the width of a rule,
  // not of a stroke, or it reads as a selection one character wide.
  '.cm-cursor, .cm-dropCursor': {
    borderLeftWidth: '1px',
  },
  '.cm-cursor': {
    borderLeftColor: INK,
  },
  '.cm-dropCursor': {
    borderLeftColor: INK,
  },
  // The base theme scopes its selection colours under `&light` / `&dark`, and
  // neither scope tracks `.dark` — so a light-grey selection would survive onto
  // the dark ground and swallow the text under it.
  '.cm-selectionBackground': {
    backgroundColor: GUTTER,
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: GUTTER,
  },
  '.cm-gutters': {
    backgroundColor: GUTTER,
    color: MUTED_INK,
    borderRightColor: EDGE,
  },
  // 30px wide with a 6px inset, right-aligned — the drawing's gutter, and wide
  // enough for three digits without reflowing when a file passes 99 lines.
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '30px',
    padding: '0 6px 0 0',
  },
  '.cm-line': {
    padding: '0 10px',
  },
  '.cm-activeLine': {
    backgroundColor: HIGHLIGHT,
  },
  '.cm-activeLineGutter': {
    backgroundColor: HIGHLIGHT,
  },
})

/**
 * The syntax palette (wave R-E).
 *
 * ─── THE DEFECT THIS CLOSES ────────────────────────────────────────────────
 *
 * `basicSetup` pushes `syntaxHighlighting(defaultHighlightStyle, { fallback:
 * true })`, and that style pins raw hexes chosen for a white ground. The
 * surrounding theme above already follows the scheme, so the syntax colours
 * were the ONLY thing in the editor that did not: measured on the dark ground
 * (`oklch(0.205 0 0)`, ≈ `#1e1e1e`), a property name computed
 * `rgb(0, 0, 204)` in BOTH schemes — about **1.02:1** against the ground it
 * sits on. Not "hard to read": functionally invisible, and the reason C5
 * recorded the palette as scheme-blind.
 *
 * `fallback: true` means any explicitly supplied style outranks it, so this
 * needs no removal of the default — it simply wins. It is added to
 * `extensions` rather than to the `theme` prop because a highlight style is a
 * facet value, not a theme.
 *
 * ─── WHY IT IS NEARLY MONOCHROME ───────────────────────────────────────────
 *
 * The obvious repair is five hues on `--sv-chart-1..5`. The drawings do not do
 * that, and they are right not to: `variants.mjs`'s own code samples carry
 * exactly three treatments — a keyword in the plain ink at weight 600, a
 * literal in ONE hue, a type in the subtle grey. Everything else is body text.
 *
 * That is the design language applied rather than suspended. The chart series
 * exists to tell N unlike series apart at a glance; syntax has no such need,
 * because the reader already knows which token is a string. What they need is
 * STRUCTURE — where a statement begins, which run is data — and structure is
 * carried better by weight and by one accent than by a rainbow. It also means
 * the palette inherits both schemes for free: every value below is a token
 * read, so the flip that broke the old colours moves these ones instead.
 *
 * A theme that wants a loud editor can still have one — `--sv-chart-1` and the
 * neutral ramp are the same knobs everything else answers to.
 */

/**
 * The tag → style rows.
 *
 * `HighlightStyle.define` takes the CSS properties FLAT on each row beside its
 * `tag`, not nested under a `style` key: the object is handed straight to
 * `style-mod`, which treats every own property as a declaration. Nesting them
 * throws `RangeError: The value of a property (style) should be a primitive
 * value` at module scope — which, inside a lazily-imported island, surfaces as
 * an editor that stays on its loading skeleton forever with a clean console.
 */
const HIGHLIGHT_TAGS: readonly TagStyle[] = [
  // Keywords are the skeleton of a statement: plain ink, heavier. Weight, not
  // colour, so the palette's one accent stays available for data.
  {
    tag: [
      tags.keyword,
      tags.controlKeyword,
      tags.definitionKeyword,
      tags.moduleKeyword,
      tags.operatorKeyword,
      tags.self,
    ],
    color: INK,
    fontWeight: '600',
  },
  // A tag name IS the keyword of markup.
  { tag: [tags.tagName, tags.angleBracket], color: INK, fontWeight: '600' },
  // Literals — the one hue. A string, a number and a boolean are all "data
  // written down here", so they take one colour rather than three.
  {
    tag: [tags.string, tags.special(tags.string), tags.number, tags.bool, tags.null, tags.regexp],
    color: LITERAL,
  },
  // Names of things, as opposed to the things themselves.
  {
    tag: [tags.typeName, tags.className, tags.namespace, tags.propertyName, tags.attributeName],
    color: SUBTLE_INK,
  },
  // Punctuation recedes: it is scaffolding the eye should skip.
  {
    tag: [tags.operator, tags.punctuation, tags.separator, tags.bracket, tags.squareBracket],
    color: MUTED_INK,
  },
  // A comment is prose inside code — quiet, and italic so it reads as an aside
  // even where the ground makes tone hard to judge.
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
    color: DISABLED_INK,
    fontStyle: 'italic',
  },
  // Markdown and doc structure keep their meaning without borrowing a hue.
  { tag: [tags.heading, tags.strong], color: INK, fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: LITERAL, textDecoration: 'underline' },
  // The one place colour IS consequence, which is the whole of what the error
  // tone is reserved for.
  { tag: tags.invalid, color: ERROR_INK },
]

export const sovriumSyntaxHighlighting: Extension = syntaxHighlighting(
  HighlightStyle.define([...HIGHLIGHT_TAGS])
)
