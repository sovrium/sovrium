/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { EntranceAnimationType } from '@/domain/models/app/pages/components/interactions/entrance'
import type { ScrollAnimation } from '@/domain/models/app/pages/components/interactions/scroll'

/**
 * The entrance and scroll animations, played by shadcn/ui's own motion.
 *
 * `interactions.entrance.animation` and `interactions.scroll.animation` name an
 * animation (`fadeInUp`, `zoomIn` …), and the page carries it as the class
 * `animate-<name>`: the renderer stamps it for an entrance, and the scroll
 * runtime adds it when the element enters the viewport. Those classes had no
 * rule behind them, so nothing moved.
 *
 * Each one is now a composition of tw-animate-css, the library shadcn/ui's
 * components animate with: `animate-in` runs its `enter` keyframes, and
 * `fade-in`, `slide-in-from-*` and `zoom-in-*` set what the element enters
 * from. There is no Sovrium keyframe and no Sovrium timing: the duration and
 * the curve are tw-animate-css's defaults, and an author's `duration` and
 * `delay` arrive as the inline `animation-duration` and `animation-delay` the
 * renderer and the scroll runtime already write, which beat the shorthand.
 *
 * `@apply` rather than a hand-written `animation:` so the compiler emits the
 * `enter` keyframes only because a rule here uses them.
 */
const ANIMATION_UTILITIES: Readonly<Record<EntranceAnimationType | ScrollAnimation, string>> = {
  fadeIn: 'animate-in fade-in',
  fadeInUp: 'animate-in fade-in slide-in-from-bottom-4',
  fadeInDown: 'animate-in fade-in slide-in-from-top-4',
  fadeInLeft: 'animate-in fade-in slide-in-from-left-4',
  fadeInRight: 'animate-in fade-in slide-in-from-right-4',
  zoomIn: 'animate-in fade-in zoom-in-95',
  slideInUp: 'animate-in slide-in-from-bottom-4',
  slideInDown: 'animate-in slide-in-from-top-4',
}

/**
 * The `.animate-<name>` rules for every entrance and scroll animation, as
 * source CSS for the utilities layer.
 */
export function generateEntranceAnimationCSS(): string {
  const rules = Object.entries(ANIMATION_UTILITIES).map(
    ([name, utilities]) => `.animate-${name} { @apply ${utilities}; }`
  )
  return ['/* Entrance and scroll animations (tw-animate-css) */', ...rules].join('\n')
}
