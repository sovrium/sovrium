/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { evaluateFormAccess } from '@/domain/models/shared/form-access-flow'
import { collectFromComponentTree } from '@/presentation/rendering/component-walker'
import { isComponentHiddenForSession } from '@/presentation/rendering/visibility-filter'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { SessionInfo } from '@/domain/types/session-info'

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
