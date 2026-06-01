/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentRenderer } from '../component-dispatch-config'

function extractDropdownProps(elementProps: Record<string, unknown>): {
  id?: string
  label?: string
  dataSource: unknown
  valueField: unknown
  displayField: unknown
  initialValue?: string
  onSelect?: unknown
} {
  return {
    id: elementProps.id as string | undefined,
    label: elementProps.label as string | undefined,
    dataSource: elementProps.dataSource,
    valueField: elementProps.valueField,
    displayField: elementProps.displayField,
    initialValue: elementProps.initialValue as string | undefined,
    onSelect: elementProps.onSelect,
  }
}

export const islandDropdownComponent: ComponentRenderer = ({ elementProps, rawProps }) => {
  const dropdownProps = extractDropdownProps({
    ...elementProps,
    ...(rawProps ?? {}),
  })
  const containerId = dropdownProps.id ?? (rawProps?.id as string | undefined)
  const label = dropdownProps.label ?? (rawProps?.label as string | undefined)
  const propsJson = JSON.stringify(dropdownProps)

  return (
    <div
      id={containerId}
      data-island="dropdown"
      data-island-props={propsJson}
      data-testid={elementProps['data-testid'] as string | undefined}
      data-component-type="dropdown"
    >
      {label && (
        <label
          htmlFor={containerId ? `${containerId}-select` : undefined}
          className="text-foreground mb-1 block text-sm font-medium"
        >
          {label}
        </label>
      )}
      <select
        id={containerId ? `${containerId}-select` : undefined}
        className="border-border bg-background-raised text-foreground focus:border-focus-ring focus:ring-focus-ring w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none"
        defaultValue=""
      >
        <option
          value=""
          disabled
        >
          Loading...
        </option>
      </select>
    </div>
  )
}
