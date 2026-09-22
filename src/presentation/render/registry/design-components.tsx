/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The components a design system is documented WITH, rather than by.
 *
 * `swatch`, `specimen` and `field-specimen` are ordinary page components any
 * config may declare. The design-system console is their first consumer, not
 * their owner — which is why they render here beside every other type rather
 * than inside a console builder, and why their specs boot an ordinary app
 * rather than the admin dashboard.
 *
 * The contrast body lives here too and is dispatched from `badge`, which keys
 * on `variant: contrast`. It sits with its neighbours because it resolves its
 * two operands through the same `design-component-values.ts` helpers they do.
 *
 * ─── EACH ONE REPORTS A COMPUTED FACT ──────────────────────────────────────
 *
 * A swatch that drew a coloured box would pass "the swatch rendered" against a
 * renderer that resolved nothing. So each of them prints a value it had to
 * compute — a resolved token, a hex conversion, a measured ratio, a provenance
 * layer — and `design-component-values.ts` holds those computations. Where a
 * value cannot be resolved, NOTHING is printed in its place: a wrong green
 * shown confidently is worse than an absent one.
 *
 * ─── AND NONE OF THEM CARRIES A WRITE PATH ─────────────────────────────────
 *
 * [internal ref] A3 clause 2. `specimen` refuses `form` at DECODE time
 * (`specialty/specimen-refusal.ts`), at any depth, so a live submit control
 * cannot reach a preview frame through this renderer. Nothing here issues a
 * request of its own; the copy affordance is the delegated `copyCodeScript`
 * every page already carries.
 *
 * Source: src/domain/models/app/pages/components/component-types/specialty/
 * Specs: [internal ref]
 */

import { srgbHex } from '@/domain/kernel/color/color-contrast'
import { componentFrameHref } from '@/domain/models/app/admin/mount-hrefs'
import { recipeClassesFor } from '@/presentation/design/component-recipe-defaults'
import { computeCodeBlockClasses } from '@/presentation/design/typography-default-classes'
import { CodeCopyButton, CodeCopyStatus } from '@/presentation/render/elements/code-copy-controls'
import { buildClassProvenance } from '@/presentation/render/styling/class-provenance-report'
import { gradeContrast, resolveColorToken, specimenSnippet } from './design-component-values'
import { easingCurveComponent } from './easing-curve-component'
import { fieldSpecimenComponent } from './field-specimen-component'
import { mergePrestyle } from './interactive-prestyle-builders'
import { previewComponent } from './preview-component'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'
import type { ClassProvenanceEntry } from '@/domain/models/api/admin/design-system/component-types'
import type { Design } from '@/domain/models/app/design'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

/**
 * The boundary attribute the scoped theme layer keys its rules on.
 *
 * Spelled here rather than imported: the constant's home is
 * `infrastructure/css/theme/scoped-theme-layer.ts`, and a
 * `presentation-component` may not reach the infrastructure layer. Same
 * boundary `component-floor.ts` answers the same way — the string is
 * re-declared and pinned by a test, so a rename fails a unit test rather than
 * emitting a subtree the stylesheet has never heard of.
 */
export const DESIGN_SCOPE_ATTRIBUTE = 'data-design-app-scope'

/** Read one field off the component definition, when it is a string. */
const text = (component: Component | undefined, key: string): string | undefined => {
  const value = (component as Record<string, unknown> | undefined)?.[key]
  return typeof value === 'string' ? value : undefined
}

/** Read one boolean field off the component definition. */
const flag = (component: Component | undefined, key: string): boolean =>
  (component as Record<string, unknown> | undefined)?.[key] === true

/**
 * The caption row of a swatch: the label, then whichever notations were asked
 * for.
 *
 * A lowercase helper returning JSX rather than a React component, and the three
 * below it are the same. This module's public export is a REGISTRY of renderers
 * — a plain object — so a co-declared component would make it a mixed-export
 * file and break Fast Refresh for every one of them.
 */
function renderSwatchNotations({
  resolved,
  showHex,
  showOklch,
}: {
  readonly resolved: string | undefined
  readonly showHex: boolean
  readonly showOklch: boolean
}): ReactElement | undefined {
  if (resolved === undefined) return undefined
  // `srgbHex` answers `undefined` for a colour sRGB cannot hold, and the swatch
  // then prints no hex at all rather than a clamped one presented as an equal.
  const hex = showHex ? srgbHex(resolved) : undefined
  return (
    <>
      {showOklch ? <code data-token-notation="declared">{resolved}</code> : undefined}
      {hex === undefined ? undefined : <code data-token-notation="hex">{hex}</code>}
    </>
  )
}

