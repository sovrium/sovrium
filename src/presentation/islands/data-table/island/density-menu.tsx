/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { useCallback } from 'react'
import { DROPDOWN_TRIGGER_CLASS } from './use-dropdown-state'
import type { RowDensity } from '../../hooks/use-table-preferences'

interface DensityMenuProps {
  readonly current: RowDensity
  readonly onSelect: (density: RowDensity) => void
}

const DENSITY_LABELS: ReadonlyArray<{
  readonly key: RowDensity
  readonly label: string
}> = [
  { key: 'compact', label: 'Compact' },
  { key: 'normal', label: 'Normal' },
  { key: 'spacious', label: 'Spacious' },
]

interface DensityMenuItemProps {
  readonly densityKey: RowDensity
  readonly label: string
  readonly current: RowDensity
  readonly onSelect: (density: RowDensity) => void
}

function DensityMenuItem({ densityKey, label, current, onSelect }: DensityMenuItemProps) {
  const handleClick = useCallback(() => onSelect(densityKey), [densityKey, onSelect])
  return (
    <Menu.Item
      className={`hover:bg-background-subtle data-[highlighted]:bg-background-subtle cursor-pointer px-4 py-2 text-sm ${
        current === densityKey ? 'font-medium' : ''
      }`}
      onClick={handleClick}
    >
      {label}
    </Menu.Item>
  )
}

export function DensityMenu({ current, onSelect }: DensityMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className={DROPDOWN_TRIGGER_CLASS}
        aria-label="Density"
      >
        Density
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4}>
          <Menu.Popup
            aria-label="Row density"
            className="border-border bg-background-overlay z-50 rounded border py-1 shadow-lg"
          >
            {DENSITY_LABELS.map(({ key, label }) => (
              <DensityMenuItem
                key={key}
                densityKey={key}
                label={label}
                current={current}
                onSelect={onSelect}
              />
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
