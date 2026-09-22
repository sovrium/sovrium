/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Walks a page's components looking for `{ type: 'form', formRef: <name> }`
 * embeddings and evaluates each referenced form's `access.require` against
 * the request session. Returns `'denied'` if ANY embedded `formRef` fails
 * its access gate, `'allow'` otherwise.
 *
 * The page-level `access` gate (in `domain/services/page-access-check`) has
 * already run by the time this check fires; this layer composes the form
 * gate on top so that a `member` request to a page embedding an admin-only
 * `formRef` 404s the entire page (S1 anti-enumeration — the existence of
 * the role-restricted form must not be inferable from the page render).
 *
 * Lives next to `form-ref-resolver` so the schema-walking shape stays in
 * sync; consumed by `render-page.tsx` immediately after the page-access
 * decision is made.
 */

import { evaluateFormAccess } from '@/domain/models/app/forms/form-access-flow'
import { collectFromComponentTree } from '@/presentation/render/resolve/component-walker'
import { isComponentHiddenForSession } from '@/presentation/render/resolve/visibility-filter'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

function readFormRef(node: unknown): string | undefined {
  if (typeof node !== 'object' || node === null) return undefined
  const obj = node as { readonly type?: unknown; readonly formRef?: unknown }
  if (obj.type !== 'form') return undefined
  return typeof obj.formRef === 'string' ? obj.formRef : undefined
}

function collectFormRefs(
  components: Page['components'],
  session: SessionInfo | undefined
): readonly string[] {
  if (!components) return []
  return collectFromComponentTree(components as ReadonlyArray<Component | unknown>, {
    visit: (node) => {
      const ref = readFormRef(node)
      return ref === undefined ? [] : [ref]
    },
    // A subtree hidden from this session by a when/roles visibility config is
    // not part of the page for that session: its formRefs must not 404 the page
    // (the submit endpoint still enforces each form's access independently).
    shouldSkip: (node) => isComponentHiddenForSession(node, session),
  })
}

function toFormAccessSession(
  session: SessionInfo | undefined
):
  | { readonly userId: string; readonly role: string; readonly groups?: readonly string[] }
  | undefined {
  if (session === undefined) return undefined
  return {
    userId: session.userId,
    role: session.role,
    ...(session.groups !== undefined ? { groups: session.groups } : {}),
  }
}

/**
 * Evaluate every embedded `formRef`'s access gate against the session.
 *
 * Returns:
 *  - `'allow'` when every referenced form (or no formRef at all) permits the
 *    session (or there's no session and the form is public).
 *  - `'denied'` when ANY form denies — the caller MUST 404 the page so the
 *    role-restricted form is not enumerable via "page renders / doesn't".
 *
 * Forms whose `access.require === 'authenticated'` and the session is
 * anonymous return `'denied'` (a `formRef` to an authenticated-only form
 * embedded in a public page should hide the page entirely from anonymous
 * visitors). Tests today only exercise the role-gated path, but the
 * anti-enumeration rationale applies equally to "log-in required" forms.
 */
export function evaluateEmbeddedFormRefsAccess(
  app: Readonly<App>,
  page: Readonly<Page>,
  session: SessionInfo | undefined
): 'allow' | 'denied' {
  const refs = collectFormRefs(page.components, session)
  if (refs.length === 0) return 'allow'
  const formSession = toFormAccessSession(session)
  const anyDenied = refs.some((ref) => {
    const form = app.forms?.find((f) => f.name === ref)
    if (form === undefined) return false
    const decision = evaluateFormAccess(form.access?.require, formSession)
    return decision.kind !== 'allow'
  })
  return anyDenied ? 'denied' : 'allow'
}