/**
 * The paint for a `source: 'cascade'` swatch — the custom property itself,
 * or `undefined` for a swatch that resolves once.
 *
 * `undefined` when the token is not a custom-property name, which is the only
 * thing the cascade can hold. A `design.ramps` step is emitted as no `--sv-*`
 * variable at all (measured), so painting `var(brand-500)` would give a
 * transparent chip where a colour used to be. Reporting nothing is the same
 * answer an unresolvable literal already gets, and it stays a render-time fact
 * rather than a decode error for the reason `token` is an open string.
 */
const cascadePaint = (component: Component | undefined, token: string): string | undefined =>
  text(component, 'source') === 'cascade' && token.startsWith('--') ? `var(${token})` : undefined

/**
 * The root node's own props for a swatch — the layout recipe always, plus the
 * live paint for `cascade`.
 *
 * The recipe is merged through `mergePrestyle`, so an author's own `className`
 * still beats it on any property they name, exactly as it does on a `button`.
 * Without it the root is a bare `<div>` and the chip, the name and the
 * notations sit edge to edge as three inline boxes — see
 * {@link SWATCH_ROOT_RECIPE}.
 *
 * The author's own `style` is spread through rather than replaced: the node
 * being painted is the node they addressed, so anything else they put on it has
 * to survive.
 */
function swatchRootProps(
  elementProps: Record<string, unknown>,
  live: string | undefined
): Record<string, unknown> {
  const className = mergePrestyle(
    recipeClassesFor('swatch'),
    elementProps['className'] as string | undefined
  )
  if (live === undefined) return { ...elementProps, className }
  return {
    ...elementProps,
    className,
    'data-token-source': 'cascade',
    style: { ...(elementProps['style'] as object), backgroundColor: live },
  }
}

/**
 * The colour branch of `swatch` — one colour token, drawn and named.
 *
 * `showHex` / `showOklch` are two flags rather than one format choice, and
 * neither prints unless asked: an author pasting into a design tool wants hex,
 * one reasoning about lightness across a ramp wants the declared notation, and
 * a swatch that printed both unconditionally would make the flags inert.
 *
 * ─── `source` DECIDES WHICH NODE IS PAINTED, NOT ONLY WHERE FROM ──────────
 *
 * `literal` (the default) resolves the token once and paints a nested chip,
 * which is the only thing that works for a ramp step and is what every shipped
 * swatch does.
 *
 * `cascade` paints the ROOT — the node carrying the author's own props — from
 * the custom property. Both halves matter. Reading the variable is what makes
 * the swatch follow a colour-scheme switch instead of showing the light value
 * frozen into the HTML under a dark page; painting the root is what makes the
 * swatch a reader sees the same node a page can address, where a nested chip
 * leaves every addressable assertion measuring a transparent box.
 */
const colorSwatchComponent: ComponentRenderer = ({
  elementPropsWithSpacing,
  component,
  design,
}) => {
  const token = text(component, 'token') ?? ''
  const resolved = resolveColorToken(design, token)
  const against = text(component, 'contrastAgainst')
  const ground = against === undefined ? undefined : resolveColorToken(design, against)
  const verdict =
    resolved === undefined || ground === undefined
      ? undefined
      : gradeContrast(resolved, ground, 'AA')
  const live = cascadePaint(component, token)

  return (
    <div {...swatchRootProps(elementPropsWithSpacing, live)}>
      {live === undefined ? (
        <span
          aria-hidden="true"
          data-token-chip=""
          className="inline-block h-8 w-8 rounded border border-[var(--sv-border,#e5e5e5)] align-middle"
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- the swatch IS its colour; a stateless SSR renderer painting it once
          style={{ backgroundColor: resolved ?? 'transparent' }}
        />
      ) : undefined}
      <span data-token-label="">{text(component, 'label') ?? token}</span>
      {renderSwatchNotations({
        resolved,
        showHex: flag(component, 'showHex'),
        showOklch: flag(component, 'showOklch'),
      })}
      {verdict === undefined ? undefined : (
        <span data-token-contrast={verdict.passes ? 'pass' : 'fail'}>
          {verdict.ratio} {verdict.grade}
        </span>
      )}
    </div>
  )
}

