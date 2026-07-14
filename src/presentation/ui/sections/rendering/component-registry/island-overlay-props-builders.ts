/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

export function pickAlertField(
  comp: Record<string, unknown>,
  rawProps: Record<string, unknown> | undefined,
  key: string,
  fallback?: unknown
): unknown {
  return comp[key] ?? rawProps?.[key] ?? fallback
}

export function pickCompField<T>(
  comp: Record<string, unknown> | undefined,
  rawProps: Record<string, unknown> | undefined,
  key: string
): T | undefined {
  return (comp?.[key] as T | undefined) ?? (rawProps?.[key] as T | undefined)
}

export function resolveUploadActionUrl(uploadAction: unknown): string | undefined {
  if (typeof uploadAction === 'string') return uploadAction
  if (uploadAction && typeof uploadAction === 'object') {
    const { url } = uploadAction as { readonly url?: unknown }
    if (typeof url === 'string') return url
  }
  return undefined
}

export function buildAlertDialogProps(
  rawProps: Record<string, unknown> | undefined,
  elementProps: Record<string, unknown>,
  component: Component | undefined
) {
  const comp = (component ?? {}) as Record<string, unknown>
  const contentText = typeof comp['content'] === 'string' ? (comp['content'] as string) : undefined
  return {
    title: rawProps?.['title'],
    description: contentText ?? rawProps?.['description'],
    cancelLabel: pickAlertField(comp, rawProps, 'cancelLabel', 'Cancel'),
    confirmLabel: pickAlertField(comp, rawProps, 'confirmLabel', 'Continue'),
    variant: rawProps?.['variant'] ?? 'default',
    action: comp['action'] ?? rawProps?.['action'],
    className: elementProps['className'],
    id: elementProps['id'],
    'data-testid': elementProps['data-testid'],
  }
}

export function buildTooltipProps(
  rawProps: Record<string, unknown> | undefined,
  elementProps: Record<string, unknown>,
  component: Component | undefined,
  renderedChildren: readonly ReactElement[]
) {
  const comp = component as Record<string, unknown> | undefined
  const compChildren = comp?.['children'] as
    readonly { props?: Record<string, unknown> }[] | undefined
  const triggerProps = compChildren?.[0]?.props
  const childrenHtml = renderedChildren.map((c) => renderToStaticMarkup(c)).join('')
  return {
    tooltipContent: pickCompField<string>(comp, rawProps, 'tooltipContent'),
    floatingSide: pickCompField<string>(comp, rawProps, 'floatingSide'),
    tooltipDelay: pickCompField<number>(comp, rawProps, 'tooltipDelay'),
    triggerId: triggerProps?.['id'] as string | undefined,
    childrenHtml,
    className: elementProps['className'],
    id: elementProps['id'],
    'data-testid': elementProps['data-testid'],
  }
}

export function buildHoverCardProps(
  rawProps: Record<string, unknown> | undefined,
  elementProps: Record<string, unknown>,
  component: Component | undefined,
  renderedChildren: readonly ReactElement[]
) {
  const comp = component as Record<string, unknown> | undefined
  const compChildren = comp?.['children'] as
    readonly { props?: Record<string, unknown>; content?: unknown }[] | undefined
  const triggerDef = compChildren?.[0]
  const triggerProps = triggerDef?.props
  const triggerHtml =
    renderedChildren.length > 0 ? renderToStaticMarkup(renderedChildren[0]!) : undefined
  const triggerLabel = typeof triggerDef?.content === 'string' ? triggerDef.content : undefined
  const contentChildren = renderedChildren.slice(1)
  const childrenHtml = contentChildren.map((c) => renderToStaticMarkup(c)).join('')
  return {
    floatingSide: pickCompField<string>(comp, rawProps, 'floatingSide'),
    floatingAlign: pickCompField<string>(comp, rawProps, 'floatingAlign'),
    openDelay: pickCompField<number>(comp, rawProps, 'openDelay'),
    closeDelay: pickCompField<number>(comp, rawProps, 'closeDelay'),
    triggerHtml,
    triggerLabel,
    triggerId: triggerProps?.['id'] as string | undefined,
    childrenHtml,
    className: elementProps['className'],
    id: elementProps['id'],
    'data-testid': elementProps['data-testid'],
  }
}

export function buildDrawerProps(
  rawProps: Record<string, unknown> | undefined,
  elementProps: Record<string, unknown>,
  component: Component | undefined,
  renderedChildren: readonly ReactElement[]
) {
  const comp = component as Record<string, unknown> | undefined
  const childrenHtml = renderedChildren.map((c) => renderToStaticMarkup(c)).join('')
  const dispatchedById = rawProps?.['_openDrawerDispatchedById']
  const defaultOpen = typeof dispatchedById === 'string' ? false : undefined
  const topLevelId = typeof comp?.['id'] === 'string' ? (comp['id'] as string) : undefined
  const resolvedId = topLevelId ?? (elementProps['id'] as string | undefined)
  return {
    title: rawProps?.['title'],
    description: pickCompField<string>(comp, rawProps, 'description'),
    drawerSide: pickCompField<string>(comp, rawProps, 'drawerSide'),
    drawerSize: pickCompField<string>(comp, rawProps, 'drawerSize'),
    childrenHtml,
    ...(defaultOpen !== undefined ? { defaultOpen } : {}),
    className: elementProps['className'],
    id: resolvedId,
    'data-testid': elementProps['data-testid'],
  }
}
