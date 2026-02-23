/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as React from 'react'

interface SpeechBubbleProps extends React.ComponentProps<'div'> {
  children?: React.ReactNode
}

/**
 * Speech Bubble Component
 *
 * Renders a speech bubble with custom border-radius per corner to create
 * an arrow-like/directional indicator shape.
 *
 * Uses Tailwind's per-corner border-radius utilities:
 * - rounded-tl-md: top-left corner (--radius-md)
 * - rounded-tr-md: top-right corner (--radius-md)
 * - rounded-br-md: bottom-right corner (--radius-md)
 * - rounded-bl-none: bottom-left corner (--radius-none / 0)
 *
 * @param props - Speech bubble props
 * @returns Div element with per-corner border-radius
 */
function SpeechBubble({ className = '', children, ...props }: Readonly<SpeechBubbleProps>) {
  const baseClasses = 'bg-blue-100 border border-blue-300 px-4 py-3 text-sm'
  const radiusClasses = 'rounded-tl-md rounded-tr-md rounded-br-md rounded-bl-none'
  const classes = `${baseClasses} ${radiusClasses} ${className}`.trim()

  return (
    <div
      className={classes}
      {...props}
    >
      {children}
    </div>
  )
}

export { SpeechBubble }
export type { SpeechBubbleProps }
