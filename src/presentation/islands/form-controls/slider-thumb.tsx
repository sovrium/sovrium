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

export function SliderThumb({ inputRef, label }: SliderThumbProps): ReactElement {
  const resolvedLabel = label ?? ''
  const getAriaLabel = useCallback((): string => resolvedLabel, [resolvedLabel])
  return (
    <Slider.Thumb
      inputRef={inputRef}
      getAriaLabel={label === undefined ? null : getAriaLabel}
      className={computeSliderThumbClasses()}
    />
  )
}
