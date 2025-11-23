/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as React from 'react'

interface CardWithHeaderProps extends React.ComponentProps<'div'> {
  children?: React.ReactNode
}

interface CardHeaderProps extends React.ComponentProps<'div'> {
  children?: React.ReactNode
}

interface CardBodyProps extends React.ComponentProps<'div'> {
  children?: React.ReactNode
}

interface CardFooterProps extends React.ComponentProps<'div'> {
  children?: React.ReactNode
}

/**
 * Card With Header Component
 *
 * Parent container for a card with nested header, body, and footer.
 * Applies lg border-radius to the entire card structure.
 *
 * @param props - Card with header props
 * @returns Div element with lg border-radius
 */
function CardWithHeader({ className = '', children, ...props }: Readonly<CardWithHeaderProps>) {
  const baseClasses = 'bg-white border border-gray-200 overflow-hidden'
  const radiusClasses = 'rounded-lg'
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

/**
 * Card Header Component
 *
 * Header section of a card with top border-radius only.
 * Uses rounded-t-lg to match parent's top corners.
 *
 * @param props - Card header props
 * @returns Div element with top border-radius
 */
function CardHeader({ className = '', children, ...props }: Readonly<CardHeaderProps>) {
  const baseClasses = 'bg-gray-50 px-4 py-3 border-b border-gray-200'
  const radiusClasses = 'rounded-t-lg'
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

/**
 * Card Body Component
 *
 * Body section of a card with no border-radius.
 * Content area between header and footer.
 *
 * @param props - Card body props
 * @returns Div element with no border-radius
 */
function CardBody({ className = '', children, ...props }: Readonly<CardBodyProps>) {
  const baseClasses = 'px-4 py-3'
  const classes = `${baseClasses} ${className}`.trim()

  return (
    <div
      className={classes}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Card Footer Component
 *
 * Footer section of a card with bottom border-radius only.
 * Uses rounded-b-lg to match parent's bottom corners.
 *
 * @param props - Card footer props
 * @returns Div element with bottom border-radius
 */
function CardFooter({ className = '', children, ...props }: Readonly<CardFooterProps>) {
  const baseClasses = 'bg-gray-50 px-4 py-3 border-t border-gray-200'
  const radiusClasses = 'rounded-b-lg'
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

export { CardWithHeader, CardHeader, CardBody, CardFooter }
export type { CardWithHeaderProps, CardHeaderProps, CardBodyProps, CardFooterProps }
