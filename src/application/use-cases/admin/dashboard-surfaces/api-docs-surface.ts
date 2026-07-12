/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

export interface ApiDocsOptions {
  readonly canEdit: boolean
  readonly appName?: string
  readonly appVersion?: string
  readonly publishedSnapshot: Readonly<Record<string, unknown>>
}

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

function codeBlock(content: string, language: string, testid?: string): Component {
  return {
    type: 'code',
    props: {
      language,
      ...(testid !== undefined && { 'data-testid': testid }),
    },
    content,
  } as unknown as Component
}

function keyValueRow(label: string, value: string): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-1' },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-xs uppercase' },
        content: label,
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground text-sm' },
        content: value,
      },
    ],
  } as unknown as Component
}

function intro(): Component {
  return {
    type: 'text',
    element: 'p',
    props: { className: 'text-foreground-subtle max-w-2xl text-sm' },
    content:
      'Votre application expose une API REST générée à partir de sa configuration. ' +
      'Chaque table devient un jeu de points d’accès CRUD. Voici l’essentiel pour ' +
      'commencer, et la référence interactive complète.',
  } as unknown as Component
}

function endpointCard(): Component {
  return card([
    sectionLabel('Accès'),
    keyValueRow('URL de base', '<adresse de votre instance>/api'),
    keyValueRow(
      'Authentification',
      'Session Better Auth (cookie de connexion). Une requête envoyée depuis ce navigateur, ' +
        'connecté en tant qu’administrateur, est authentifiée automatiquement.'
    ),
  ])
}

function exampleTables(app: App): ReadonlyArray<{ readonly name: string }> {
  return (app.tables ?? []).slice(0, 4)
}

function firstTableName(app: App): string {
  return exampleTables(app)[0]?.name ?? '{table}'
}

function httpExample(app: App): string {
  const tables = exampleTables(app)
  const lines =
    tables.length > 0
      ? tables
          .map((table) => `GET  /api/tables/${table.name}/records      # Lister « ${table.name} »`)
          .join('\n')
      : 'GET  /api/tables/{table}/records      # Lister les enregistrements d’une table'
  const createExample = `POST /api/tables/${firstTableName(app)}/records      # Créer un enregistrement`
  return `${lines}\n${createExample}`
}

function curlExample(app: App): string {
  const table = firstTableName(app)
  return (
    `# Lister « ${table} » (la session admin de ce navigateur authentifie l’appel)\n` +
    `curl '<adresse de votre instance>/api/tables/${table}/records' \\\n` +
    `  --header 'Accept: application/json' \\\n` +
    `  --cookie "$SOVRIUM_SESSION"`
  )
}

function jsExample(app: App): string {
  const table = firstTableName(app)
  return (
    `// Lister « ${table} » depuis ce navigateur (le cookie de session est inclus)\n` +
    `const res = await fetch('/api/tables/${table}/records', {\n` +
    `  headers: { Accept: 'application/json' },\n` +
    `  credentials: 'include',\n` +
    `})\n` +
    `const { records } = await res.json()`
  )
}

function exampleTab(label: string, body: Component): Component {
  return {
    type: 'tab-panel',
    content: { label },
    children: [body],
  } as unknown as Component
}

function examplesCard(app: App): Component {
  return card([
    sectionLabel('Exemples de requêtes'),
    {
      type: 'tabs',
      defaultTab: 'http',
      props: { 'aria-label': 'Exemples de requêtes', className: 'flex flex-col gap-3' },
      children: [
        {
          type: 'tab-panel',
          props: { id: 'http' },
          content: { label: 'HTTP' },
          children: [codeBlock(httpExample(app), 'http', 'api-docs-examples')],
        } as unknown as Component,
        exampleTab('cURL', codeBlock(curlExample(app), 'bash')),
        exampleTab('JavaScript', codeBlock(jsExample(app), 'javascript')),
      ],
    } as unknown as Component,
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-xs' },
      content:
        'Le verbe et le chemin suffisent ; la référence interactive détaille les paramètres, ' +
        'les corps de requête et les réponses pour chaque point d’accès.',
    } as unknown as Component,
  ])
}

function createUserExample(): string {
  return (
    '# POST /api/auth/admin/create-user — créer un compte (remplace le formulaire retiré)\n' +
    "curl -X POST '<adresse de votre instance>/api/auth/admin/create-user' \\\n" +
    "  --header 'Content-Type: application/json' \\\n" +
    '  --cookie "$SOVRIUM_SESSION" \\\n' +
    "  --data '{\n" +
    '    "email": "personne@exemple.com",\n' +
    '    "password": "MotDePasseFort123!",\n' +
    '    "role": "member"\n' +
    "  }'"
  )
}

function createUserCard(): Component {
  return card([
    sectionLabel('Créer un utilisateur'),
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-sm' },
      content:
        'La création de compte n’a plus de formulaire dans le tableau de bord : ' +
        'elle passe par l’API admin de Better Auth (ou le serveur MCP). Un mot de ' +
        'passe fort est requis ; la personne le réinitialise ensuite.',
    } as unknown as Component,
    codeBlock(createUserExample(), 'bash', 'api-docs-create-user'),
  ])
}

function scalarCard(): Component {
  return card([
    sectionLabel('Référence interactive'),
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-sm' },
      content:
        'Parcourez chaque point d’accès, testez des requêtes et lisez les schémas dans ' +
        'la référence interactive (Scalar).',
    } as unknown as Component,
    {
      type: 'link',
      props: {
        href: '/api/scalar',
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-testid': 'api-docs-scalar-link',
        className:
          'bg-primary text-primary-fg inline-flex w-fit items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90',
      },
      content: 'Ouvrir la référence interactive',
    } as unknown as Component,
  ])
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
        content: 'API',
      },
      intro(),
    ],
  } as unknown as Component
}

function apiDocsBody(app: App): ReadonlyArray<Component> {
  return [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex max-w-3xl flex-col gap-6' },
      children: [header(), endpointCard(), examplesCard(app), createUserCard(), scalarCard()],
    } as unknown as Component,
  ]
}

export function buildApiDocsPage(title: string, operatorApp: App, options: ApiDocsOptions): Page {
  const { canEdit, appName, appVersion, publishedSnapshot } = options
  return {
    id: 'dashboard-api-docs',
    name: 'dashboard-api-docs',
    path: '/api',
    meta: { title },
    components: wrapInShell(apiDocsBody(operatorApp), {
      canEdit,
      appName,
      appVersion,
      breadcrumb: [homeCrumb(appName), { label: 'API' }],
      publishedSnapshot,
    }),
  } as Page
}
