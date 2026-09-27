/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The recipes the APPLICATION-UI blocks share — the tighter padding of a
 * working screen, inline text runs, controls whose behaviour the operator
 * wires. The marketing recipes live in `block-kit.ts`; this file exists beside
 * it because one kit for both would pass the 400-line file cap.
 *
 * Same contract as the marketing kit: every helper returns a plain node built
 * from existing component types and theme-token utilities, so the fragment a
 * block writes is config an operator could have typed by hand.
 */

import type { BlockNode } from './block-kit'

/** The padded region an application block sits in — tighter than a marketing section. */
export const appRegion = (children: readonly BlockNode[], extra = ''): BlockNode => ({
  type: 'container',
  props: { className: `w-full px-4 py-6 sm:px-10 sm:py-8 ${extra}`.trim() },
  children,
})

/** A single run of inline text with its own classes. */
export const span = (content: string, className: string): BlockNode => ({
  type: 'text',
  element: 'span',
  props: { className },
  content,
})

/** A paragraph with its own classes. */
export const para = (content: string, className: string): BlockNode => ({
  type: 'text',
  element: 'p',
  props: { className },
  content,
})

/** The heading of an application screen, at the size a working screen wants. */
export const appTitle = (content: string, element = 'h1', extra = ''): BlockNode => ({
  type: 'text',
  element,
  props: { className: `text-3xl font-semibold tracking-tight text-foreground ${extra}`.trim() },
  content,
})

/** A section or card heading inside an application screen. */
export const appHeading = (content: string, element = 'h2', extra = ''): BlockNode => ({
  type: 'text',
  element,
  props: { className: `text-xl font-semibold text-foreground ${extra}`.trim() },
  content,
})

/** A `button` that runs no action yet — the operator wires its `action`. */
export const plainButton = (
  label: string,
  variant: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' = 'default',
  extra: Readonly<Record<string, unknown>> = {}
): BlockNode => ({ type: 'button', variant, label, ...extra })

/** An icon-only link with an accessible name. */
export const iconLink = (iconName: string, label: string, href: string): BlockNode => ({
  type: 'link',
  props: {
    href,
    'aria-label': label,
    className:
      'inline-flex size-9 items-center justify-center rounded-md text-foreground-subtle hover:bg-background-subtle hover:text-foreground',
  },
  children: [{ type: 'icon', props: { name: iconName, size: 18 } }],
})

/** A dashed placeholder region: where the operator's own content goes. */
export const slot = (label: string, extra = 'h-40'): BlockNode => ({
  type: 'container',
  props: {
    className:
      `flex w-full items-center justify-center rounded-lg border border-dashed border-border-strong bg-background-subtle ${extra}`.trim(),
  },
  children: [
    {
      type: 'text',
      element: 'span',
      props: { className: 'font-mono text-sm text-foreground-subtle' },
      content: label,
    },
  ],
})

/** The account menu of an application top bar — the way to every page on a phone. */
export const accountMenu = (items: readonly (readonly [string, string, string])[]): BlockNode => ({
  type: 'dropdown-menu',
  triggerLabel: 'Account',
  menuItems: [
    ...items.map(([label, iconName, path]) => ({
      label,
      icon: iconName,
      action: { type: 'navigate', path },
    })),
    { separator: true },
    { label: 'Sign out', icon: 'log-out', action: { type: 'auth', method: 'logout' } },
  ],
})

/** An application `header` band: bottom rule, gutter, and one row of children. */
export const appHeader = (children: readonly BlockNode[], rowClassName: string): BlockNode => ({
  type: 'container',
  element: 'header',
  props: { className: 'border-b border-border bg-background px-4 sm:px-6' },
  children: [
    {
      type: 'flex',
      props: { className: `flex items-center justify-between gap-4 ${rowClassName}`.trim() },
      children,
    },
  ],
})

/**
 * The icon button that shows the phone menu below the medium breakpoint.
 *
 * It TOGGLES a panel rather than opening a `drawer`: a drawer that is not bound
 * to a record renders open on page load, so a burger menu built on one would
 * greet every visitor with the menu already out. A panel hidden by an inline
 * `display: none` and flipped by `toggleElement` stays closed until asked.
 */
export const menuButton = (panelId: string): BlockNode => ({
  type: 'button',
  variant: 'ghost',
  props: { 'aria-label': 'Menu', 'aria-controls': panelId, className: 'md:hidden' },
  interactions: { click: { toggleElement: `#${panelId}` } },
  children: [{ type: 'icon', props: { name: 'menu', size: 20 } }],
})

/** The panel the header's links fold into on a phone, closed until the button opens it. */
export const menuPanel = (panelId: string, children: readonly BlockNode[]): BlockNode => ({
  type: 'container',
  props: {
    id: panelId,
    style: { display: 'none' },
    className: 'mx-auto w-full max-w-6xl border-t border-border pt-2 pb-6 md:!hidden',
  },
  children,
})

/** A full-width link row inside the phone menu. */
export const menuLink = (label: string, href: string, nested = false): BlockNode => ({
  type: 'link',
  props: {
    href,
    className: nested
      ? 'block border-b border-border py-3 pl-4 text-md text-foreground-muted'
      : 'block border-b border-border py-3 text-lg font-medium text-foreground',
  },
  content: label,
})
