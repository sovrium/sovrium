/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Slider } from '@base-ui/react/slider'
import { useCallback, type ReactElement, type RefObject } from 'react'

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
      className="border-primary bg-background-raised hover:bg-primary-subtle focus-visible:ring-focus-ring block h-4 w-4 rounded-full border-2 shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
    />
  )
}
