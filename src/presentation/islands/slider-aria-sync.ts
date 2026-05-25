/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, type RefObject } from 'react'

export function useSliderAriaSync(
  inputRef: RefObject<HTMLInputElement | null>,
  min: number,
  max: number
): void {
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.setAttribute('aria-valuemin', String(min))
    input.setAttribute('aria-valuemax', String(max))
  }, [inputRef, min, max])
}
