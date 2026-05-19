/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

type RawProps = Record<string, unknown> | undefined
type ElemProps = Record<string, unknown>

function baseProps(elementProps: ElemProps) {
  return {
    className: elementProps.className,
    id: elementProps.id,
    'data-testid': elementProps['data-testid'],
  }
}

function pickFromComponent(c: Record<string, unknown>, rawProps: RawProps, key: string): unknown {
  return c[key] ?? rawProps?.[key]
}

function asRecord(component?: unknown): Record<string, unknown> {
  return (component ?? {}) as Record<string, unknown>
}

function buildSelectProps(rawProps: RawProps, elementProps: ElemProps, component?: unknown) {
  const c = asRecord(component)
  return {
    options: pickFromComponent(c, rawProps, 'options'),
    placeholder: rawProps?.placeholder,
    multiple: pickFromComponent(c, rawProps, 'multiple'),
    searchable: pickFromComponent(c, rawProps, 'searchable'),
    defaultValue: pickFromComponent(c, rawProps, 'defaultValue'),
    disabled: rawProps?.disabled,
    label: rawProps?.label ?? rawProps?.fieldLabel,
    ...baseProps(elementProps),
  }
}

function buildCheckboxProps(rawProps: RawProps, elementProps: ElemProps, component?: unknown) {
  const c = asRecord(component)
  return {
    checked: pickFromComponent(c, rawProps, 'checked'),
    indeterminate: pickFromComponent(c, rawProps, 'indeterminate'),
    disabled: rawProps?.disabled,
    label: rawProps?.label ?? rawProps?.content,
    name: rawProps?.name,
    ...baseProps(elementProps),
  }
}

function buildAccordionItems(rawChildren: unknown): ReadonlyArray<{
  readonly id: string
  readonly title: string
  readonly content: string
}> {
  const children = (Array.isArray(rawChildren) ? rawChildren : []) as ReadonlyArray<{
    readonly type?: string
    readonly props?: { readonly id?: string }
    readonly content?: { readonly title?: string; readonly body?: string } | string
  }>
  return children
    .map((child) => {
      const itemContent = typeof child.content === 'object' ? child.content : undefined
      return {
        id: child.props?.id ?? '',
        title: itemContent?.title ?? '',
        content: itemContent?.body ?? '',
      }
    })
    .filter((item) => item.id !== '')
}

function buildTabsItems(rawChildren: unknown): ReadonlyArray<{
  readonly id: string
  readonly label: string
  readonly content: string
  readonly disabled?: boolean
}> {
  const children = (Array.isArray(rawChildren) ? rawChildren : []) as ReadonlyArray<{
    readonly type?: string
    readonly props?: { readonly id?: string; readonly disabled?: boolean }
    readonly content?: { readonly label?: string; readonly body?: string } | string
  }>
  return children
    .filter((child) => child?.type === 'tab-panel')
    .map((child) => {
      const tabContent = typeof child.content === 'object' ? child.content : undefined
      return {
        id: child.props?.id ?? '',
        label: tabContent?.label ?? '',
        content: tabContent?.body ?? '',
        disabled: child.props?.disabled,
      }
    })
    .filter((item) => item.id !== '')
}

