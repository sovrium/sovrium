/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { resolveTranslationTokensDeep } from '@/domain/models/app/languages/translation-resolver'
import { resolveLucideIconNode } from '@/presentation/render/elements/lucide-resolver'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

/**
 * Reads a top-level component field, falling back to the same key in
 * `rawProps`, then to the provided default. Used by alert-dialog where
 * `cancelLabel`/`confirmLabel` may appear either at the component level or
 * inside `props` depending on the authoring path.
 */
export function pickAlertField(
  comp: Record<string, unknown>,
  rawProps: Record<string, unknown> | undefined,
  key: string,
  fallback?: unknown
): unknown {
  return comp[key] ?? rawProps?.[key] ?? fallback
}

/** Reads a component-level field first, falling back to `rawProps`. */
export function pickCompField<T>(
  comp: Record<string, unknown> | undefined,
  rawProps: Record<string, unknown> | undefined,
  key: string
): T | undefined {
  return (comp?.[key] as T | undefined) ?? (rawProps?.[key] as T | undefined)
}

/**
 * Resolve a `file-upload` component's `uploadAction` to the multipart POST
 * destination URL. `uploadAction` is either a string URL (the common case) or
 * an `ActionSchema` object whose `url` field carries the destination. Returns
 * `undefined` when no usable URL is present (the basic pick-and-validate variant
 * with no submission target).
 */
export function resolveUploadActionUrl(uploadAction: unknown): string | undefined {
  if (typeof uploadAction === 'string') return uploadAction
  if (uploadAction && typeof uploadAction === 'object') {
    const { url } = uploadAction as { readonly url?: unknown }
    if (typeof url === 'string') return url
  }
  return undefined
}

/**
 * Attaches server-resolved icon GEOMETRY to each menu item that names an icon.
 *
 * `menu-island` used to resolve `item.icon` itself, which meant it imported
 * `lucide-resolver` — a namespace import read through a computed key, so the
 * bundler retained all ~2,000 icons. Measured 2026-09-03: a 668,323-byte chunk
 * (174,296 gzip) statically imported by `menu-island`, `kpi-island` AND
 * `admin-sidebar-island`, the last of which renders no icons at all.
 *
 * Resolving here instead moves that cost to the server, where the icon set is
 * already in the binary, and sends the browser only the handful of `[tag, attrs]`
 * pairs the page actually draws. The `icon` NAME is preserved alongside the
 * geometry — the island still uses it for the `lucide-<name>` class and the
 * `menu-item-icon-<name>` test id.
 *
 * The vocabulary stays open: this resolves whatever name the config gives, so a
 * user config naming any Lucide icon works exactly as before. A name lucide does
 * not know yields no `iconNode`, which the island renders as "no icon" — the
 * same outcome the old client-side resolver produced.
 *
 * Non-array input and non-object entries pass through untouched: `menuItems`
 * arrives from freeform config and this must never be the thing that rejects it.
 */
export function withResolvedMenuItemIcons(menuItems: unknown): unknown {
  if (!Array.isArray(menuItems)) return menuItems
  return menuItems.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const { icon } = item as { readonly icon?: unknown }
    if (typeof icon !== 'string' || icon.length === 0) return item
    const iconNode = resolveLucideIconNode(icon)
    if (iconNode === undefined) return item
    return { ...(item as Record<string, unknown>), iconNode }
  })
}

/** Builds the props payload for the `alert-dialog` island. */
export function buildAlertDialogProps(
  rawProps: Record<string, unknown> | undefined,
  elementProps: Record<string, unknown>,
  component: Component | undefined
) {
  const comp = (component ?? {}) as Record<string, unknown>
  // Prefer top-level `content` (matches authoring convention in specs) and
  // fall back to props.description for the supporting text below the title.
  const contentText = typeof comp['content'] === 'string' ? (comp['content'] as string) : undefined
  // The confirm button's configured automation `action`: a top-level
  // field on the alert-dialog component (sibling of `confirmLabel`), falling
  // back to `rawProps.action`. Passed to the island so confirming DISPATCHES
  // it via the form-action endpoint rather than just closing the dialog.
  return {
    title: rawProps?.['title'],
    description: contentText ?? rawProps?.['description'],
    cancelLabel: pickAlertField(comp, rawProps, 'cancelLabel', 'Cancel'),
    confirmLabel: pickAlertField(comp, rawProps, 'confirmLabel', 'Continue'),
    variant: rawProps?.['variant'] ?? 'default',
    // The island ignores an `undefined` action (confirm just closes), so always
    // include the key rather than a conditional spread — keeps complexity low.
    action: comp['action'] ?? rawProps?.['action'],
    className: elementProps['className'],
    id: elementProps['id'],
    'data-testid': elementProps['data-testid'],
  }
}

/**
 * Builds the props payload for the hydrated `dialog` island.
 *
 * Extracted from the renderer so the per-key `rawProps?.[...]` reads live in one
 * place rather than inflating the renderer's branch count — it now also has to
 * decide between the hydrated island and the `hydrate: false` zero-JS overlay.
 */
export function buildDialogProps(
  rawProps: Record<string, unknown> | undefined,
  elementProps: Record<string, unknown>,
  childrenHtml: string
) {
  return {
    title: rawProps?.['title'],
    description: rawProps?.['description'],
    cancelLabel: rawProps?.['cancelLabel'],
    confirmLabel: rawProps?.['confirmLabel'],
    variant: rawProps?.['variant'],
    childrenHtml,
    className: elementProps['className'],
    id: elementProps['id'],
    'data-testid': elementProps['data-testid'],
  }
}

