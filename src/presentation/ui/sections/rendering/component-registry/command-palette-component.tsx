/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { COMMAND_PALETTE_RUNTIME } from './command-palette-runtime'
import type { ComponentDispatchConfig, ComponentRenderer } from '../component-dispatch-config'
import type { ReactElement } from 'react'

const TEXT_FIELD_TYPES = new Set([
  'single-line-text',
  'long-text',
  'rich-text',
  'email',
  'url',
  'number',
  'phone-number',
])

interface PaletteTable {
  readonly name: string
  readonly fields?: ReadonlyArray<{ readonly name: string; readonly type: string }>
}

interface PalettePage {
  readonly name: string
  readonly path: string
  readonly title: string
}

function renderAdminCommandPalette(): ReactElement {
  const adminConfigJson = JSON.stringify({ adminSearch: true })
  return (
    <>
      <script
        type="application/json"
        data-command-palette-config="true"
        dangerouslySetInnerHTML={{ __html: adminConfigJson }}
      />
      <div
        data-island="admin-search-palette"
        data-island-props="{}"
        className="hidden"
      >
        <span className="sr-only" />
      </div>
    </>
  )
}

export const commandPaletteComponent: ComponentRenderer = (
  config: ComponentDispatchConfig
): ReactElement => {
  const adminSearch = (config.component?.props as { readonly adminSearch?: boolean } | undefined)
    ?.adminSearch
  if (adminSearch === true) {
    return renderAdminCommandPalette()
  }

  const tables = ((config.tables ?? []) as ReadonlyArray<PaletteTable>).map((table) => ({
    name: table.name,
    fields: (table.fields ?? [])
      .filter((field) => TEXT_FIELD_TYPES.has(field.type))
      .map((field) => ({ name: field.name })),
  }))
  const componentProps = (config.component?.props ?? {}) as { readonly pages?: PalettePage[] }
  const pages = Array.isArray(componentProps.pages) ? componentProps.pages : []
  const paletteConfig = {
    tables: tables.map((table) => ({ name: table.name, fields: table.fields })),
    pages: pages.map((page) => ({ name: page.name, path: page.path, title: page.title })),
  }
  const paletteConfigJson = JSON.stringify(paletteConfig).replace(/</g, '\\u003c')
  return (
    <>
      <script
        type="application/json"
        data-command-palette-config="true"
        dangerouslySetInnerHTML={{ __html: paletteConfigJson }}
      />
      <script
        dangerouslySetInnerHTML={{ __html: COMMAND_PALETTE_RUNTIME }}
      />
    </>
  )
}
