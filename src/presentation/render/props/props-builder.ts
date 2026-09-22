/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { convertCustomPropsToDataAttributes } from './prop-conversion'
import { calculateTotalDelay } from './time-parser'
import type { ElementPropsConfig, TestIdConfig } from './props-builder-config'

/**
 * Component types that should receive role="group" when used as component references with children
 */
const CONTAINER_TYPES = ['div', 'container', 'flex', 'grid', 'card', 'badge'] as const

/**
 * Builds test ID for component references
 */
function buildComponentTestId(
  componentName: string,
  componentInstanceIndex: number | undefined
): string {
  return componentInstanceIndex !== undefined
    ? `component-${componentName}-${componentInstanceIndex}`
    : `component-${componentName}`
}

/**
 * Auto-generates test ID for common component types
 */
function buildDefaultTestId(type: string): string | undefined {
  const typeMap: Record<string, string> = {
    container: 'container',
    flex: 'flex',
    text: 'text',
    icon: 'icon',
  }
  return typeMap[type]
}

/**
 * Build test ID for component using config object
 */

function buildTestId(config: TestIdConfig): string | undefined {
  const { type, componentName, componentInstanceIndex, substitutedProps, childIndex } = config

  if (componentName) {
    return buildComponentTestId(componentName, componentInstanceIndex)
  }

  if (substitutedProps?.['data-testid']) {
    return substitutedProps['data-testid'] as string
  }

  if (childIndex !== undefined) {
    return `child-${childIndex}`
  }

  return buildDefaultTestId(type)
}

/**
 * Build element props with all attributes using config object
 * Complexity reduced by extracting helper functions
 */
export function buildElementProps(config: ElementPropsConfig): Record<string, unknown> {
  return buildElementPropsFromConfig(config)
}

/**
 * Build element props from config object
 */
function buildElementPropsFromConfig(config: ElementPropsConfig): Record<string, unknown> {
  const hasScrollAnimation =
    config.type === 'card' && Boolean(config.design?.motion?.animations?.scaleUp)
  const testId = buildTestId({
    type: config.type,
    componentName: config.componentName,
    componentInstanceIndex: config.componentInstanceIndex,
    substitutedProps: config.substitutedProps,
    childIndex: config.childIndex,
  })

  // Build all props
  const coreProps = buildCoreProps(config, testId)
  const componentDataProps = buildComponentDataProps(config)
  const translationProps = buildTranslationProps(config)
  const animationProps = buildAnimationProps(hasScrollAnimation)
  const entranceProps = buildEntranceInteractionProps(config)
  const scrollProps = buildScrollInteractionProps(config)
  const emptyStyleProps = buildEmptyElementStyles(config)

  // Merge all style objects to prevent overwrites
  const mergedStyle = {
    ...(coreProps.style as Record<string, unknown> | undefined),
    ...(entranceProps.style as Record<string, unknown> | undefined),
    ...(scrollProps.style as Record<string, unknown> | undefined),
    ...(emptyStyleProps.style as Record<string, unknown> | undefined),
  }

  // Remove style from individual prop objects
  const { style: _coreStyle, ...corePropsWithoutStyle } = coreProps
  const { style: _entranceStyle, ...entrancePropsWithoutStyle } = entranceProps
  const { style: _scrollStyle, ...scrollPropsWithoutStyle } = scrollProps
  const { style: _emptyStyle, ...emptyStylePropsWithoutStyle } = emptyStyleProps

  // Remove animation and style props from substitutedProps (already applied to style object)
  const {
    animation: _animation,
    style: _style,
    ...substitutedPropsWithoutAnimation
  } = config.substitutedProps || {}

  // Convert custom props to data attributes
  const customDataAttributes = convertCustomPropsToDataAttributes(substitutedPropsWithoutAnimation)

  return {
    ...substitutedPropsWithoutAnimation,
    ...corePropsWithoutStyle,
    ...componentDataProps,
    ...translationProps,
    ...animationProps,
    ...entrancePropsWithoutStyle,
    ...scrollPropsWithoutStyle,
    ...emptyStylePropsWithoutStyle,
    ...customDataAttributes,
    ...(Object.keys(mergedStyle).length > 0 && { style: mergedStyle }),
  }
}

