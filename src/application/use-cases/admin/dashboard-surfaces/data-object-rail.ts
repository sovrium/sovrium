/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared layout primitives for the Data-tab object-scoped pages
 * ([internal ref] — Records / Runs / Submissions).
 *
 * Pass 1 items 1.5a + 1.5c removed the duplicate in-pane object picker rail: the
 * authoritative object list is the sidebar's auto-expanded Application disclosure
 *, so the right-pane rail was a redundant second copy. A bare
 * object-page destination now 302-REDIRECTS to its first object
 * ({@link firstObjectRedirect}), and the selected object's runtime-data island
 * mounts FULL-WIDTH. This module therefore exposes only the page intro + the
 * whole-page empty state (the zero-objects case); the rail / two-pane / pick
 * prompt helpers were retired with the in-pane rail.
 *
 * It is pure (config → `Component` tree) with no React and no I/O — the layer
 * both use-cases and the renderer share.
 */

import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import type { DataShellOptions } from './data-landing-surface'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * A redirect signal an object-page surface builder returns instead of a `Page`
 * when a bare object-page path (`/_admin/{page}`, no object selected) has ≥1
 * declared object: the dashboard route handler turns it into a 302 to the first
 * object's sub-path (`/_admin/{page}/{first}`). Mirrors the `{ redirect }` shape
 * the page-render result already carries, so the same 302 channel handles both
 * (Pass 1 item 1.5a).
 */
export interface DataObjectRedirect {
  readonly redirect: string
}

/**
 * Build the first-object redirect for a bare object-page route: a 302 target at
 * `/_admin/{page}/{first}`. Returned by the object-page surface builders when the
 * route selects no object but the operator declares ≥1 (Pass 1 item 1.5a).
 */
export function firstObjectRedirect(page: string, firstObject: string): DataObjectRedirect {
  return { redirect: `/_admin/${page}/${firstObject}` }
}

/**
 * Narrow a resolved Data surface to the {@link DataObjectRedirect} signal (so the
 * route handler can turn it into a 302 before rendering a page). A `Page` carries
 * a `components` field; the redirect carries only `redirect`.
 */
export function isDataObjectRedirect(value: object): value is DataObjectRedirect {
  return 'redirect' in value && !('components' in value)
}

/**
 * The page intro block shared by every object-scoped Data page: a heading + an
 * orienting one-liner. The three pages (Records / Runs /
 * Submissions) differ only in their `heading` + `blurb` copy, so the wrapping
 * container/heading/paragraph structure lives here once.
 */
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

/**
 * Mount the selected object's runtime-data body FULL-WIDTH (Pass 1 item 1.5c).
 *
 * After the in-pane rail was removed, the object-scoped Data pages render the
 * selected object's island directly in the content column — no left rail, no
 * two-pane split, no "pick an object" prompt. The authoritative object picker is
 * the sidebar's auto-expanded Application disclosure. This wraps the body in a
 * `min-w-0` flex column so a wide grid / inbox / file browser fills the column.
 */
export function dataObjectFullWidth(body: Component): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex min-w-0 flex-1 flex-col pt-2' },
    children: [body],
  } as unknown as Component
}

/**
 * The whole-page empty state when the operator declares NO objects for this page
 * (no tables / automations / forms). An honest "nothing to show" with what to do
 * next, replacing the rail entirely (there is nothing to pick).
 */
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
        props: { className: 'text-foreground-subtle mt-1 max-w-md text-sm italic' },
        content: hint,
      },
    ],
  } as unknown as Component
}

/**
 * The fixed identity of an object-scoped Data page: its `/_admin/{key}` URL
 * segment, the human label shown in the breadcrumb + meta title (e.g. `tables` →
 * `Records`), and the page intro block. The three object-scoped surfaces
 * (Records / Submissions / Files) differ only in these three values +
 * their body, so the `Page` scaffold (id / path / meta / shell / breadcrumb) is
 * assembled once in {@link objectScopedPage}.
 */
export interface ObjectScopedPageSpec {
  /** The `/_admin/{key}` URL segment (also the `dashboard-data-{key}` id stem). */
  readonly key: string
  /** The human label for the breadcrumb crumb + the meta title. */
  readonly label: string
  /** The page intro block (heading + orienting one-liner) — surface-specific copy. */
  readonly intro: Component
}

/**
 * Assemble an object-scoped Data `Page` (id / path / meta / shell / breadcrumb)
 * around a body — the `selected`-aware scaffold shared verbatim by the three
 * object-page surfaces (tables / forms / buckets). A bare page (`selected ===
 * undefined`) carries the directory id / path / title; a selected object suffixes
 * each with its slug and appends the object crumb. Only the intro copy, the
 * label, and the URL key vary per surface ({@link ObjectScopedPageSpec}); the body
 * is built by the caller (each surface mounts a different island).
 */
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
      title: selected ? `Sovrium — Data · ${label} · ${selected}` : `Sovrium — Data · ${label}`,
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