/**
 * The contrast branch of `badge` — the ratio between two colours, and the
 * verdict on it.
 *
 * The failing case says so rather than omitting the verdict: a badge that only
 * rendered on success would leave a reader unable to tell a failure from a
 * missing badge, which is the state this exists to remove.
 */
export const contrastBadgeComponent: ComponentRenderer = ({
  elementPropsWithSpacing,
  component,
  design,
}) => {
  const threshold = text(component, 'threshold') ?? 'AA'
  const ink = resolveColorToken(design, text(component, 'foreground') ?? '')
  const ground = resolveColorToken(design, text(component, 'background') ?? '')
  const verdict =
    ink === undefined || ground === undefined ? undefined : gradeContrast(ink, ground, threshold)

  return (
    <span
      {...elementPropsWithSpacing}
      data-contrast={verdict === undefined ? 'unresolved' : verdict.passes ? 'pass' : 'fail'}
    >
      {verdict === undefined ? (
        // Neither colour is guessed at: an unresolved operand means the ratio
        // would be measured against something the author did not name.
        <span>Not measurable — one of the two colours does not resolve.</span>
      ) : (
        <span>
          {verdict.ratio} {verdict.grade}
        </span>
      )}
    </span>
  )
}

/** One provenance chip: the layer, the classes it put there, and its padlock. */
function renderProvenanceChip(entry: ClassProvenanceEntry): ReactElement {
  const label =
    entry.layer === 'default'
      ? 'Sovrium default'
      : entry.layer === 'app'
        ? 'your design'
        : 'locked floor'
  return (
    <li
      key={entry.layer}
      data-provenance-layer={entry.layer}
    >
      <span>{label}</span>
      {/* The CLASSES and not just the layer: a chip saying "app" with nothing
          beside it cannot be wrong, which makes it a label rather than a
          provenance badge. */}
      <code>{entry.classes}</code>
      {entry.locked ? <span title={entry.reason}>🔒</span> : undefined}
    </li>
  )
}

/** The anatomy list: one callout per annotated part, with its layers under it. */
function renderSpecimenAnatomy({
  parts,
  drawnType,
  design,
  showProvenance,
}: {
  readonly parts: readonly { readonly part: string; readonly label?: string }[]
  readonly drawnType: string
  readonly design: Design | undefined
  readonly showProvenance: boolean
}): ReactElement | undefined {
  if (parts.length === 0) return undefined
  return (
    <ul data-specimen-anatomy="">
      {parts.map((entry) => (
        <li
          key={entry.part}
          data-specimen-part={entry.part}
        >
          <span>{entry.label ?? entry.part}</span>
          {showProvenance ? (
            <ul data-specimen-provenance="">
              {buildClassProvenance({
                ...(design === undefined ? {} : { design }),
                type: drawnType,
                part: entry.part,
              }).chain.map((layer) => renderProvenanceChip(layer))}
            </ul>
          ) : undefined}
        </li>
      ))}
    </ul>
  )
}

/**
 * `specimen` — one component drawn, beside the literal that produced it.
 *
 * The drawing arrives as `renderedChildren`: `component-renderer.tsx` routes
 * the `component` field through the ordinary child pipeline, so the drawn
 * thing is a REAL component with the app's own design cascade on it — which is
 * what makes the provenance badges below describe the element rather than the
 * config.
 */
/**
 * What a drawn specimen is OF, for the config block's own marker.
 *
 * `nameSpecimen` stamps `data-component` on the drawing with the subject's own
 * name — the catalogued type, or the template name for one of the operator's
 * own — so reading it back is what lets ONE marker carry both vocabularies. A
 * written-out specimen gets the same stamp from `nameWrittenSpecimen`; the
 * `type` fallback covers a drawing that arrived by neither path.
 */
const specimenSubjectName = (drawn: Component): string => {
  const named = (drawn as { readonly props?: Record<string, unknown> }).props?.['data-component']
  return typeof named === 'string' ? named : (drawn.type ?? '')
}

