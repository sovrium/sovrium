/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface DeveloperNavPage {
  readonly key: string
  readonly label: string
  readonly href: string
}

export const DEVELOPER_NAV_PAGES: ReadonlyArray<DeveloperNavPage> = [
  { key: 'api', label: 'API', href: '/_admin/api' },
  { key: 'mcp', label: 'MCP', href: '/_admin/mcp' },
]

export const DEVELOPER_NAV_SECTION_LABEL = 'Développeurs'
