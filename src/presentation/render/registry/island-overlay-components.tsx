/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import {
  MENU_TRIGGER_CONTENT_CLASSES,
  MENU_TRIGGER_LAYOUT_CLASSES,
  NavChevronDown,
} from '@/presentation/design/nav-menu-parts'
import {
  computeContextMenuTriggerClasses,
  computeMenuLabelTriggerClasses,
} from '@/presentation/design/navigation-default-classes'
import { isZeroJsDialog } from '@/presentation/render/registry/island-component-types'
import { hostComponentType } from '@/presentation/render/registry/island-host-attributes'
import {
  isOpenSpecimen,
  renderOpenMenuPopup,
} from '@/presentation/render/resolve/open-specimen-markup'
import { computeLinkClasses } from '../../design/interactive-content-default-classes'
import { splitSlots } from '../elements/slot-children'
import { substitutePropsTranslationTokens } from '../i18n/translation-handler'
import { renderEnhancerDrivenDialog } from './enhancer-driven-dialog'
import { isExportedNode, renderExportOnlyMarkup } from './export-only-markup'
import {
  buildAlertDialogProps,
  buildDialogProps,
  buildDrawerProps,
  buildDropdownMenuProps,
  buildHoverCardProps,
  buildTooltipProps,
  overlayCloseLabel,
  withResolvedMenuItemIcons,
} from './island-overlay-props-builders'
import { withOpenSpecimen } from './open-overlay-components'
import { buildPopoverProps } from './popover-props-builder'
import { renderRecordBoundDrawer } from './record-bound-drawer'
import type {
  ComponentDispatchConfig,
  ComponentRenderer,
  DispatchableComponentType,
} from './component-dispatch-config'
import type { ReactElement } from 'react'

/** Rendered components as one HTML string, for an island to inject. */
const toHtml = (nodes: readonly ReactElement[] | undefined): string =>
  (nodes ?? []).map((node) => renderToStaticMarkup(node)).join('')

/** Stable identity for `style={{ display: 'none' }}` placeholder containers. */
const HIDDEN_STYLE = { display: 'none' } as const

/**
 * The `title` and `description` an overlay declares beside its `type`, which
 * the props spelling of the same keys overrides.
 */
const headingOf = (component: unknown): Readonly<Record<string, string>> =>
  Object.fromEntries(
    (['title', 'description'] as const).flatMap((key) => {
      const value = (component as Readonly<Record<string, unknown>> | undefined)?.[key]
      return typeof value === 'string' ? [[key, value]] : []
    })
  )

/**
 * The overlay's authored props with their `$t:` keys resolved. `rawProps` is the
 * config verbatim — only `elementProps` passes through the translation pass — so
 * a `title` / `description` read from it reached the island payload and the
 * pre-hydration accessible name as the raw key.
 */
const withTranslatedProps = <T extends ComponentDispatchConfig>(context: T): T => ({
  ...context,
  rawProps: substitutePropsTranslationTokens(
    { ...headingOf(context.component), ...context.rawProps },
    context.currentLang,
    context.languages
  ),
})

/**
 * The design-system console's `open` state cell for a menu, or `undefined`.
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

/** Overlay and feedback island components: dialog, alert-dialog, modal, tooltip, popover, drawer, dropdown-menu, context-menu */
export const islandOverlayComponents: Partial<
  Record<DispatchableComponentType, ComponentRenderer>
