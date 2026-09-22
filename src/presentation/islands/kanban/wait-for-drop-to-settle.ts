/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How many painted frames a drop waits for the board to agree with the pointer.
 *
 * TWO, not one: the chain the wait exists for is a render, then a PASSIVE
 * effect, then the render that effect schedules — and a passive-effect flush
 * plus its follow-up render are not guaranteed to land inside a single frame.
 * Two costs ~32 ms between the release and the card settling, comfortably
 * inside the 100 ms a direct manipulation has to answer within to read as
 * instant. See `settled-drop-target.tsx` for what is being waited for.
 */
const SETTLE_FRAMES = 2

/**
 * Wait for {@link SETTLE_FRAMES} painted frames.
 *
 * `requestAnimationFrame` rather than a timer, deliberately: a frame callback
 * fires when the browser has finished the work in front of it, so the wait
 * lengthens by itself on a loaded machine instead of expiring early — which is
 * exactly the condition the race it guards shows up under.
 */
export async function waitForDropToSettle(): Promise<void> {
  await new Promise<void>((resolve) => {
    const step = (remaining: number): void => {
      if (remaining === 0) {
        resolve()
        return
      }
      globalThis.requestAnimationFrame(() => step(remaining - 1))
    }
    step(SETTLE_FRAMES)
  })
}