export const islandFormComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  select: ({ rawProps, elementProps, component }) => {
    const selectProps = buildSelectProps(rawProps, elementProps, component)
    return (
      <div
        id={elementProps.id as string | undefined}
        data-island="select"
        data-island-props={JSON.stringify(selectProps)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <select
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm"
          disabled
        >
          <option>{(rawProps?.placeholder as string) ?? 'Loading...'}</option>
        </select>
      </div>
    )
  },

  accordion: ({ component, elementProps }) => {
    const c = asRecord(component)
    const props = {
      items: buildAccordionItems(c['children']),
      accordionType: (c['accordionType'] as 'single' | 'multiple' | undefined) ?? 'single',
      defaultOpen: c['defaultOpen'] as readonly string[] | undefined,
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="accordion"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div className="divide-y rounded-lg border border-gray-200">
          <div className="px-4 py-3">
            <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="px-4 py-3">
            <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    )
  },

  tabs: ({ component, elementProps }) => {
    const c = asRecord(component)
    const islandProps = {
      items: buildTabsItems(c['children']),
      defaultTab: c['defaultTab'] as string | undefined,
      tabsOrientation:
        (c['tabsOrientation'] as 'horizontal' | 'vertical' | undefined) ?? 'horizontal',
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="tabs"
        data-island-props={JSON.stringify(islandProps)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div className="border-b border-gray-200">
          <div className="flex gap-4 px-4">
            <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <div className="p-4">
          <div className="h-24 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    )
  },

  checkbox: ({ rawProps, elementProps, component }) => {
    const checkboxProps = buildCheckboxProps(rawProps, elementProps, component)
    return (
      <div
        data-island="checkbox"
        data-island-props={JSON.stringify(checkboxProps)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            defaultChecked={checkboxProps.checked as boolean | undefined}
            disabled
          />
          <span className="text-sm">{(rawProps?.content as string) ?? ''}</span>
        </label>
      </div>
    )
  },

  'radio-group': ({ rawProps, elementProps, component }) => {
    const c = asRecord(component)
    const props = {
      options: pickFromComponent(c, rawProps, 'options'),
      defaultValue: pickFromComponent(c, rawProps, 'defaultValue'),
      orientation: pickFromComponent(c, rawProps, 'orientation'),
      disabled: rawProps?.disabled,
      name: rawProps?.name,
      label: rawProps?.label ?? rawProps?.fieldLabel,
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="radio-group"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <fieldset className="flex flex-col gap-2">
          <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-5 w-28 animate-pulse rounded bg-gray-200" />
        </fieldset>
      </div>
    )
  },

  switch: ({ rawProps, elementProps, component }) => {
    const c = asRecord(component)
    const props = {
      checked: pickFromComponent(c, rawProps, 'checked'),
      disabled: rawProps?.disabled,
      size: pickFromComponent(c, rawProps, 'size'),
      label: rawProps?.label ?? rawProps?.content,
      name: rawProps?.name,
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="switch"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <label className="inline-flex items-center gap-2">
          <div className="h-5 w-9 animate-pulse rounded-full bg-gray-200" />
          <span className="text-sm">{(rawProps?.content as string) ?? ''}</span>
        </label>
      </div>
    )
  },

  slider: ({ rawProps, elementProps, component }) => {
    const c = asRecord(component)
    const props = {
      min: pickFromComponent(c, rawProps, 'min'),
      max: pickFromComponent(c, rawProps, 'max'),
      step: pickFromComponent(c, rawProps, 'step'),
      defaultValue: pickFromComponent(c, rawProps, 'defaultValue'),
      showValue: pickFromComponent(c, rawProps, 'showValue'),
      disabled: rawProps?.disabled,
      label: rawProps?.label ?? rawProps?.fieldLabel,
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="slider"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div className="h-1.5 w-full rounded-full bg-gray-200">
          <div className="h-full w-1/2 rounded-full bg-blue-600" />
        </div>
      </div>
    )
  },

  toggle: ({ rawProps, elementProps, component }) => {
    const c = asRecord(component)
    const props = {
      pressed: pickFromComponent(c, rawProps, 'pressed'),
      disabled: rawProps?.disabled,
      variant: pickFromComponent(c, rawProps, 'variant'),
      size: pickFromComponent(c, rawProps, 'size'),
      label: rawProps?.content,
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="toggle"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <button
          type="button"
          disabled
          className="rounded-md bg-gray-100 px-3 py-2 text-sm"
        >
          {(rawProps?.content as string) ?? 'Toggle'}
        </button>
      </div>
    )
  },

  'toggle-group': ({ rawProps, elementProps, component }) => {
    const c = asRecord(component)
    const props = {
      items: pickFromComponent(c, rawProps, 'options') ?? rawProps?.items,
      toggleType: pickFromComponent(c, rawProps, 'toggleType'),
      orientation: pickFromComponent(c, rawProps, 'orientation'),
      size: pickFromComponent(c, rawProps, 'size'),
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="toggle-group"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div className="inline-flex rounded-md border border-gray-200">
          <div className="h-9 w-16 animate-pulse bg-gray-100" />
          <div className="h-9 w-16 animate-pulse bg-gray-100" />
        </div>
      </div>
    )
  },

  menubar: ({ rawProps, elementProps }) => {
    const props = { menus: rawProps?.menus, ...baseProps(elementProps) }
    return (
      <div
        data-island="menubar"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div
          role="menubar"
          className="flex rounded-md border border-gray-200"
        >
          <div className="h-8 w-16 animate-pulse rounded bg-gray-100" />
          <div className="h-8 w-16 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    )
  },

  'navigation-menu': ({ rawProps, elementProps, renderedChildren, component }) => {
    const navItems =
      (component?.type === 'navigation-menu' && Array.isArray(component.navItems)
        ? (component.navItems as readonly { label: string; href?: string }[])
        : undefined) ??
      (rawProps?.navItems as readonly { label: string; href?: string }[] | undefined)
    const props = { navItems, ...baseProps(elementProps) }
    return (
      <nav
        data-island="navigation-menu"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
        className="flex items-center gap-1"
      >
        {renderedChildren.length > 0 ? (
          renderedChildren
        ) : navItems && navItems.length > 0 ? (
          navItems.map((item, index) => {
            const navItem = item as {
              readonly label: string
              readonly href?: string
              readonly target?: '_self' | '_blank' | '_parent' | '_top'
              readonly rel?: string
            }
            return (
              <a
                key={index}
                href={navItem.href}
                target={navItem.target}
                rel={navItem.rel}
              >
                {navItem.label}
              </a>
            )
          })
        ) : (
          <div className="h-8 w-60 animate-pulse rounded bg-gray-100" />
        )}
      </nav>
    )
  },

  'scroll-area': ({ rawProps, elementProps }) => {
    const props = {
      scrollAreaHeight: rawProps?.scrollAreaHeight,
      scrollOrientation: rawProps?.scrollOrientation,
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="scroll-area"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
        style={{ maxHeight: (rawProps?.scrollAreaHeight as string) ?? '400px', overflow: 'hidden' }}
      >
        <div className="h-full animate-pulse bg-gray-50" />
      </div>
    )
  },
}
