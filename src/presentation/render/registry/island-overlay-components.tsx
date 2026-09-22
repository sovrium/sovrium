/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  MENU_TRIGGER_CONTENT_CLASSES,
  MENU_TRIGGER_LAYOUT_CLASSES,
  NavChevronDown,
} from '@/presentation/design/nav-menu-parts'
import { isZeroJsDialog } from '@/presentation/render/registry/island-component-types'
import {
  isOpenSpecimen,
  renderOpenMenuPopup,
} from '@/presentation/render/resolve/open-specimen-markup'
import { computeLinkClasses } from '../../design/interactive-content-default-classes'
import { renderEnhancerDrivenDialog } from './enhancer-driven-dialog'
import {
  buildAlertDialogProps,
  buildDialogProps,
  buildDrawerProps,
  buildDropdownMenuProps,
  buildHoverCardProps,
  buildTooltipProps,
  withResolvedMenuItemIcons,
} from './island-overlay-props-builders'
import { renderRecordBoundDrawer } from './record-bound-drawer'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

/** Stable identity for `style={{ display: 'none' }}` placeholder containers. */
const HIDDEN_STYLE = { display: 'none' } as const

/**
 * The design-system console's `open` state cell for a menu, or `undefined`
 *.
 *
 * A Base UI menu cannot be reached inline — `Menu.Portal` is not optional, and
 * `usePopoverPortalContext` throws without it — so the popup body was factored
 * into `MenuPopupBody`, which this draws through the island-SSR bridge.
 *
 * Extracted from the renderer rather than written inline for the ordinary
 * reason: the dispatch below already reads six fields off two prop bags, and a
 * third branch inside it crosses the complexity ceiling. Returning the markup
 * (never a boolean beside it) is also what keeps ONE source of truth for
 * "is this drawn open" at the call site.
 */
const drawnOpenMenu = (
  rawProps: Record<string, unknown> | undefined,
  props: { readonly menuItems?: unknown; readonly popupVariant?: unknown }
): string | undefined =>
  isOpenSpecimen(rawProps)
    ? renderOpenMenuPopup({
        menuItems: Array.isArray(props.menuItems) ? props.menuItems : [],
        surface: props.popupVariant === 'inverted' ? 'inverted' : 'default',
      })
    : undefined

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
  dialog: ({ rawProps, elementProps, renderedChildren, component }) => {
    // `formRef` dialogs carry their resolved form-body HTML on a render-time
    // `_formRefHtml` field (stamped by `expandFormRefs` in the page filter
    // pipeline). When present it forms the modal body; otherwise the body is
    // built from the dialog's nested children. The two are mutually exclusive
    // in practice (the schema doc-comment forbids mixing them).
    const formRefHtml = (component as { readonly _formRefHtml?: unknown } | undefined)?._formRefHtml

    // `hydrate: false` — the zero-JS overlay this type absorbed from `modal`.
    // An EXPLICIT opt-in, never inferred: what it gives up (focus containment,
    // focus restoration) is governed by no other field, so any inference would
    // strip it from a future dialog with no config diff to show for it.
    if (
      isZeroJsDialog((component ?? {}) as { readonly hydrate?: unknown; readonly type?: string })
    ) {
      return renderEnhancerDrivenDialog(rawProps, elementProps, renderedChildren, formRefHtml)
    }

    const childrenHtml =
      typeof formRefHtml === 'string'
        ? formRefHtml
        : renderedChildren.map((c) => renderToStaticMarkup(c)).join('')
    const propsJson = JSON.stringify(buildDialogProps(rawProps, elementProps, childrenHtml))

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
          className={computeButtonDefaultClasses({ variant: 'secondary', state: 'disabled' })}
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
          className={computeLinkClasses()}
        >
          {triggerLabel}
        </a>
      </div>
    )
  },

  // ONE component type, TWO islands, chosen by SHAPE.
  //
  // `record-drawer` was retired into `drawer`: it was a drawer bound to one
  // record, and its `dataSource` / `recordFields` / `actions` / `role` keys are
  // now keys on `drawer`. The two ISLANDS stayed, because they are genuinely
  // different programs — one renders authored children, the other fetches a
  // record and derives a form — and folding them would put the record-fetching
  // code on every page carrying a plain drawer.
  //
  // The split is on `dataSource`, which is the only thing that makes a drawer
  // record-bound, and it is decided HERE rather than in the registry because
  // the registry is keyed by `type` and both shapes are now one type. The
  // record island keeps its own registry key and its PRIORITY loading: its
  // `sovrium:open-drawer` listener has to be wired before a data-table row
  // click can fire, and that dispatch arrives synchronously.
  drawer: (context) => {
    const { rawProps, elementProps, component, renderedChildren } = context
    if ((component as { dataSource?: unknown } | undefined)?.dataSource !== undefined) {
      return renderRecordBoundDrawer(context)
    }
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

  'dropdown-menu': ({
    rawProps,
    elementProps,
    component,
    languages,
    currentLang,
    renderedChildren,
  }) => {
    // Schema-level field lookup + `$t:` token resolution live in
    // buildDropdownMenuProps (island-overlay-props-builders.ts). Children, when
    // the author declared them, are the trigger's COMPOSED content.
    const props = buildDropdownMenuProps(rawProps, elementProps, component, {
      currentLang,
      languages,
      renderedChildren,
    })
    // [internal ref]: the pre-hydration SSR trigger carries the
    // authored `props.className` (when present) so a styled CTA does not flash
    // from an unstyled placeholder to the styled trigger on hydration.
    const authoredClassName = elementProps['className'] as string | undefined
    const openMenuHtml = drawnOpenMenu(rawProps, props)
    const depicted = openMenuHtml !== undefined
    return (
      <div
        data-island={depicted ? undefined : 'dropdown-menu'}
        data-island-props={depicted ? undefined : JSON.stringify(props)}
        data-specimen-open={depicted ? 'true' : undefined}
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
          aria-label={props.triggerAriaLabel}
          // A drawn-open trigger reports itself open, so the trigger and the
          // panel below it tell one story rather than two.
          aria-expanded={depicted ? 'true' : undefined}
          aria-haspopup={depicted ? 'menu' : undefined}
          className={`group ${MENU_TRIGGER_LAYOUT_CLASSES} ${authoredClassName ?? 'text-md rounded-md border px-3 py-2'}`}
        >
          {props.triggerChildrenHtml === undefined ? (
            // A session-bound label ships EMPTY and carries its template, so the
            // pre-hydration button never paints a raw `$session.` token and the
            // served bytes name nobody.
            <span data-session-template={props.triggerLabelTemplate}>{props.triggerLabel}</span>
          ) : (
            <span
              className={MENU_TRIGGER_CONTENT_CLASSES}
              // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- preserves the composed SSR trigger on initial paint
              dangerouslySetInnerHTML={{ __html: props.triggerChildrenHtml }}
            />
          )}
          <NavChevronDown />
        </button>
        {openMenuHtml !== undefined && (
          // Markup from the island's own `MenuPopupBody`, produced server-side
          // from decoded config — see `presentation/rendering/open-specimen-markup.ts`.
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- one-time SSR markup emission
          <div dangerouslySetInnerHTML={{ __html: openMenuHtml }} />
        )}
      </div>
    )
  },

  'context-menu': ({ rawProps, elementProps, component }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const menuItems = withResolvedMenuItemIcons(c['menuItems'] ?? rawProps?.menuItems)
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
