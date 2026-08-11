/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { resolveInterpreterString } from '@/domain/utils/translation-resolver'
import { resolveRecordDrawerFieldProp } from '@/presentation/ui/sections/props/resolve-record-drawer-fields'
import { NavChevronDown } from '@/presentation/utils/recipes/nav-menu-parts'
import {
  buildAlertDialogProps,
  buildDrawerProps,
  buildDropdownMenuProps,
  buildHoverCardProps,
  buildTooltipProps,
} from './island-overlay-props-builders'
import type { ComponentRenderer, DispatchableComponentType } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

/** Stable identity for `style={{ display: 'none' }}` placeholder containers. */
const HIDDEN_STYLE = { display: 'none' } as const

/** Serializes the popover's rendered children into trigger + content HTML.
 * The first child is the trigger (its label drives the trigger button); the
 * remaining children form the floating content panel. */
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

/** Overlay and feedback island components: dialog, alert-dialog, modal, tooltip, popover, drawer, dropdown-menu, context-menu */
export const islandOverlayComponents: Partial<
  Record<DispatchableComponentType, ComponentRenderer>
> = {
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
    // `formRef` dialogs carry their resolved form-body HTML on a render-time
    // `_formRefHtml` field (stamped by `expandFormRefs` in the page filter
    // pipeline). When present it forms the modal body; otherwise the body is
    // built from the dialog's nested children. The two are mutually exclusive
    // in practice (the schema doc-comment forbids mixing them).
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
    // `tooltipContent`/`floatingSide`/`tooltipDelay` are normally top-level
    // component fields, but some authoring paths (esp. the theming regression
    // fixtures) plumb them through `props`. Read component-first, fall back to
    // rawProps so both shapes work. The first child becomes the trigger; its
    // id drives the hover target and remaining content lives in childrenHtml.
    const props = buildTooltipProps(rawProps, elementProps, component, renderedChildren)
    return (
      <div
        data-island="tooltip"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <span>{/* Trigger child rendered inline after hydration */}</span>
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
      // `floatingSide`/`floatingAlign` are top-level component fields, not props.
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

  // `record-drawer` — record-detail/edit drawer specialization
  //. `id`, `dataSource`,
  // `recordFields`, and `canEdit` are SCHEMA top-level fields (siblings of
  // `props`), read from `component`. The drawer starts CLOSED (hidden) and is
  // opened by the data-table's `sovrium:open-drawer` dispatch; the island then
  // fetches the record and renders the schema-derived form.
  'record-drawer': ({ rawProps, elementProps, component, tables, languages, currentLang }) => {
    const comp = (component ?? {}) as Record<string, unknown>
    // CAP-2: `props.title` supplies the surface's accessible NAME; the default
    // is an INTERPRETER string resolved against the active language (English
    // default, French built-in, author override wins) rather than a French
    // literal served to apps of every language. `role` selects `dialog`
    // (default) | `region`.
    const title =
      (rawProps?.['title'] as string | undefined) ??
      resolveInterpreterString('recordDrawer.title', currentLang, languages)
    const role = comp['role'] === 'region' ? 'region' : 'dialog'
    // `dataSource` is discriminated: `{ table }` (DB-table fetch + PATCH) OR
    // `{ system }` (CAP-2 system DETAIL-endpoint binding — READ-ONLY). The island
    // branches on which key is present; a system source forces `canEdit` off.
    const dataSource = comp['dataSource'] as
      { readonly table?: string; readonly system?: unknown } | undefined
    const props = {
      id: comp['id'] as string | undefined,
      title,
      role,
      table: dataSource?.table,
      system: dataSource?.system,
      // `recordFields` is OPTIONAL: omitting it DERIVES one control per declared
      // field of the bound table (the "one component serves every table"
      // contract). Before this, the missing list defaulted to empty and the
      // drawer opened as a shell with nothing but a save button.
      recordFields: resolveRecordDrawerFieldProp(comp['recordFields'], component, tables),
      // CAP-1: footer actions fire against the loaded record at click time.
      actions: comp['actions'],
      canEdit: dataSource?.system === undefined && comp['canEdit'] !== false,
      // Interpreter-provided control labels, resolved server-side so author
      // `languages.translations` overrides apply (the island cannot see them).
      saveLabel: resolveInterpreterString('recordDrawer.save', currentLang, languages),
      closeLabel: resolveInterpreterString('recordDrawer.close', currentLang, languages),
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

  'dropdown-menu': ({ rawProps, elementProps, component, languages, currentLang }) => {
    // Schema-level field lookup + `$t:` token resolution live in
    // buildDropdownMenuProps (island-overlay-props-builders.ts).
    const props = buildDropdownMenuProps(rawProps, elementProps, component, {
      currentLang,
      languages,
    })
    // [internal ref]: the pre-hydration SSR trigger carries the
    // authored `props.className` (when present) so a styled CTA does not flash
    // from an unstyled placeholder to the styled trigger on hydration.
    const authoredClassName = elementProps['className'] as string | undefined
    return (
      <div
        data-island="dropdown-menu"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        {/* [internal ref]: the label trigger carries a chevron in
            the SSR placeholder too (identical to the hydrated menu-island) so
            the affordance is stable across hydration — no new indicator flashes
            in. A `dropdown-menu` always has a `triggerLabel`. */}
        <button
          type="button"
          disabled
          id={elementProps.id as string | undefined}
          // Leading `group` mirrors the hydrated menu-island trigger so the shared
          // chevron's `group-data-[popup-open]:rotate-180` is wired identically
          // across SSR ↔ hydration. Inert on the SSR
          // placeholder (a disabled button never opens), but keeps the class list
          // consistent so nothing re-wires on hydration.
          className={`group ${authoredClassName ?? 'rounded-md border px-3 py-2 text-sm'}`}
        >
          <span>{props.triggerLabel}</span>
          <NavChevronDown />
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
        {/* Context menu trigger is the child area */}
      </div>
    )
  },
}
