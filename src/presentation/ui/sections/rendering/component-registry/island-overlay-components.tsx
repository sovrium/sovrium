/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

const HIDDEN_STYLE = { display: 'none' } as const

function buildAlertDialogProps(
  rawProps: Record<string, unknown> | undefined,
  elementProps: Record<string, unknown>
) {
  return {
    title: rawProps?.title,
    description: rawProps?.description,
    cancelLabel: rawProps?.cancelLabel ?? 'Cancel',
    confirmLabel: rawProps?.confirmLabel ?? 'Continue',
    variant: rawProps?.variant ?? 'default',
    className: elementProps.className,
    id: elementProps.id,
    'data-testid': elementProps['data-testid'],
  }
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

  dialog: ({ rawProps, elementProps }) => {
    const dialogProps = {
      title: rawProps?.title,
      description: rawProps?.description,
      cancelLabel: rawProps?.cancelLabel,
      confirmLabel: rawProps?.confirmLabel,
      variant: rawProps?.variant,
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

  'alert-dialog': ({ rawProps, elementProps }) => {
    const dialogProps = buildAlertDialogProps(rawProps, elementProps)
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

  tooltip: ({ rawProps, elementProps }) => {
    const props = {
      tooltipContent: rawProps?.tooltipContent,
      floatingSide: rawProps?.floatingSide,
      tooltipDelay: rawProps?.tooltipDelay,
      className: elementProps.className,
      id: elementProps.id,
      'data-testid': elementProps['data-testid'],
    }
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

  popover: ({ rawProps, elementProps }) => {
    const props = {
      title: rawProps?.title,
      description: rawProps?.description,
      floatingSide: rawProps?.floatingSide,
      floatingAlign: rawProps?.floatingAlign,
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
          disabled
          className="rounded-md border px-3 py-2 text-sm"
        >
          Open
        </button>
      </div>
    )
  },

  drawer: ({ rawProps, elementProps }) => {
    const props = {
      title: rawProps?.title,
      description: rawProps?.description,
      drawerSide: rawProps?.drawerSide,
      drawerSize: rawProps?.drawerSize,
      className: elementProps.className,
      id: elementProps.id,
      'data-testid': elementProps['data-testid'],
    }
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

  'dropdown-menu': ({ rawProps, elementProps }) => {
    const props = {
      menuItems: rawProps?.menuItems,
      floatingSide: rawProps?.floatingSide,
      floatingAlign: rawProps?.floatingAlign,
      className: elementProps.className,
      id: elementProps.id,
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
          className="rounded-md border px-3 py-2 text-sm"
        >
          Menu
        </button>
      </div>
    )
  },

  'context-menu': ({ rawProps, elementProps }) => {
    const props = {
      menuItems: rawProps?.menuItems,
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
