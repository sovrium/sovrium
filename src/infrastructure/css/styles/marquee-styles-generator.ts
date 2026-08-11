/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Marquee band CSS.
 *
 * Plain CSS keyed off the `[data-marquee-*]` attributes the marquee renderer
 * emits — the same shape `css/theme/code-block-styles-generator.ts` uses, and
 * for the same reasons:
 *
 *  - **It flows through BOTH compile engines.** `buildSourceCSS` is the shared
 *    input for the native PostCSS path and the pure-JS native-free binary path,
 *    so a rule written here needs no Tailwind candidate scan to survive into the
 *    compiled stylesheet.
 *  - **Tailwind cannot express this.** `@keyframes`, `animation-play-state` under
 *    `:hover` / `:focus-within`, and a `prefers-reduced-motion` override are not
 *    utility-shaped; expressing them as arbitrary variants would leave the band's
 *    entire behaviour hostage to the candidate corpus.
 *
 * Only two values come from the schema, and both arrive as CSS custom properties
 * set inline on the band root: `--sv-marquee-duration` (from `marqueeSpeed`,
 * SECONDS) and `--sv-marquee-gap` (from `marqueeGap`, pattern-restricted by
 * `MarqueeGapSchema` so the interpolation is not a CSS-injection surface).
 *
 * ## Three details that are load-bearing, not cosmetic
 *
 * 1. **The gap sits on the GROUP, never on the track.** The track loops by
 *    translating exactly 50% of its own width. A gap on the track would make that
 *    50% under-shoot by half a gap, and the band would visibly jump once per
 *    cycle — a defect no screenshot catches, because it only shows at the seam.
 *
 * 2. **Each group is at least one viewport wide (`100cqw`).** Two content-sized
 *    groups loop seamlessly but do not necessarily overflow the band, so a short
 *    item list would leave dead space mid-cycle and nothing to scroll under
 *    reduced motion. `min-width: 100cqw` resolves against the VIEWPORT (made an
 *    inline-size container below), not against the track — a percentage would be
 *    circular against the track's own `max-content` width and resolve to zero
 *    during intrinsic sizing.
 *
 * 3. **Hover pauses on the TRACK, not on the root.** The root carries the band's
 *    vertical gutter (and, when configured, the pause control); the moving
 *    content is the track. Binding the pause to the moving content is what a
 *    visitor means by "hold still so I can read that" — and it keeps the gutter
 *    from latching the band paused. Keyboard focus pauses via `:focus-within` on
 *    the ROOT, because WCAG 2.2.2 is not satisfied by hover alone: a keyboard
 *    user chasing a moving link would otherwise never be able to hold it still.
 */

/**
 * Duration used when the author does not set `marqueeSpeed`. Mirrors the
 * renderer's own default so the CSS fallback and the inline custom property
 * never disagree.
 */
const DEFAULT_DURATION = '30s'

/** The two loop keyframe sets — one per axis. */
const KEYFRAMES = `@keyframes sv-marquee-x {
      from { transform: translateX(0); }
      to { transform: translateX(-50%); }
    }
    @keyframes sv-marquee-y {
      from { transform: translateY(0); }
      to { transform: translateY(-50%); }
    }`

/** Band structure: root gutter, clipping viewport, animated track, item group. */
const STRUCTURE = `[data-marquee] {
      position: relative;
      padding-top: 1rem;
      padding-bottom: 1rem;
    }

    [data-marquee-viewport] {
      overflow: hidden;
      container-type: inline-size;
    }

    [data-marquee-track] {
      display: flex;
      flex-direction: row;
      width: max-content;
      animation-name: sv-marquee-x;
      animation-duration: var(--sv-marquee-duration, ${DEFAULT_DURATION});
      animation-timing-function: linear;
      animation-iteration-count: infinite;
      animation-play-state: running;
    }

    [data-marquee-group] {
      display: flex;
      flex-direction: row;
      flex: 0 0 auto;
      align-items: center;
      justify-content: space-around;
      min-width: 100cqw;
      gap: var(--sv-marquee-gap, 0px);
    }

    [data-marquee-direction='right'] [data-marquee-track],
    [data-marquee-direction='down'] [data-marquee-track] {
      animation-direction: reverse;
    }

    [data-marquee-axis='y'] [data-marquee-track] {
      flex-direction: column;
      width: auto;
      height: max-content;
      animation-name: sv-marquee-y;
    }

    [data-marquee-axis='y'] [data-marquee-group] {
      flex-direction: column;
      min-width: 0;
      min-height: 100%;
    }`

/**
 * Pause states + the optional edge fade.
 *
 * Hover pauses on the TRACK (the moving content), keyboard focus pauses via
 * `:focus-within` on the ROOT, and the explicit `pauseControl` pauses via
 * `data-marquee-paused` — see the module doc for why those three targets differ.
 */
const PAUSE_AND_FADE = `[data-marquee-pause-on-hover='true'] [data-marquee-track]:hover,
    [data-marquee-pause-on-hover='true']:focus-within [data-marquee-track],
    [data-marquee-paused='true'] [data-marquee-track] {
      animation-play-state: paused;
    }

    [data-marquee-fade='true'] [data-marquee-viewport] {
      mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent);
    }

    [data-marquee-axis='y'][data-marquee-fade='true'] [data-marquee-viewport] {
      mask-image: linear-gradient(to bottom, transparent, black 6%, black 94%, transparent);
    }`

/**
 * Reduced motion: the loop STOPS — not "slows down", which is still perpetual
 * motion and still fails WCAG 2.2.2 for this visitor. No content is dropped to
 * achieve stillness: the band becomes a plain, manually scrollable row so every
 * item stays reachable.
 */
const REDUCED_MOTION = `@media (prefers-reduced-motion: reduce) {
      [data-marquee-track] {
        animation: none;
      }
      [data-marquee-viewport] {
        overflow-x: auto;
        overflow-y: hidden;
      }
      [data-marquee-axis='y'] [data-marquee-viewport] {
        overflow-x: hidden;
        overflow-y: auto;
      }
    }`

/**
 * Generate the marquee band stylesheet. Static (no theme input): every colour
 * the band paints comes from its children or from the author's `className`, so
 * there is nothing here to re-resolve per theme.
 */
export function generateMarqueeStyles(): string {
  return [
    '/* ── Marquee band (US-PAGES-INTERACTIVITY-INTERACTIONS-004) ── */',
    KEYFRAMES,
    STRUCTURE,
    PAUSE_AND_FADE,
    REDUCED_MOTION,
  ].join('\n\n    ')
}
