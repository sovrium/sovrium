/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  Download,
  ArrowRight,
  Rocket,
  ExternalLink,
  Package,
  type LucideProps,
} from 'lucide-react'
import type { ReactElement } from 'react'

interface IconProps extends LucideProps {
  name: string
}

/**
 * Maps icon names to Lucide icon components
 */
const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  download: Download,
  'arrow-right': ArrowRight,
  rocket: Rocket,
  'external-link': ExternalLink,
  package: Package,
}

/**
 * Icon Component
 *
 * Renders a Lucide icon based on the icon name.
 *
 * @param props - Icon props including name and Lucide customization options
 * @returns Lucide icon element
 */
export function Icon({ name, ...props }: Readonly<IconProps>): Readonly<ReactElement | undefined> {
  const IconComponent = iconMap[name]

  if (!IconComponent) {
    return undefined
  }

  return (
    <IconComponent
      data-testid="icon"
      {...props}
    />
  )
}

export type { IconProps }
