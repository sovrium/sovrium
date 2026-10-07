/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `map` SSR host — the frame the map island mounts into.
 *
 * Two things are settled here, on the server, and handed over as props:
 *
 * - **The tiles.** `MAP_TILES_URL` / `MAP_TILES_ATTRIBUTION` are operator
 *   environment, read here and never by the browser bundle (S4). Unset, the
 *   island draws a neutral grid and requests no tile at all — there is no
 *   default provider for an app to leak its readers' map views to.
 * - **The pin colours.** A `colorField`'s option colours are the author's data
 * colours ([internal ref] A7), mapped value -> fill here so the island carries no
 *   colour arithmetic.
 *
 * The rows themselves are read by the island from the records API, so the pins
 * are exactly the rows that API answers the reader.
 */

import { parseMapTilesEnvConfig } from '@/domain/models/process-env/map-tiles'
import { cn } from '@/presentation/design/class-merge'
import { localizeChildLabel } from './island-child-label'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Tables } from '@/domain/models/app/tables'

interface MapRoot {
  readonly dataSource?: { readonly table?: string }
  readonly locationField?: string
  readonly labelField?: string
  readonly colorField?: string
  readonly onPinClick?: unknown
  readonly cluster?: boolean
  readonly center?: unknown
  readonly zoom?: number
  readonly height?: number
  readonly emptyMessage?: string
}

/** Option value -> declared colour, for the field that colours the pins. */
function optionColors(
  tables: Tables | undefined,
  table: string | undefined,
  field: string | undefined
): Readonly<Record<string, string>> | undefined {
  if (field === undefined) return undefined
  const column = tables
    ?.find((candidate) => candidate.name === table)
    ?.fields.find((candidate) => candidate.name === field) as
    | { readonly options?: readonly { readonly value?: string; readonly color?: string }[] }
    | undefined
  const entries = (column?.options ?? []).flatMap((option) =>
    typeof option.value === 'string' && typeof option.color === 'string'
      ? [[option.value, option.color] as const]
      : []
  )
  return Object.fromEntries(entries)
}

export const mapComponent: ComponentRenderer = ({
  component,
  elementProps,
  tables,
  currentLang,
  languages,
}) => {
  const root = (component ?? {}) as MapRoot
  const tiles = parseMapTilesEnvConfig(process.env)
  const islandProps = {
    dataSource: root.dataSource,
    locationField: root.locationField,
    labelField: root.labelField,
    colorField: root.colorField,
    colors: optionColors(tables, root.dataSource?.table, root.colorField),
    onPinClick: root.onPinClick,
    cluster: root.cluster,
    center: root.center,
    zoom: root.zoom,
    height: root.height,
    ...(root.emptyMessage !== undefined && {
      emptyMessage: localizeChildLabel(root.emptyMessage, currentLang, languages),
    }),
    tiles,
  }
  const authoredLabel = elementProps['aria-label']
  return (
    <section
      id={elementProps['id'] as string | undefined}
      data-testid={elementProps['data-testid'] as string | undefined}
      aria-label={typeof authoredLabel === 'string' ? authoredLabel : 'Map'}
      data-component-type="map"
      data-island="map"
      data-island-props={JSON.stringify(islandProps)}
      className={cn('flex flex-col gap-3', elementProps['className'] as string | undefined)}
      style={{ minHeight: root.height ?? 400 }}
    />
  )
}
