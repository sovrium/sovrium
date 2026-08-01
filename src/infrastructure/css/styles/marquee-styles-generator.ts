/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const DEFAULT_DURATION = '30s'

const KEYFRAMES = `@keyframes sv-marquee-x {
      from { transform: translateX(0); }
      to { transform: translateX(-50%); }
    }
    @keyframes sv-marquee-y {
      from { transform: translateY(0); }
      to { transform: translateY(-50%); }
    }`

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

export function generateMarqueeStyles(): string {
  return [
    '/* ── Marquee band (US-PAGES-INTERACTIVITY-INTERACTIONS-004) ── */',
    KEYFRAMES,
    STRUCTURE,
    PAUSE_AND_FADE,
    REDUCED_MOTION,
  ].join('\n\n    ')
}
