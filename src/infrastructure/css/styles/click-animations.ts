/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

export function generateClickAnimationCSS(): string {
  return `/* Click interaction animations */
${PULSE_ANIMATION_CSS}
${BOUNCE_ANIMATION_CSS}
${SHAKE_ANIMATION_CSS}
${FLASH_ANIMATION_CSS}
${RIPPLE_ANIMATION_CSS}`
}
