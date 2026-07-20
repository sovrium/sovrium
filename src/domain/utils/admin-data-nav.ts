/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export type DataNavSection = 'app' | 'system'

export const DATA_NAV_SECTION_LABELS: Readonly<Record<DataNavSection, string>> = {
  app: 'Application',
  system: 'Système',
}

export const DATA_NAV_SECTION_ORDER: ReadonlyArray<DataNavSection> = ['app', 'system']

export interface DataNavPage {
  readonly key: string
  readonly label: string
  readonly href: string
  readonly section: DataNavSection
  readonly ready: boolean
}

export const DATA_NAV_PAGES: ReadonlyArray<DataNavPage> = [
  { key: 'tables', label: 'Enregistrements', href: '/_admin/tables', section: 'app', ready: true },
  { key: 'forms', label: 'Soumissions', href: '/_admin/forms', section: 'app', ready: true },
  { key: 'buckets', label: 'Fichiers', href: '/_admin/buckets', section: 'app', ready: true },
  {
    key: 'automations',
    label: 'Exécutions',
    href: '/_admin/automations',
    section: 'system',
    ready: true,
  },
  { key: 'agents', label: 'Conversations', href: '/_admin/agents', section: 'system', ready: true },
  { key: 'users', label: 'Utilisateurs', href: '/_admin/users', section: 'system', ready: true },
  {
    key: 'connections',
    label: 'Connexions',
    href: '/_admin/connections',
    section: 'system',
    ready: true,
  },
  { key: 'pages', label: 'Statistiques', href: '/_admin/pages', section: 'system', ready: true },
]

export const DATA_NAV_ROOT = '/_admin'

export const ADMIN_HOME_PATH = '/_admin'

export const OPERATOR_CONSOLE_APP_NAME = 'sovrium-admin-dashboard'

export function isOperatorConsoleApp(app: { readonly name?: string }): boolean {
  return app.name === OPERATOR_CONSOLE_APP_NAME
}

export function brandLabel(appName: string | undefined): string {
  if (appName === undefined || appName.trim().length === 0) return 'Console'
  return appName
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const READY_PAGES: ReadonlyMap<string, string> = new Map(
  DATA_NAV_PAGES.filter((page) => page.ready).map((page) => [page.key, page.label])
)

export function isReadyDataPage(page: string): boolean {
  return READY_PAGES.has(page)
}

export function readyDataPageLabel(page: string): string | undefined {
  return READY_PAGES.get(page)
}