> = {
  dialog: withOpenSpecimen('dialog', (context) => {
    const translated = withTranslatedProps(context)
    const { rawProps, elementProps, renderedChildren, component } = translated
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
      return renderEnhancerDrivenDialog(translated, formRefHtml)
    }

    const slots = splitSlots('dialog', component, renderedChildren)
    const childrenHtml = typeof formRefHtml === 'string' ? formRefHtml : toHtml(slots['$children'])
    const footerHtml = toHtml(slots['footer'])
    const propsJson = JSON.stringify({
      ...buildDialogProps(rawProps, elementProps, childrenHtml, context),
      closeLabel: overlayCloseLabel(context),
      ...(footerHtml === '' ? {} : { footerHtml }),
      ...((component as { readonly showCloseButton?: unknown } | undefined)?.showCloseButton ===
      false
        ? { showCloseButton: false }
        : {}),
    })

    return (
      <div
        data-island="dialog"
        data-component-type={hostComponentType(elementProps)}
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
        {renderExportOnlyMarkup(childrenHtml + footerHtml, isExportedNode(component))}
      </div>
    )
  }),

  'alert-dialog': withOpenSpecimen('alert-dialog', (context) => {
    const { rawProps, elementProps } = withTranslatedProps(context)
    const propsJson = JSON.stringify(buildAlertDialogProps(rawProps, elementProps, context))

    return (
      <div
        data-island="alert-dialog"
        data-component-type={hostComponentType(elementProps)}
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
  }),

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
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <span>{/* Trigger child rendered inline after hydration */}</span>
      </div>
    )
  },

  popover: ({ rawProps, elementProps, component, renderedChildren }) => {
    const props = buildPopoverProps(rawProps, elementProps, component, renderedChildren)
    return (
      <div
        data-island="popover"
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        {/* Inert until the island mounts, and drawn as the button it will be. */}
        <button
          type="button"
          id={props.triggerId}
          disabled
          className={props.className}
        >
          {props.triggerLabel}
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
        data-component-type={hostComponentType(elementProps)}
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
  // A drawer bound to one record is a `drawer` with `dataSource` /
  // `recordFields` / `actions` / `role` keys, not a type of its own. There are
  // still two ISLANDS, because they are genuinely different programs — one renders authored children, the other fetches a
  // record and derives a form — and folding them would put the record-fetching
  // code on every page carrying a plain drawer.
  //
  // The split is on `dataSource`, which is the only thing that makes a drawer
  // record-bound, and it is decided HERE rather than in the registry because
  // the registry is keyed by `type` and both shapes are now one type. The
  // record island keeps its own registry key and its PRIORITY loading: its
  // `sovrium:open-drawer` listener has to be wired before a data-table row
  // click can fire, and that dispatch arrives synchronously.
  sheet: withOpenSpecimen('sheet', (untranslated) => {
    const context = withTranslatedProps(untranslated)
    const { rawProps, elementProps, component, renderedChildren } = context
    if ((component as { dataSource?: unknown } | undefined)?.dataSource !== undefined) {
      return renderRecordBoundDrawer(context)
    }
    const props = buildDrawerProps(rawProps, elementProps, component, renderedChildren)
    return (
      <div
        data-island="sheet"
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify({ ...props, closeLabel: overlayCloseLabel(context) })}
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
  }),

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
    // The pre-hydration SSR trigger carries the
    // authored `props.className` (when present) so a styled CTA does not flash
    // from an unstyled placeholder to the styled trigger on hydration.
    const authoredClassName = elementProps['className'] as string | undefined
    const openMenuHtml = drawnOpenMenu(rawProps, props)
    const depicted = openMenuHtml !== undefined
    return (
      <div
        data-island={depicted ? undefined : 'dropdown-menu'}
        data-component-type={hostComponentType(elementProps)}
        data-island-props={depicted ? undefined : JSON.stringify(props)}
        data-specimen-open={depicted ? 'true' : undefined}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        {/* The label trigger carries a chevron in
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
          className={
            props.triggerChildrenHtml === undefined
              ? computeMenuLabelTriggerClasses(authoredClassName)
              : `group ${MENU_TRIGGER_LAYOUT_CLASSES} ${authoredClassName ?? 'text-md rounded-md border px-3 py-2'}`
          }
        >
          {props.triggerChildrenHtml === undefined ? (
            // A session-bound label ships EMPTY and carries its template, so the
            // pre-hydration button never paints a raw `$session.` token and the
            // served bytes name nobody.
            <span data-session-template={props.triggerLabelTemplate}>{props.triggerLabel}</span>
          ) : (
            <span
              className={MENU_TRIGGER_CONTENT_CLASSES}
              // eslint-disable-next-line sovrium/require-sanitized-html -- server-rendered markup: renderToStaticMarkup output, which escapes every text and attribute value
              dangerouslySetInnerHTML={{ __html: props.triggerChildrenHtml }}
            />
          )}
          <NavChevronDown />
        </button>
        {openMenuHtml !== undefined && (
          // Markup from the island's own `MenuPopupBody`, produced server-side
          // from decoded config — see `presentation/rendering/open-specimen-markup.ts`.
          // eslint-disable-next-line sovrium/require-sanitized-html -- server-rendered markup: renderToStaticMarkup output, which escapes every text and attribute value
          <div dangerouslySetInnerHTML={{ __html: openMenuHtml }} />
        )}
      </div>
    )
  },

  // The region the menu is attached to IS the author's children: they paint
  // before hydration exactly as they will after, and the island only adds the
  // right-click / long-press behaviour over them.
  'context-menu': ({ rawProps, elementProps, component, renderedChildren }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const menuItems = withResolvedMenuItemIcons(c['menuItems'] ?? rawProps?.menuItems)
    const childrenHtml = toHtml(renderedChildren)
    const className = computeContextMenuTriggerClasses(elementProps.className as string | undefined)
    const props = {
      menuItems,
      childrenHtml,
      className: elementProps.className,
      id: elementProps.id,
    }
    return (
      <div
        data-island="context-menu"
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div
          data-slot="context-menu-trigger"
          id={elementProps.id as string | undefined}
          className={className}
          // eslint-disable-next-line sovrium/require-sanitized-html -- server-rendered markup: renderToStaticMarkup output, which escapes every text and attribute value
          dangerouslySetInnerHTML={{ __html: childrenHtml }}
        />
      </div>
    )
  },
}
