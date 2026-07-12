/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { automationRunsBody } from './automation-runs-surface'
import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import { dataPageEmptyState, dataPageIntro } from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

type OperatorAutomation = App['automations'] extends ReadonlyArray<infer T> | undefined ? T : never

function automationNames(automations: ReadonlyArray<OperatorAutomation>): ReadonlyArray<string> {
  return automations.flatMap((automation): ReadonlyArray<string> => {
    const { name } = automation as { readonly name?: unknown }
    return typeof name === 'string' ? [name] : []
  })
}

function intro(): Component {
  return dataPageIntro(
    'Exécutions',
    'Suivez l’historique des exécutions de vos automatisations. Par défaut, toutes les exécutions sont listées — filtrez par automatisation ou par statut, puis ouvrez une exécution pour inspecter chaque étape.'
  )
}

function noAutomationsBody(): Component {
  return dataPageEmptyState(
    'Aucune automatisation',
    'Cette application ne déclare encore aucune automatisation. Ajoutez-en une depuis l’onglet Config pour voir ses exécutions apparaître ici.',
    'Pas encore d’automatisation — donc rien à exécuter, pour l’instant.'
  )
}

export function buildDataAutomationsPage(
  operatorApp: App,
  _object: string | undefined,
  options: DataShellOptions
): Page {
  const automations = (operatorApp.automations ?? []) as ReadonlyArray<OperatorAutomation>
  const names = automationNames(automations)
  const body = names.length === 0 ? noAutomationsBody() : automationRunsBody(names)

  return {
    id: 'dashboard-data-automations',
    name: 'dashboard-data-automations',
    path: '/automations',
    meta: { title: 'Sovrium — Données · Exécutions' },
    components: wrapInShell([intro(), body], {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [
        homeCrumb(options.appName),
        { label: 'Exécutions', href: '/_admin/automations' },
      ],
      publishedSnapshot: options.publishedSnapshot ?? {},
    }),
  } as Page
}
