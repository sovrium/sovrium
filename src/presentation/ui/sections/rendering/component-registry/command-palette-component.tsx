/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { COMMAND_PALETTE_RUNTIME } from './command-palette-runtime'
import type { ComponentDispatchConfig, ComponentRenderer } from '../component-dispatch-config'
import type { ReactElement } from 'react'

const OVERLAY_STYLE = {
  display: 'none',
  position: 'fixed' as const,
  inset: 0,
  zIndex: 1000,
  alignItems: 'flex-start' as const,
  justifyContent: 'center' as const,
  paddingTop: '12vh',
  background: 'rgba(0,0,0,0.4)',
}

const PANEL_STYLE = {
  width: '100%',
  maxWidth: '36rem',
  background: '#ffffff',
  borderRadius: '0.5rem',
  boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
  overflow: 'hidden' as const,
}

const INPUT_STYLE = {
  width: '100%',
  padding: '0.75rem 1rem',
  border: 'none',
  borderBottom: '1px solid #e5e7eb',
  fontSize: '1rem',
  outline: 'none' as const,
}

const RESULTS_STYLE = {
  maxHeight: '24rem',
  overflowY: 'auto' as const,
  padding: '0.5rem',
}

const CREATE_DIALOG_STYLE = {
  display: 'none',
  position: 'fixed' as const,
  inset: 0,
  zIndex: 1001,
  alignItems: 'flex-start' as const,
  justifyContent: 'center' as const,
  paddingTop: '12vh',
  background: 'rgba(0,0,0,0.4)',
}

const CREATE_PANEL_STYLE = {
  width: '100%',
  maxWidth: '32rem',
  background: '#ffffff',
  borderRadius: '0.5rem',
  boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
  padding: '1.25rem',
}

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

const renderCreateRecordDialog = (table: PaletteTable): ReactElement => {
  const fields = (table.fields ?? []).filter((field) => TEXT_FIELD_TYPES.has(field.type))
  return (
    <div
      key={table.name}
      data-create-record-dialog={table.name}
      data-open="false"
      role="dialog"
      aria-modal="true"
      aria-label={`New ${table.name} record`}
      style={CREATE_DIALOG_STYLE}
    >
      <div style={CREATE_PANEL_STYLE}>
        <h2>{`New ${table.name} record`}</h2>
        <form
          method="post"
          action={`/api/tables/${table.name}/records`}
        >
          {fields.map((field) => (
            <div key={field.name}>
              <label htmlFor={`create-${table.name}-${field.name}`}>{field.name}</label>
              <input
                id={`create-${table.name}-${field.name}`}
                name={field.name}
                type="text"
              />
            </div>
          ))}
          <div>
            <button type="submit">Create</button>
            <button
              type="button"
              data-create-record-close="true"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export const commandPaletteComponent: ComponentRenderer = (
  config: ComponentDispatchConfig
): ReactElement => {
  const tables = ((config.tables ?? []) as ReadonlyArray<PaletteTable>).map((table) => ({
    name: table.name,
    fields: (table.fields ?? []).map((field) => ({ name: field.name, type: field.type })),
  }))
  const componentProps = (config.component?.props ?? {}) as { readonly pages?: PalettePage[] }
  const pages = Array.isArray(componentProps.pages) ? componentProps.pages : []
  const paletteConfig = {
    tables: tables.map((table) => ({ name: table.name })),
    pages: pages.map((page) => ({ name: page.name, path: page.path, title: page.title })),
  }
  const paletteConfigJson = JSON.stringify(paletteConfig).replace(/</g, '\\u003c')
  return (
    <>
      <div
        data-command-palette="true"
        data-testid="palette-backdrop"
        data-open="false"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={OVERLAY_STYLE}
      >
        <div style={PANEL_STYLE}>
          <input
            data-command-palette-input="true"
            type="search"
            role="searchbox"
            aria-label="Search"
            placeholder="Search…"
            style={INPUT_STYLE}
          />
          <div
            data-command-palette-results="true"
            style={RESULTS_STYLE}
          />
        </div>
      </div>
      {tables.map((table) => renderCreateRecordDialog(table))}
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
