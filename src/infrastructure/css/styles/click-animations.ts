/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Click interaction animations
 *
 * Provides CSS animations for click interactions (pulse, ripple, bounce, etc.)
 * These animations are separate from entrance/exit animations provided by tw-animate-css
 *
 * Architecture: Infrastructure Layer (CSS generation)
 * - Supports click interaction schema (animation: pulse, ripple, bounce, shake, flash, none)
 * - Generates @keyframes and utility classes for click feedback
 *
 * ## Why everything here is namespaced
 *
 * `@keyframes` identifiers are GLOBAL — they are not scoped by `@layer`, and a
 * later definition of the same name replaces an earlier one outright. This
 * module previously defined `@keyframes pulse` and `@keyframes bounce`, which
 * are also Tailwind's. Both landed in the compiled CSS twice, Tailwind's came
 * second, and Tailwind's therefore won: an author who set
 * `interactions.click.animation: 'pulse'` got Tailwind's 2s infinite opacity
 * fade instead of this module's 300ms scale pop. The feature was silently dead
 * for two of its five values.
 *
 * The class names collided for the same reason (both sides emit into
 * `@layer utilities`, where source order decides), so BOTH are namespaced:
 * keyframes as `sv-click-*`, classes as `animate-click-*` — the latter matching
 * the prefix the runtime click handler builds in `page-body-scripts.tsx`.
 *
 * Never name a keyframe here after a Tailwind animation utility.
 */

/**
 * Pulse animation CSS - subtle scale pulse
 */
const PULSE_ANIMATION_CSS = `
@keyframes sv-click-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}

.animate-click-pulse {
  animation: sv-click-pulse 300ms ease-in-out;
}`

/**
 * Bounce animation CSS - playful bounce effect
 */
const BOUNCE_ANIMATION_CSS = `
@keyframes sv-click-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  25% {
    transform: translateY(-8px);
  }
  50% {
    transform: translateY(-4px);
  }
  75% {
    transform: translateY(-2px);
  }
}

.animate-click-bounce {
  animation: sv-click-bounce 300ms ease-out;
}`

/**
 * Shake animation CSS - horizontal shake
 */
const SHAKE_ANIMATION_CSS = `
@keyframes sv-click-shake {
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-4px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(4px);
  }
}

.animate-click-shake {
  animation: sv-click-shake 300ms ease-in-out;
}`

/**
 * Flash animation CSS - quick opacity flash
 */
const FLASH_ANIMATION_CSS = `
@keyframes sv-click-flash {
  0%, 100% {
    opacity: 1;
  }
  25%, 75% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}

.animate-click-flash {
  animation: sv-click-flash 300ms ease-in-out;
}`

/**
 * Ripple animation CSS - Material Design ripple
 */
const RIPPLE_ANIMATION_CSS = `
@keyframes sv-click-ripple {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
}

.animate-click-ripple {
  position: relative;
  overflow: hidden;
}

.animate-click-ripple::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100px;
  height: 100px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  animation: sv-click-ripple 600ms ease-out;
}`

/**
 * Generate CSS for click interaction animations
 *
 * Returns CSS string with @keyframes and .animate-* utility classes
 * for all click interaction animation types
 */
export function generateClickAnimationCSS(): string {
  return `/* Click interaction animations */
${PULSE_ANIMATION_CSS}
${BOUNCE_ANIMATION_CSS}
${SHAKE_ANIMATION_CSS}
${FLASH_ANIMATION_CSS}
${RIPPLE_ANIMATION_CSS}`
}
