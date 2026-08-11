/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Slider } from '@base-ui/react/slider'
import { useCallback, type ReactElement, type RefObject } from 'react'
import { computeSliderThumbClasses } from './numeric-default-classes'

interface SliderThumbProps {
  readonly inputRef: RefObject<HTMLInputElement | null>
  readonly label: string | undefined
}

/**
 * Base UI's `Slider.Thumb` renders an outer `<div>` plus a nested
 * `<input type="range">` (the `role="slider"` host). The wrapper div
 * carries the visual chrome; ARIA attributes that must land on the
 * input are forwarded via `inputRef` in a `useEffect` upstream (see
 * `useSliderAriaSync`).
 *
 * `label` is mirrored into `aria-label` via Base UI's `getAriaLabel`
 * prop (the slider has no associated `<label>` element — label is
 * rendered as plain text above the control). When `label` is missing
 * Base UI accepts `null` to mean "no label" — that single null
 * literal is the only reason for the file-level disable in the
 * original island.
 */
export function SliderThumb({ inputRef, label }: SliderThumbProps): ReactElement {
  const resolvedLabel = label ?? ''
  const getAriaLabel = useCallback((): string => resolvedLabel, [resolvedLabel])
  return (
    <Slider.Thumb
      inputRef={inputRef}
      // eslint-disable-next-line unicorn/no-null -- Base UI's getAriaLabel uses null to signal "no aria-label"; undefined is not equivalent to that contract
      getAriaLabel={label === undefined ? null : getAriaLabel}
      className={computeSliderThumbClasses()}
    />
  )
}