/**
 * Build core props (className, style, data-testid)
 * Handles animation prop by extracting it from substitutedProps and merging into style
 *
 * Note: data-component-type removed for clean production HTML
 * This debug attribute was useful during development but adds unnecessary
 * markup to static sites and production builds
 */
function buildCoreProps(
  config: ElementPropsConfig,
  testId: string | undefined
): Record<string, unknown> {
  // Extract animation prop if present (after design token substitution)
  const animationProp = config.substitutedProps?.animation
  const hasAnimationProp = typeof animationProp === 'string'

  // Merge animation into style object if present
  const styleWithAnimation = hasAnimationProp
    ? { ...config.styleWithShadow, animation: animationProp }
    : config.styleWithShadow

  return {
    className: config.finalClassName,
    ...(styleWithAnimation && { style: styleWithAnimation }),
    ...(testId && { 'data-testid': testId }),
  }
}

/**
 * Build component-related data props (data-component, data-type, role)
 */
function buildComponentDataProps(config: ElementPropsConfig): Record<string, unknown> {
  if (!config.componentName) return {}

  return {
    'data-component': config.componentName,
    'data-type': config.type,
    ...(config.hasChildren &&
      CONTAINER_TYPES.includes(config.type) && {
        role: 'group',
      }),
  }
}

/**
 * Build translation props (data-translation-key, data-translations)
 */
function buildTranslationProps(config: ElementPropsConfig): Record<string, unknown> {
  if (!config.firstTranslationKey || !config.translationData) return {}

  return {
    'data-translation-key': config.firstTranslationKey,
    'data-translations': JSON.stringify(config.translationData),
  }
}

/**
 * Build animation props (data-scroll-animation)
 */
function buildAnimationProps(hasScrollAnimation: boolean): Record<string, unknown> {
  if (!hasScrollAnimation) return {}

  return {
    'data-scroll-animation': 'scale-up',
  }
}

/**
 * Build entrance interaction props (style for animations)
 */
function buildEntranceInteractionProps(config: ElementPropsConfig): Record<string, unknown> {
  if (!config.interactions?.entrance) return {}

  const { delay, duration, stagger } = config.interactions.entrance

  // Calculate total delay including stagger
  const totalDelay = calculateTotalDelay(delay, stagger, config.childIndex)

  // Build animation styles immutably
  const delayStyle = totalDelay ? { animationDelay: totalDelay } : {}
  const durationStyle = duration ? { animationDuration: duration } : {}
  const animationStyles = { ...delayStyle, ...durationStyle }

  // Combine all props immutably
  const hasAnimationStyles = Object.keys(animationStyles).length > 0
  const styleProps = hasAnimationStyles
    ? { style: { ...config.styleWithShadow, ...animationStyles } }
    : {}

  return styleProps
}

/**
 * Build scroll interaction props (data-scroll-*, style for animations)
 */
function buildScrollInteractionProps(config: ElementPropsConfig): Record<string, unknown> {
  if (!config.interactions?.scroll) return {}

  const { animation, threshold, delay, duration, once } = config.interactions.scroll

  // Build base data attributes immutably
  const baseProps: Record<string, unknown> = {
    'data-scroll-animation': animation,
  }

  const thresholdProps =
    threshold !== undefined ? { 'data-scroll-threshold': threshold.toString() } : {}
  const delayProps = delay ? { 'data-scroll-delay': delay } : {}
  const durationProps = duration ? { 'data-scroll-duration': duration } : {}
  const onceProps = once === true ? { 'data-scroll-once': once.toString() } : {}

  // Build animation styles immutably
  const delayStyle = delay ? { animationDelay: delay } : {}
  const durationStyle = duration ? { animationDuration: duration } : {}
  const animationStyles = { ...delayStyle, ...durationStyle }

  // Combine all props immutably
  const hasAnimationStyles = Object.keys(animationStyles).length > 0
  const styleProps = hasAnimationStyles
    ? { style: { ...config.styleWithShadow, ...animationStyles } }
    : {}

  return {
    ...baseProps,
    ...thresholdProps,
    ...delayProps,
    ...durationProps,
    ...onceProps,
    ...styleProps,
  }
}