/**
 * The declared viewport width, when this specimen asked to be re-rendered in a
 * document of its own.
 *
 * Read defensively rather than through the schema type: a renderer is reached
 * by synthesized nodes as well as decoded ones, and a width that is not a
 * positive number draws the ordinary inline specimen rather than a frame of
 * nonsense size.
 */
const declaredViewportWidth = (component: Component | undefined): number | undefined => {
  const viewport = (component as { readonly viewport?: unknown } | undefined)?.viewport
  if (typeof viewport !== 'object' || viewport === null) return undefined
  const { width } = viewport as { readonly width?: unknown }
  return typeof width === 'number' && Number.isFinite(width) && width > 0 ? width : undefined
}

/**
 * The stage of a FRAMED specimen: the subject re-rendered in its own document.
 *
 * ─── WHY AN `<iframe>` AND NOT A NARROWER BOX ──────────────────────────────
 *
 * A `@media` query has exactly one input — the viewport — and nothing inside a
 * document can change it. Drawing the subject into a 375px-wide `div` on the
 * console page narrows the markup while every breakpoint keeps answering the
 * reader's window, so the component squeezes sideways and overflows instead of
 * collapsing to the layout it actually has at 375. A document boundary is the
 * only thing that gives the subject a viewport of its own.
 *
 * ─── THE THREE ATTRIBUTES THAT ARE NOT DECORATION ──────────────────────────
 *
 *  - **`width` as an attribute AND a style, with NO `maxWidth`.** The width IS
 *    the claim: a `maxWidth: '100%'` would shrink a 1280 frame to the console
 *    column and leave the heading above it saying 1280 about a document that is
 *    854. The declared number reaches the document or the frame is a lie. The
 *    enclosing wrapper is what scrolls (`overflow-x-auto`), so nothing is
 *    clipped by letting the frame exceed its column.
 *  - **`title`.** An `<iframe>` is an embedded browsing context and needs an
 *    accessible name; without one a screen-reader user meets three unlabelled
 *    frames in a row.
 *  - **`loading="lazy"`** (eco R2). Not asserted by any criterion, deliberately:
 *    these frames are short and sit above the fold at an ordinary window
 *    height, so "it did not load until scrolled" is unobservable here and a
 *    test for it could not fail.
 *
 * `display: block` removes the inline baseline gap an `<iframe>` otherwise sits
 * on, which would show as a few stray pixels under a frame sized exactly to its
 * content. No `sandbox`: without `allow-same-origin` the frame gets an opaque
 * origin and loses the one property that matters — a same-origin document that
 * can read the console's resolved scheme and size its own frame. With
 * `allow-same-origin allow-scripts` it would be equivalent to no sandbox at
 * all. What actually bounds the document is `frame-ancestors 'self'`, set by
 * the route that serves it.
 *
 * The HEIGHT is not set here. The framed document measures itself and grows its
 * own frame, because it is the only party that knows how tall it is — see
 * `application/use-cases/admin/design-system-component-frame.ts`.
 */
const frameStyle = (width: number): Record<string, string> => ({
  width: `${width}px`,
  display: 'block',
  border: '0',
})

const specimenFrame = (name: string, width: number): ReactElement => (
  <iframe
    src={componentFrameHref(name)}
    title={`${name} at ${width}px`}
    width={width}
    loading="lazy"
    data-design-viewport-document={name}
    style={frameStyle(width)}
  />
)

/**
 * The specimen's stage: the subject re-rendered in a frame, or drawn inline.
 *
 * A frame needs a NAME, because the framed document resolves its subject
 * against `components[]`. An unresolvable subject leaves `drawn` undefined and
 * takes the inline path, where the specimen draws its own refusal in place —
 * a better answer than an empty frame, which looks like a working one.
 */
const specimenStage = (
  component: Component | undefined,
  drawn: Component | undefined,
  renderedChildren: readonly ReactElement[]
): ReactElement => {
  const width = drawn === undefined ? undefined : declaredViewportWidth(component)
  const name = drawn === undefined ? '' : specimenSubjectName(drawn)
  return (
    <div data-specimen-stage="">
      {width !== undefined && name !== '' ? specimenFrame(name, width) : renderedChildren}
    </div>
  )
}

