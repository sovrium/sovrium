/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as React from 'react'
import { resolveThemeColor } from '@/presentation/styling/theme-colors'
import { Icon } from '@/presentation/ui/ui/icon'

type ButtonColor = 'orange' | 'blue' | 'green' | 'red'
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link'
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'
type IconPosition = 'left' | 'right'

interface ButtonProps extends Omit<React.ComponentProps<'button'>, 'color'> {
  variant?: ButtonVariant
  size?: ButtonSize
  color?: ButtonColor
  icon?: string
  iconPosition?: IconPosition
  asChild?: boolean
  children: React.ReactNode
}

/**
 * Maps button variant to Tailwind CSS classes
 */
function getButtonVariantClasses(variant?: ButtonVariant): string {
  switch (variant) {
    case 'primary':
      return 'btn-primary bg-primary text-primary-foreground hover:bg-primary/90'
    case 'secondary':
      return 'btn-secondary bg-secondary text-secondary-foreground hover:bg-secondary/80'
    case 'outline':
      return 'btn-outline border border-input bg-background hover:bg-accent hover:text-accent-foreground'
    case 'ghost':
      return 'btn-ghost hover:bg-accent hover:text-accent-foreground'
    case 'link':
      return 'btn-link text-primary underline-offset-4 hover:underline'
    default:
      return 'btn-primary bg-primary text-primary-foreground hover:bg-primary/90'
  }
}

/**
 * Maps button size to Tailwind CSS classes
 */
function getButtonSizeClasses(size?: ButtonSize): string {
  switch (size) {
    case 'sm':
      return 'btn-sm h-9 rounded-md px-3 text-xs'
    case 'md':
      return 'btn-md h-10 px-4 py-2'
    case 'lg':
      return 'btn-lg h-11 rounded-md px-8'
    case 'xl':
      return 'btn-xl h-12 rounded-md px-10 text-lg'
    default:
      return 'btn-md h-10 px-4 py-2'
  }
}

/**
 * Button Component
 *
 * Renders a button with variant, size, optional theme color, and icon support.
 * When asChild is true, renders children directly (useful for wrapping anchor tags).
 *
 * @param props - Button props including variant, size, color, icon, iconPosition, and asChild
 * @returns Button element or children if asChild is true
 */
function Button({
  className = '',
  variant,
  size,
  color,
  icon,
  iconPosition = 'left',
  asChild = false,
  children,
  ...props
}: Readonly<ButtonProps>) {
  // Resolve theme color to hex value
  const colorValue = resolveThemeColor(color)
  const style = colorValue ? { backgroundColor: colorValue } : undefined

  const baseClasses =
    'ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0'
  const classes =
    `${baseClasses} ${getButtonVariantClasses(variant)} ${getButtonSizeClasses(size)} ${className}`.trim()

  // If asChild is true, clone the child element and apply button props to it
  if (asChild && React.isValidElement(children)) {
    const childProps: React.HTMLAttributes<HTMLElement> = {
      ...props,
      className: classes,
      style,
    }
    // When icon is present, render icon alongside the original child content
    if (icon) {
      const childContent = (children as React.ReactElement<{ children?: React.ReactNode }>).props
        .children
      const contentWithIcon = [
        icon && iconPosition === 'left' && (
          <Icon
            key="icon-left"
            name={icon}
          />
        ),
        childContent,
        icon && iconPosition === 'right' && (
          <Icon
            key="icon-right"
            name={icon}
          />
        ),
      ].filter(Boolean)
      return React.cloneElement(children, childProps, ...contentWithIcon)
    }
    return React.cloneElement(children, childProps)
  }

  // Render button content with optional icon
  const buttonContent = (
    <>
      {icon && iconPosition === 'left' && <Icon name={icon} />}
      {children}
      {icon && iconPosition === 'right' && <Icon name={icon} />}
    </>
  )

  return (
    <button
      className={classes}
      style={style}
      {...props}
    >
      {buttonContent}
    </button>
  )
}

export { Button }
export type { ButtonProps, ButtonVariant, ButtonSize }
