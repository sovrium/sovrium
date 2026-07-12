/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import type { DataShellOptions } from './data-landing-surface'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

export interface DataObjectRedirect {
  readonly redirect: string
}

export function firstObjectRedirect(page: string, firstObject: string): DataObjectRedirect {
  return { redirect: `/_admin/${page}/${firstObject}` }
}

export function isDataObjectRedirect(value: object): value is DataObjectRedirect {
  return 'redirect' in value && !('components' in value)
}

export function dataPageIntro(heading: string, blurb: string): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2 pt-4' },
    children: [
      {
        type: 'text',
        element: 'h2',
        props: { className: 'text-2xl font-semibold tracking-tight' },
        content: heading,
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-muted-foreground max-w-2xl' },
        content: blurb,
      },
    ],
  } as unknown as Component
}

export function dataObjectFullWidth(body: Component): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex min-w-0 flex-1 flex-col pt-2' },
    children: [body],
  } as unknown as Component
}

export function dataPageEmptyState(title: string, body: string, hint: string): Component {
  return {
    type: 'container',
    element: 'section',
    props: {
      'aria-label': title,
      className:
        'border-border bg-background-raised flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg border p-10 text-center',
    },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground text-sm font-medium' },
        content: title,
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-muted max-w-md text-sm leading-relaxed' },
        content: body,
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle mt-1 max-w-md font-serif text-sm italic' },
        content: hint,
      },
    ],
  } as unknown as Component
}

export interface ObjectScopedPageSpec {
  readonly key: string
  readonly label: string
  readonly intro: Component
}

export function objectScopedPage(
  spec: ObjectScopedPageSpec,
  selected: string | undefined,
  body: Component,
  options: DataShellOptions
): Page {
  const { key, label, intro } = spec
  const idName = selected ? `dashboard-data-${key}-${selected}` : `dashboard-data-${key}`
  return {
    id: idName,
    name: idName,
    path: selected ? `/${key}/${selected}` : `/${key}`,
    meta: {
      title: selected
        ? `Sovrium — Données · ${label} · ${selected}`
        : `Sovrium — Données · ${label}`,
    },
    components: wrapInShell([intro, body], {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [
        homeCrumb(options.appName),
        { label, href: `/_admin/${key}` },
        ...(selected ? [{ label: selected }] : []),
      ],
      publishedSnapshot: options.publishedSnapshot ?? {},
    }),
  } as Page
}
