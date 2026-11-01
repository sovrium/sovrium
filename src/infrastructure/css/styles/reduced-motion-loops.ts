/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The looping utilities stand still for a reader who asked for reduced motion:
 * a skeleton's pulse, a loader's spin, a bounce or a ping would otherwise keep
 * running for as long as the page is open. Placed last and `!important`, so no
 * variant or click feedback carrying the same animation can restart it. It
 * opens on a newline so it can follow the click animations on their own line.
 */
export const REDUCED_MOTION_LOOPS = `
      @media (prefers-reduced-motion: reduce) {
        .animate-pulse, .animate-spin, .animate-bounce, .animate-ping {
          animation: none !important;
        }
      }`
