/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import {
  buildAlertDialogProps,
  buildDrawerProps,
  buildHoverCardProps,
  buildTooltipProps,
  pickCompField,
} from './island-overlay-props-builders'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

const HIDDEN_STYLE = { display: 'none' } as const

function splitPopoverChildren(
  component: Component | undefined,
  renderedChildren: readonly ReactElement[]
): { readonly triggerLabel: string; readonly triggerId?: string; readonly childrenHtml: string } {
  const childDefs = (component as { children?: readonly { props?: Record<string, unknown> }[] })
    ?.children
  const triggerProps = childDefs?.[0]?.props
  const triggerLabel =
    (triggerProps?.['label'] as string | undefined) ??
    (triggerProps?.['text'] as string | undefined) ??
    'Open'
  const triggerId = triggerProps?.['id'] as string | undefined
  const contentChildren = renderedChildren.slice(1)
  const childrenHtml = contentChildren.map((c) => renderToStaticMarkup(c)).join('')
  return { triggerLabel, triggerId, childrenHtml }
}

export const islandOverlayComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  modal: ({ rawProps, elementProps }) => {
    const id = rawProps?.id as string | undefined
    const title = rawProps?.title as string | undefined

    return (
      <div
        id={id}
        data-testid={elementProps['data-testid'] as string | undefined}
        data-modal-container
        style={HIDDEN_STYLE}
      >
        <div
          className="bg-foreground/50 fixed inset-0 z-50 flex items-center justify-center p-4"
          data-backdrop
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={id ? `modal-title-${id}` : undefined}
            tabIndex={-1}
            className="bg-background-overlay text-foreground relative w-full max-w-md rounded-lg p-6 shadow-xl"
          >
            {title && (
              <h2
                id={id ? `modal-title-${id}` : undefined}
                className="text-foreground mb-4 text-xl font-semibold"
              >
                {title}
              </h2>
            )}
            <button
              type="button"
              aria-label="Close modal"
              data-modal-close
              className="text-foreground-subtle hover:text-foreground-muted absolute top-4 right-4"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    )
  },

  dialog: ({ rawProps, elementProps, renderedChildren, component }) => {
    const formRefHtml = (component as { readonly _formRefHtml?: unknown } | undefined)?._formRefHtml
    const childrenHtml =
      typeof formRefHtml === 'string'
        ? formRefHtml
        : renderedChildren.map((c) => renderToStaticMarkup(c)).join('')
    const dialogProps = {
      title: rawProps?.title,
      description: rawProps?.description,
      cancelLabel: rawProps?.cancelLabel,
      confirmLabel: rawProps?.confirmLabel,
      variant: rawProps?.variant,
      childrenHtml,
      className: elementProps.className,
      id: elementProps.id,
      'data-testid': elementProps['data-testid'],
    }
    const propsJson = JSON.stringify(dialogProps)

    return (
      <div
        data-island="dialog"
        data-island-props={propsJson}
        data-testid={elementProps['data-testid'] as string | undefined}
        style={HIDDEN_STYLE}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={(rawProps?.title as string) ?? 'Dialog'}
        >
          <p>Loading...</p>
        </div>
      </div>
    )
  },

  'alert-dialog': ({ rawProps, elementProps, component }) => {
    const dialogProps = buildAlertDialogProps(rawProps, elementProps, component)
    const propsJson = JSON.stringify(dialogProps)

    return (
      <div
        data-island="alert-dialog"
        data-island-props={propsJson}
        data-testid={elementProps['data-testid'] as string | undefined}
        style={HIDDEN_STYLE}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={(rawProps?.title as string) ?? 'Alert'}
        >
          <p>Loading...</p>
        </div>
      </div>
    )
  },

  tooltip: ({ rawProps, elementProps, component, renderedChildren }) => {
    const props = buildTooltipProps(rawProps, elementProps, component, renderedChildren)
    return (
      <div
        data-island="tooltip"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <span>{}</span>
      </div>
    )
  },

  popover: ({ rawProps, elementProps, component, renderedChildren }) => {
    const { triggerLabel, triggerId, childrenHtml } = splitPopoverChildren(
      component,
      renderedChildren
    )
    const comp = component as { floatingSide?: string; floatingAlign?: string } | undefined
    const props = {
      title: rawProps?.title,
      description: rawProps?.description,
      floatingSide: comp?.floatingSide,
      floatingAlign: comp?.floatingAlign,
      triggerLabel,
      triggerId,
      childrenHtml,
      className: elementProps.className,
      id: elementProps.id,
      'data-testid': elementProps['data-testid'],
    }
    return (
      <div
        data-island="popover"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <button
          type="button"
          id={triggerId}
          disabled
          className="rounded-md border px-3 py-2 text-sm"
        >
          {triggerLabel}
        </button>
      </div>
    )
  },

  'hover-card': ({ rawProps, elementProps, component, renderedChildren }) => {
    const props = buildHoverCardProps(rawProps, elementProps, component, renderedChildren)
    const { triggerId } = props
    const triggerLabel = props.triggerLabel ?? 'Hover'
    return (
      <div
        data-island="hover-card"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <a
          id={triggerId}
          href="#"
          className="underline"
        >
          {triggerLabel}
        </a>
      </div>
    )
  },

  drawer: ({ rawProps, elementProps, component, renderedChildren }) => {
    const props = buildDrawerProps(rawProps, elementProps, component, renderedChildren)
    return (
      <div
        data-island="drawer"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
        style={HIDDEN_STYLE}
      >
        <div
          role="dialog"
          aria-label={(rawProps?.title as string) ?? 'Drawer'}
        >
          <p>Loading...</p>
        </div>
      </div>
    )
  },

  'record-drawer': ({ rawProps, elementProps, component }) => {
    const comp = (component ?? {}) as Record<string, unknown>
    const title = (rawProps?.['title'] as string | undefined) ?? "Détail de l'enregistrement"
    const role = comp['role'] === 'region' ? 'region' : 'dialog'
    const dataSource = comp['dataSource'] as
      { readonly table?: string; readonly system?: unknown } | undefined
    const props = {
      id: comp['id'] as string | undefined,
      title,
      role,
      table: dataSource?.table,
      system: dataSource?.system,
      recordFields: comp['recordFields'],
      actions: comp['actions'],
      canEdit: dataSource?.system === undefined && comp['canEdit'] !== false,
    }
    return (
      <div
        data-island="record-drawer"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
        style={HIDDEN_STYLE}
      >
        <div
          role={role}
          aria-label={title}
        >
          <p>Loading...</p>
        </div>
      </div>
    )
  },

  'dropdown-menu': ({ rawProps, elementProps, component }) => {
    const comp = (component ?? {}) as Record<string, unknown>
    const triggerLabelRaw = pickCompField<string>(comp, rawProps, 'triggerLabel')
    const triggerLabel = typeof triggerLabelRaw === 'string' ? triggerLabelRaw : 'Menu'
    const props = {
      menuItems: pickCompField<unknown>(comp, rawProps, 'menuItems'),
      floatingSide: pickCompField<string>(comp, rawProps, 'floatingSide'),
      floatingAlign: pickCompField<string>(comp, rawProps, 'floatingAlign'),
      triggerLabel,
      className: elementProps['className'],
      id: elementProps['id'],
      'data-testid': elementProps['data-testid'],
    }
    return (
      <div
        data-island="dropdown-menu"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <button
          type="button"
          disabled
          id={elementProps.id as string | undefined}
          className="rounded-md border px-3 py-2 text-sm"
        >
          {triggerLabel}
        </button>
      </div>
    )
  },

  'context-menu': ({ rawProps, elementProps, component }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const menuItems = c['menuItems'] ?? rawProps?.menuItems
    const props = {
      menuItems,
      className: elementProps.className,
      id: elementProps.id,
      'data-testid': elementProps['data-testid'],
    }
    return (
      <div
        data-island="context-menu"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        {}
      </div>
    )
  },
}
