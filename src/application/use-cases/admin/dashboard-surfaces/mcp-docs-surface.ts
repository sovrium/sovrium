/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import {
  listMcpTools,
  type McpToolCategory,
  type McpToolListing,
} from '@/domain/utils/admin-mcp-tool-listing'
import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

export interface McpDocsOptions {
  readonly canEdit: boolean
  readonly appName?: string
  readonly appVersion?: string
  readonly publishedSnapshot: Readonly<Record<string, unknown>>
}

function header(): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      {
        type: 'text',
        element: 'h1',
        props: { className: 'text-2xl font-semibold tracking-tight' },
        content: 'MCP',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle max-w-2xl text-sm' },
        content:
          'Connectez votre IA (Claude, Cursor…) à cette instance via MCP. Émettez un ' +
          'identifiant, collez la configuration dans votre client, et votre IA accède aux ' +
          'outils ci-dessous — lecture et écriture de données, actions et automatisations.',
      },
    ],
  } as unknown as Component
}

const MCP_ENDPOINT_PLACEHOLDER = '<adresse de votre instance>/mcp'

function sectionLabel(content: string): Component {
  return {
    type: 'text',
    element: 'h2',
    props: { className: 'text-foreground-subtle text-xs font-medium tracking-wide uppercase' },
    content,
  } as unknown as Component
}

function card(children: ReadonlyArray<Component>): Component {
  return {
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border bg-background-raised flex flex-col gap-3 rounded-lg border p-5',
    },
    children,
  } as unknown as Component
}

function endpointCard(): Component {
  return card([
    sectionLabel('Point d’accès MCP'),
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-sm' },
      content:
        'Votre serveur MCP est monté à ce chemin. Remplacez le libellé par l’adresse ' +
        'réelle de votre instance dans la configuration de votre client IA.',
    } as unknown as Component,
    {
      type: 'code',
      props: { language: 'http', 'data-testid': 'mcp-connect-endpoint' },
      content: MCP_ENDPOINT_PLACEHOLDER,
    } as unknown as Component,
  ])
}

function registerExample(): string {
  return (
    '# POST /api/auth/oauth2/register — émettre un identifiant MCP (RFC 7591, inscription ouverte)\n' +
    "curl -X POST '<adresse de votre instance>/api/auth/oauth2/register' \\\n" +
    "  --header 'Content-Type: application/json' \\\n" +
    "  --data '{\n" +
    '    "client_name": "Sovrium MCP — Claude",\n' +
    '    "redirect_uris": ["<adresse de votre instance>/oauth/callback"],\n' +
    '    "grant_types": ["authorization_code", "refresh_token"],\n' +
    '    "token_endpoint_auth_method": "client_secret_post"\n' +
    "  }'"
  )
}

function registerCard(): Component {
  return card([
    sectionLabel('Émettre un identifiant'),
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-sm' },
      content:
        'Enregistrez un client MCP pour obtenir un identifiant. La réponse renvoie un ' +
        '« client_id » et un « client_secret » à coller dans votre client IA.',
    } as unknown as Component,
    {
      type: 'code',
      props: { language: 'bash', 'data-testid': 'mcp-connect-register' },
      content: registerExample(),
    } as unknown as Component,
  ])
}

const REFERENCE_WIRING = JSON.stringify(
  {
    mcpServers: {
      sovrium: {
        url: MCP_ENDPOINT_PLACEHOLDER,
        transport: 'http',
      },
    },
  },
  null,
  2
)

function referenceConfigCard(): Component {
  return card([
    sectionLabel('Configuration de référence'),
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-sm' },
      content:
        'La forme de la configuration MCP à coller dans votre client, avec le point ' +
        'd’accès à renseigner par l’adresse de votre instance.',
    } as unknown as Component,
    {
      type: 'code',
      props: { language: 'json', 'data-testid': 'mcp-reference-config' },
      content: REFERENCE_WIRING,
    } as unknown as Component,
  ])
}

const CATEGORY_LABELS: Readonly<Record<McpToolCategory, string>> = {
  table: 'Données',
  action: 'Actions',
  automation: 'Automatisations',
}

const CATEGORY_ORDER: ReadonlyArray<McpToolCategory> = ['table', 'action', 'automation']

function toolRow(tool: McpToolListing): Component {
  return {
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border flex flex-col gap-0.5 border-t px-3 py-2 first:border-t-0',
    },
    children: [
      {
        type: 'text',
        element: 'code',
        props: { className: 'text-foreground font-mono text-xs' },
        content: tool.name,
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-xs' },
        content: tool.description,
      },
    ],
  } as unknown as Component
}

function categoryGroup(category: McpToolCategory, tools: ReadonlyArray<McpToolListing>): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-sm font-medium' },
        content: CATEGORY_LABELS[category],
      },
      {
        type: 'container',
        element: 'div',
        props: {
          className: 'border-border bg-background-raised overflow-hidden rounded-lg border',
        },
        children: tools.map((tool) => toolRow(tool)),
      },
    ],
  } as unknown as Component
}

function noToolsState(): Component {
  return {
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border bg-background-raised flex flex-col items-start gap-2 rounded-lg border p-5',
    },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground text-sm font-medium' },
        content: 'Aucun outil exposé pour le moment',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle max-w-xl text-sm leading-relaxed' },
        content:
          'Ajoutez « aiAccess » à une table, une action ou une automatisation manuelle dans ' +
          'la configuration de votre application pour l’exposer ici comme outil MCP.',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle max-w-xl font-serif text-sm italic' },
        content: 'Vous décidez de ce que votre IA peut faire — rien n’est exposé par défaut.',
      },
    ],
  } as unknown as Component
}

function toolsSection(app: App): Component {
  const tools = listMcpTools(app)
  if (tools.length === 0) {
    return {
      type: 'container',
      element: 'section',
      props: {
        'aria-label': 'Outils MCP disponibles',
        'data-testid': 'mcp-tools-section',
        className: 'flex flex-col gap-3',
      },
      children: [sectionLabel('Outils disponibles'), noToolsState()],
    } as unknown as Component
  }
  const groups = CATEGORY_ORDER.flatMap((category) => {
    const inCategory = tools.filter((tool) => tool.category === category)
    return inCategory.length > 0 ? [categoryGroup(category, inCategory)] : []
  })
  return {
    type: 'container',
    element: 'section',
    props: {
      'aria-label': 'Outils MCP disponibles',
      'data-testid': 'mcp-tools-section',
      className: 'flex flex-col gap-4',
    },
    children: [sectionLabel('Outils disponibles'), ...groups],
  } as unknown as Component
}

function mcpDocsBody(app: App): ReadonlyArray<Component> {
  return [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex max-w-3xl flex-col gap-8' },
      children: [
        header(),
        endpointCard(),
        registerCard(),
        referenceConfigCard(),
        toolsSection(app),
      ],
    } as unknown as Component,
  ]
}

export function buildMcpDocsPage(title: string, operatorApp: App, options: McpDocsOptions): Page {
  const { canEdit, appName, appVersion, publishedSnapshot } = options
  return {
    id: 'dashboard-mcp-docs',
    name: 'dashboard-mcp-docs',
    path: '/mcp',
    meta: { title },
    components: wrapInShell(mcpDocsBody(operatorApp), {
      canEdit,
      appName,
      appVersion,
      breadcrumb: [homeCrumb(appName), { label: 'MCP' }],
      publishedSnapshot,
    }),
  } as Page
}