/**
 * The engine types whose RENDERER gives the root a display of its own, and which
 * must therefore never receive the contentless placeholder's inline one.
 *
 * This is ONE of the two places a display can already be declared. The other is
 * the AUTHOR's own className, read by {@link classNameDeclaresDisplay}. The rule
 * both serve is the same and is stated once on `buildEmptyElementStyles`: never
 * OVERRULE a display somebody else declared. They cannot be collapsed into one
 * check — see the next paragraph for why a renderer's recipe is invisible here.
 *
 * ─── WHY A LIST, AND WHY THIS LIST ──────────────────────────────────────────
 *
 * A renderer applies its root recipe AFTER `buildElementProps` has run —
 * `mergePrestyle(computeKbdChordClasses(), authorClassName)` in
 * `render/registry/kbd-component.tsx`, and the same shape in `avatar`,
 * `preview` and `swatch`. So `config.finalClassName` cannot be inspected for a
 * display here: at this point in the pipeline the recipe does not exist yet,
 * and reading the className would report "no display" for every one of them.
 *
 * Nor can the placeholder be moved into the className to let tailwind-merge
 * settle it. Those renderers merge the recipe as the DEFAULTS and the incoming
 * className as the AUTHOR layer, and the author layer wins — so a placeholder
 * `inline-block` travelling in `finalClassName` would beat the very recipe it
 * must lose to. The precedence runs the wrong way for that trick.
 *
 * What is left is a carve-out by type, which is exactly what `image` already
 * is: the same rule, stated for the four further types the Design System
 * console review of 2026-09-16 MEASURED. Each was read live on `apps/website`
 * at 1440x900, and each was inert for the same reason — the classes were all
 * present, and a box that is not a flex container has no gap and nothing to
 * align:
 *
 *   `kbd`     computed `gap: 4px`, the two caps edge to edge at 0.00 px
 *   `avatar`  `items-center justify-center` inert; initials dx -3.14 / dy -3.50
 *             at `size-6`, dx -12.49 / dy -10.50 at `size-10`
 *   `preview` computed `gap: 8px`, value line / frame / caption all at 0.00 px
 *   `swatch`  chip right edge and label left edge both at x 561
 *
 * `badge` joined them on 2026-09-17, found by the same review's rule X6 and
 * measured the same way. A status badge carries no textual content of its own —
 * its dot and its label are rendered CHILDREN — so it reaches this branch
 * whenever it is nested, which is everywhere a status chip actually lives: in a
 * row, a cell or a card. `computeStatusBadgeWrapperClasses` asks for
 * `inline-flex items-center gap-1.5`, the gap computed 6px, and the dot painted
 * at 0.00 px from its label on all seven pairs measured. All three badge
 * variants declare their own display, so none of them needs the placeholder's:
 * `status` and the default pill are `inline-flex`, and `contrast` renders a
 * span of text that is inline either way.
 *
 * ─── AND WHY IT IS NOT SIMPLY DROPPED FOR EVERY TYPE ────────────────────────
 *
 * Because it was, first, and the full @regression suite caught it: `min-width`
 * and `min-height` DO NOT APPLY to a non-replaced inline box (CSS 2.1 §10.4),
 * so the 1x1 minimum this function exists to guarantee was itself riding on
 * that `display`. An empty `text` child renders
 * `<span data-component-type="text"></span>` with no recipe and no display of
 * its own; without `inline-block` it collapses to a zero box and Playwright
 * reports it `hidden`. TWENTY-ONE @regression specs said so, among them
 * `[internal ref]`, which asserts four positional
 * children are visible and found the empty one gone.
 *
 * So the measurement inverted the plan: almost every type NEEDS the inline
 * display, and only the handful that draw their own are harmed by it. A type
 * absent from this list keeps its behaviour byte for byte, which is what makes
 * the change provably confined.
 *
 * ─── THE COST, STATED ───────────────────────────────────────────────────────
 *
 * The next component found in the same trap has to be added here by hand, and
 * nothing will say so — the symptom is a `gap` or an `items-center` that
 * computes and paints nothing. That is the same cost `image` has carried since
 * it was written, and it is paid for by a list that is greppable and pinned in
 * `props-builder.test.ts`, rather than by a silent behaviour change across all
 * 88 types.
 */