const specimenComponent: ComponentRenderer = ({
  elementPropsWithSpacing,
  renderedChildren,
  component,
  design,
}) => {
  const drawn = (component as { component?: Component } | undefined)?.component
  const annotations = ((
    component as { annotations?: readonly { part: string; label?: string }[] } | undefined
  )?.annotations ?? []) as readonly { part: string; label?: string }[]
  const showProvenance = flag(component, 'showProvenance')
  const parts = showProvenance && annotations.length === 0 ? [{ part: 'root' }] : annotations

  return (
    <div {...elementPropsWithSpacing}>
      {specimenStage(component, drawn, renderedChildren)}
      {flag(component, 'showSnippet') && drawn !== undefined ? (
        <div data-code-copy-scope="">
          <CodeCopyButton
            copyLabel="Copy this configuration"
            copiedLabel="Configuration copied"
          />
          <CodeCopyStatus />
          {/*
            TWO MARKERS, AND NEITHER IS DECORATION.

            `data-design-config` is the console's own name for "this is the
            config that produced the thing above", already read by
            `catalog.spec`, `type-page.spec` and the specimen-subject specs; the
            retired type-page builder stamped it on its own `<pre>` and the
            component that replaces that builder has to answer to the same hook.
            Its VALUE is the drawn subject's identity — the stamp `nameSpecimen`
            put on the drawing, which is the type for a catalogue specimen and
            the template NAME for one of the operator's own, falling back to the
            node's type when nothing named it.

            `data-copy-target` is what the copy button copies. Without it the
            button renders, is pressed, and copies nothing — a failure that
            looks like success and that no assertion about the snippet's TEXT
            would catch.
          */}
          {/*
            AND THE CLASS IS NOT DECORATION EITHER. A `<pre>` carrying no
            recipe inherits the document root — 16px — so the printed
            configuration drew LARGER than every control on the page beside it
            and read as the headline rather than as the reference material a
            reader copies. `computeCodeBlockClasses` is the house recipe for
            exactly this element: a `<pre>` holding a multi-line code sample.
            Reusing it rather than spelling a size here is what keeps a printed
            config and an authored code block the same language.
          */}
          <pre
            className={computeCodeBlockClasses()}
            data-design-config={specimenSubjectName(drawn)}
            data-copy-target=""
          >
            <code>{specimenSnippet(drawn)}</code>
          </pre>
        </div>
      ) : undefined}
      {renderSpecimenAnatomy({
        parts,
        drawnType: drawn?.type ?? '',
        design,
        showProvenance,
      })}
    </div>
  )
}

/**
 * The design-documentation components, spread into `COMPONENT_REGISTRY`.
 *
 * The curve branch of `swatch` renders from its own module rather than inline:
 * it is the one whose output is a DRAWING rather than a printed value, so it
 * carries an SVG geometry the others have no use for.
 *
 * `field-specimen` is the second such module, for a different reason: it draws
 * a table FIELD type rather than a component, so it reaches an entirely
 * different renderer — see that module's own header for why it has a registry
 * entry at all when a render-time pass normally expands it first.
 */
/**
 * `swatch` — one design token, drawn, in both of its variants.
 *
 * `variant: 'curve'` plots an easing token; anything else paints a colour one.
 * One type rather than two, because a reader documenting a design system wants
 * every token drawn the same way and the two bodies differ only in what a token
 * of that kind looks like.
 *
 * The curve is a static SVG and MUST stay one. It is a server-rendered element
 * with no island, so it appears in no registry, mounts nothing, and adds no
 * bytes to the eager closure the payload budget measures. Reaching for a chart
 * library here would pull the visx chunk onto any page documenting a duration.
 */
const swatchComponent: ComponentRenderer = (context) => {
  const variant = (context.component as { variant?: unknown } | undefined)?.variant
  return variant === 'curve' ? easingCurveComponent(context) : colorSwatchComponent(context)
}

export const designComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  swatch: swatchComponent,
  'field-specimen': fieldSpecimenComponent,
  specimen: specimenComponent,
  // `preview` — the catalogue's own specimen for a type, drawn with
  // ONE option set to ONE value. It belongs to this family because it documents
  // the design system rather than composing a page, and it shares `specimen`'s
  // drawing path: `childrenToRender` routes both types' `component` field
  // through the ordinary child pipeline, so a type that draws in the kit draws
  // here. Its own module — the readout, the stage and the caption are three
  // elements this file has no room for.
  preview: previewComponent,
}
