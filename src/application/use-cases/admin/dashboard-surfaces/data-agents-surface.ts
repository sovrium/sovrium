/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import { dataPageEmptyState, dataPageIntro } from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

type OperatorAgent = App['agents'] extends ReadonlyArray<infer T> | undefined ? T : never

function agentNames(agents: ReadonlyArray<OperatorAgent>): ReadonlyArray<string> {
  return agents.flatMap((agent): ReadonlyArray<string> => {
    const { name } = agent as { readonly name?: unknown }
    return typeof name === 'string' ? [name] : []
  })
}

function intro(): Component {
  return dataPageIntro(
    'Conversations',
    'Consultez l’historique des conversations entre vos utilisateurs et vos agents IA. Par défaut, toutes les conversations sont listées — filtrez par agent, puis ouvrez-en une pour lire le fil de messages.'
  )
}

function conversationViewerBody(names: ReadonlyArray<string>): Component {
  return {
    type: 'container',
    element: 'div',
    props: {
      className: 'flex flex-col gap-4',
      'data-island': 'admin-agent-conversations',
      'data-island-props': JSON.stringify({ agentNames: names }),
    },
    children: [
      {
        type: 'container',
        element: 'section',
        props: { 'aria-label': 'Conversations', className: 'flex flex-col gap-2' },
        children: [
          {
            type: 'text',
            element: 'p',
            props: { className: 'text-foreground-subtle px-1 py-2 text-sm' },
            content: 'Chargement des conversations…',
          },
        ],
      },
    ],
  } as unknown as Component
}

export function buildDataAgentsPage(
  operatorApp: App,
  _object: string | undefined,
  options: DataShellOptions
): Page {
  const agents = (operatorApp.agents ?? []) as ReadonlyArray<OperatorAgent>
  const names = agentNames(agents)
  const body =
    names.length === 0
      ? dataPageEmptyState(
          'Aucun agent',
          'Cette application ne déclare aucun agent IA. Déclarez un agent dans la configuration (app.agents) pour qu’il apparaisse ici avec ses conversations.',
          'La configuration vit dans le code — les conversations suivront.'
        )
      : conversationViewerBody(names)

  return {
    id: 'dashboard-data-agents',
    name: 'dashboard-data-agents',
    path: '/agents',
    meta: { title: 'Sovrium — Données · Conversations' },
    components: wrapInShell([intro(), body], {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [homeCrumb(options.appName), { label: 'Conversations', href: '/_admin/agents' }],
      publishedSnapshot: options.publishedSnapshot ?? {},
    }),
  } as Page
}