/** Builds the props payload for the `tooltip` island. */
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

/**
 * Builds the props payload for the `hover-card` island. The first child is
 * the trigger (rendered via `triggerHtml`); the remaining children form the
 * floating content panel (`childrenHtml`). `openDelay`/`closeDelay` and
 * `floatingSide`/`floatingAlign` are top-level component fields.
 */
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

/**
 * Builds the props payload for the `dropdown-menu` island.
 *
 * `triggerLabel` and `menuItems` are SCHEMA top-level fields (siblings of
 * `props`) — same convention as form-control components (see
 * `pickFromComponent` in island-form-components.tsx). Schema-level fields can
 * carry `$t:` tokens; they are resolved against the
 * active language BEFORE serialization into `data-island-props` so hydration
 * keeps the translated strings.
 */
export function buildDropdownMenuProps(
  rawProps: Record<string, unknown> | undefined,
  elementProps: Record<string, unknown>,
  component: Component | undefined,
  ctx: {
    readonly currentLang?: string
    readonly languages?: Languages
    /**
     * The trigger's COMPOSED content, when the author declared children.
     *
     * `dropdown-menu` is a container type and there is no ambiguity about which
     * slot its children fill: the popup is `menuItems`, a structured field of
     * its own, so the only slot left is the affordance that opens it.
     */
    readonly renderedChildren?: readonly ReactElement[]
  }
) {
  const renderedChildren = ctx.renderedChildren ?? []
  const comp = (component ?? {}) as Record<string, unknown>
  const triggerLabelRaw = pickCompField<string>(comp, rawProps, 'triggerLabel')
  const translatedLabel = resolveTranslationTokensDeep(
    typeof triggerLabelRaw === 'string' ? triggerLabelRaw : 'Menu',
    ctx.currentLang,
    ctx.languages
  ) as string
  // A `$session.` token is resolved CLIENT-side, against the caller's own
  // session — never here, because the served bytes are what a cache stores and
  // a cached identity is one user's name served to the next. The template
  // travels so the island can mark its own span; the label ships EMPTY so no
  // reader ever meets the raw token.
  const bound = translatedLabel.includes('$session.')
  const triggerLabel = bound ? '' : translatedLabel
  const triggerChildrenHtml =
    renderedChildren.length > 0
      ? renderedChildren.map((child) => renderToStaticMarkup(child)).join('')
      : undefined
  const menuItems = withResolvedMenuItemIcons(
    resolveTranslationTokensDeep(
      pickCompField<unknown>(comp, rawProps, 'menuItems'),
      ctx.currentLang,
      ctx.languages
    )
  )
  return {
    menuItems,
    floatingSide: pickCompField<string>(comp, rawProps, 'floatingSide'),
    floatingAlign: pickCompField<string>(comp, rawProps, 'floatingAlign'),
    triggerLabel,
    triggerLabelTemplate: bound ? translatedLabel : undefined,
    triggerChildrenHtml,
    // Composing content into a button ordinarily REPLACES its accessible name
    // with that content, so a screen reader would announce the person where the
    // reader needs the control's job. The authored `triggerLabel` survives as
    // the name even once it is no longer the visible text.
    triggerAriaLabel: triggerChildrenHtml === undefined ? undefined : translatedLabel,
    // [internal ref]: dark popup surface for a near-black primary CTA (schema top-level
    // field, sibling of `triggerLabel`). Threaded into `data-island-props` so the
    // hydrated menu-island paints the inverted popup + inverted item tones
    //.
    popupVariant: pickCompField<string>(comp, rawProps, 'popupVariant'),
    // [internal ref]: hover-to-open — a top-level schema
    // field (sibling of `triggerLabel`). Threaded into `data-island-props` so the
    // hydrated menu-island opens the popup on pointer hover in addition to click.
    openOnHover: pickCompField<boolean>(comp, rawProps, 'openOnHover'),
    className: elementProps['className'],
    id: elementProps['id'],
    'data-testid': elementProps['data-testid'],
  }
}

/** Builds the props payload for the `drawer` island. */
export function buildDrawerProps(
  rawProps: Record<string, unknown> | undefined,
  elementProps: Record<string, unknown>,
  component: Component | undefined,
  renderedChildren: readonly ReactElement[]
) {
  const comp = component as Record<string, unknown> | undefined
  const childrenHtml = renderedChildren.map((c) => renderToStaticMarkup(c)).join('')
  // PG-04: if `resolveOpenDrawerDispatches` tagged this drawer with
  // `_openDrawerDispatchedById`, override the default `open=true` so the
  // hydrated island stays closed until the data-table dispatches a
  // `sovrium:open-drawer` CustomEvent.
  const dispatchedById = rawProps?.['_openDrawerDispatchedById']
  const defaultOpen = typeof dispatchedById === 'string' ? false : undefined
  // PG-04: the drawer's `id` lives at the top level of the schema (sibling
  // of `props`/`children`), not inside `props`, so it doesn't reach
  // `elementProps`. Lift it from the component record so the hydrated
  // island can match `sovrium:open-drawer` CustomEvent dispatches against
  // it. Falls back to `elementProps.id` for the legacy `props.id` authoring
  // form preserved by `ComponentPropsSchema`.
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