const SELF_DISPLAYING_TYPES: ReadonlySet<string> = new Set([
  'kbd',
  'avatar',
  'preview',
  'swatch',
  'badge',
  // `form` joined on 2026-09-19, and it is the case the paragraph above
  // predicted: "the next component found in the same trap has to be added here
  // by hand, and nothing will say so".
  //
  // A form's body comes from its `fields`, never from `children` or `content`,
  // so `hasContent` — `Boolean(content || children?.length)` — is false for
  // EVERY form and this branch was reached by all of them. Measured on the
  // operator console's profile page, whose forms sit inside a card: the form
  // carried `style="display:inline-block;min-height:1px;min-width:1px"`, which
  // as a flex item of that card blockified to `display: block`. Its own
  // `flex flex-col gap-3.5` then painted nothing — `gap` computed 14px and the
  // submit sat 0px below the last input.
  //
  // It needs no placeholder minimum in exchange: a form ALWAYS renders its
  // fields and its submit, so it has intrinsic content in every case the 1x1
  // floor exists to protect. That is exactly the `image` argument.
  'form',
])

/**
 * Every Tailwind utility that sets `display`, as the bare utility with no
 * variants. Transcribed from the framework's Display page rather than derived,
 * because a utility this list misses simply keeps today's behaviour.
 */
const DISPLAY_UTILITIES: ReadonlySet<string> = new Set([
  'block',
  'inline-block',
  'inline',
  'flex',
  'inline-flex',
  'table',
  'inline-table',
  'table-caption',
  'table-cell',
  'table-column',
  'table-column-group',
  'table-footer-group',
  'table-header-group',
  'table-row-group',
  'table-row',
  'flow-root',
  'grid',
  'inline-grid',
  'contents',
  'list-item',
  'hidden',
])

/**
 * Strip a Tailwind class of its variants and its `!` important marker, leaving
 * the utility itself: `empty:hidden!` -> `hidden`, `md:dark:flex` -> `flex`,
 * `[&:not(:first-child)]:block` -> `block`.
 *
 * The split is on the LAST colon, which is what makes an arbitrary variant work:
 * its own colons are inside the brackets that precede the separator.
 */
function bareUtility(token: string): string {
  const withoutImportant = token.replace(/^!/, '').replace(/!$/, '')
  return withoutImportant.slice(withoutImportant.lastIndexOf(':') + 1)
}

/**
 * Has the AUTHOR declared a display for this element in its own className?
 *
 * The second source of an already-declared display, beside
 * {@link SELF_DISPLAYING_TYPES}. Unlike a renderer's root recipe, an author's
 * className IS visible at this point in the pipeline, so this half needs no
 * hand-maintained list of types and cannot silently fall behind one.
 *
 * ─── THE CASE IT WAS FOUND ON ───────────────────────────────────────────────
 *
 * A `text` element that carries no authored `content` because it is FILLED AT
 * RUNTIME — an action's `onSuccess.status` target — is contentless by this
 * builder's test, which only knows about `content` and `children`. Authors write
 * `empty:hidden` on exactly those elements, so the box does not sit in the
 * layout until it has something to say. The placeholder's inline
 * `display:inline-block` beat that class, so the box stayed, and an assertion
 * that waited for the element to become visible was satisfied instantly by an
 * EMPTY span — a barrier that had silently stopped being one.
 *
 * `empty:hidden!` did not have the defect, because `!important` in an author
 * stylesheet outranks a non-important inline declaration. That workaround is
 * what the fix makes unnecessary rather than what it breaks: an element whose
 * display is `none` either way gains nothing from the 1x1 floor.
 *
 * ─── WHY EVERY DISPLAY UTILITY AND NOT ONLY THE HIDING ONES ─────────────────
 *
 * Because the rule is "never overrule a declared display", and `flex` is as much
 * a declaration as `hidden`. Overruling a `flex` is not a harmless difference —
 * it is the same defect the whole {@link SELF_DISPLAYING_TYPES} list was
 * measured for, where an inert `gap` painted 0px between a badge's dot and its
 * label. It is also the confined half: every display other than `hidden`,
 * `inline` and `contents` still generates a block-level box, so the 1x1 minimum
 * this function guarantees keeps applying (CSS 2.1 §10.4 — min-* do not apply to
 * a non-replaced INLINE box, which is the whole reason the placeholder declares
 * a display at all). An element with no display utility at all is untouched, and
 * that is the population the twenty-one @regression specs pin.
 */
