/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { evaluateFormAccess } from '@/domain/models/shared/form-access-flow'
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

function collectFormRefsFromNode(node: unknown): readonly string[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => collectFormRefsFromNode(child))
  }
  const ref = readFormRef(node)
  const selfRefs = ref === undefined ? [] : [ref]
  if (typeof node !== 'object' || node === null) return selfRefs
  const { children, component: wrapped } = node as {
    readonly children?: ReadonlyArray<unknown>
    readonly component?: unknown
  }
  const childRefs = children === undefined ? [] : collectFormRefsFromNode(children)
  const wrappedRefs = wrapped === undefined ? [] : collectFormRefsFromNode(wrapped)
  return [...selfRefs, ...childRefs, ...wrappedRefs]
}

function collectFormRefs(components: Page['components']): readonly string[] {
  if (!components) return []
  return collectFormRefsFromNode(components as ReadonlyArray<Component | unknown>)
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
  const refs = collectFormRefs(page.components)
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
