/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export type TabId =
  'runtime' | 'tables' | 'pages' | 'automations' | 'agents' | 'platform' | 'guides' | 'changelog'

export const TAB_ORDER: readonly TabId[] = [
  'runtime',
  'tables',
  'pages',
  'automations',
  'agents',
  'platform',
  'guides',
  'changelog',
]

const TAB_FOR_SECTION: Readonly<Record<string, TabId>> = {
  'get-started': 'runtime',
  operations: 'runtime',
  references: 'runtime',
  project: 'runtime',
  tables: 'tables',
  records: 'tables',
  pages: 'pages',
  forms: 'pages',
  automations: 'automations',
  ai: 'agents',
  'app-schema': 'platform',
  auth: 'platform',
  storage: 'platform',
  search: 'platform',
  guides: 'guides',
  changelog: 'changelog',
}

export const tabOfSection = (name: string | undefined): TabId =>
  (name === undefined ? undefined : TAB_FOR_SECTION[name]) ?? 'runtime'

export const sectionHasTab = (name: string | undefined): boolean =>
  name !== undefined && TAB_FOR_SECTION[name] !== undefined