function classNameDeclaresDisplay(className: string | undefined): boolean {
  if (!className) return false
  return className.split(/\s+/).some((token) => DISPLAY_UTILITIES.has(bareUtility(token)))
}

/**
 * Has a display already been declared for this element, by either of the two
 * sources that can declare one? See {@link SELF_DISPLAYING_TYPES} for the type
 * half and {@link classNameDeclaresDisplay} for the author half.
 */
function displayAlreadyDeclared(config: ElementPropsConfig): boolean {
  return SELF_DISPLAYING_TYPES.has(config.type) || classNameDeclaresDisplay(config.finalClassName)
}

/**
 * Build styles for empty elements (components and grids without content)
 */
function buildEmptyElementStyles(config: ElementPropsConfig): Record<string, unknown> {
  if (config.hasContent) return {}

  // An `image` element is never truly "empty" — it renders its own intrinsic
  // content (the bitmap from `src`) and is sized by `h-*`/`w-*` classes, so it
  // takes no placeholder minimum either and keeps only its shadow.
  //
  // This carve-out named the hazard first, and the sentence it was written with
  // is what eventually retired the inline `display` for every other type too:
  // an INLINE `style="display:…"` beats every class-based display utility, so
  // it defeated `hidden` / `dark:hidden` / `dark:block` here — the dual-image
  // dark/light logo lockup would show BOTH images at once. See the note below.
  if (config.type === 'image') {
    return config.styleWithShadow && Object.keys(config.styleWithShadow).length > 0
      ? { style: { ...config.styleWithShadow } }
      : {}
  }

  // A component reference or a positional child with no content of its own: a
  // 1x1 minimum, so an empty box is still findable on the page, and the display
  // that minimum needs to mean anything — unless a display is already declared.
  //
  // THE RULE IS NOT "NEVER DECLARE A DISPLAY", IT IS "NEVER OVERRULE ONE", and
  // there are exactly two ways one can already have been declared:
  //
  //   the TYPE's renderer   — {@link SELF_DISPLAYING_TYPES}, a list, because the
  //                           root recipe is merged AFTER this runs and so
  //                           cannot be read off the className here
  //   the AUTHOR's class    — {@link classNameDeclaresDisplay}, read directly,
  //                           because `finalClassName` IS the author layer
  //
  // The 1x1 minimum is stamped either way. It costs nothing on a box that is
  // `display:none` and it is the floor that keeps an unstyled empty child
  // findable, so only the `display` key is withheld.
  if (config.componentName || config.childIndex !== undefined) {
    return {
      style: {
        ...config.styleWithShadow,
        ...(displayAlreadyDeclared(config) ? {} : { display: 'inline-block' }),
        minHeight: '1px',
        minWidth: '1px',
      },
    }
  }

  // Grid without content and not a component reference
  if (!config.componentName && config.type === 'grid') {
    return {
      style: {
        ...config.styleWithShadow,
        minHeight: '100px',
        minWidth: '100px',
      },
    }
  }

  return {}
}
