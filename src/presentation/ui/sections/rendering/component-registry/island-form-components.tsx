/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

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
    searchPlaceholder: pickFromComponent(c, rawProps, 'searchPlaceholder'),
    allowCustomValue: pickFromComponent(c, rawProps, 'allowCustomValue'),
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

function buildTabsItems(
  rawChildren: unknown,
  renderedChildren: readonly ReactElement[]
): ReadonlyArray<{
  readonly id: string
  readonly label: string
  readonly content: string
  readonly disabled?: boolean
}> {
  const children = (Array.isArray(rawChildren) ? rawChildren : []) as ReadonlyArray<{
    readonly type?: string
    readonly props?: { readonly id?: string; readonly label?: string; readonly disabled?: boolean }
    readonly content?: { readonly label?: string; readonly body?: string } | string
    readonly children?: readonly unknown[]
  }>
  return children
    .map((child, index) => ({ child, index }))
    .filter(({ child }) => child?.type === 'tab-panel')
    .map(({ child, index }) => {
      const tabContent = typeof child.content === 'object' ? child.content : undefined
      const label = tabContent?.label ?? child.props?.label ?? ''
      const id =
        child.props?.id ??
        label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      const stringBody = tabContent?.body
      const childRendered = renderedChildren[index]
      const renderedBody =
        stringBody !== undefined
          ? stringBody
          : childRendered
            ? renderToStaticMarkup(childRendered)
            : ''
      return {
        id,
        label,
        content: renderedBody,
        disabled: child.props?.disabled,
      }
    })
    .filter((item) => item.id !== '' || item.label !== '' || item.content !== '')
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
        {}
        <select
          className="border-border bg-background-raised text-foreground w-full rounded-md border px-3 py-2 text-sm shadow-sm"
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
        <div className="divide-border border-border divide-y rounded-lg border">
          <div className="px-4 py-3">
            <div className="bg-background-subtle h-5 w-48 animate-pulse rounded" />
          </div>
          <div className="px-4 py-3">
            <div className="bg-background-subtle h-5 w-40 animate-pulse rounded" />
          </div>
        </div>
      </div>
    )
  },

  tabs: ({ component, elementProps, renderedChildren }) => {
    const c = asRecord(component)
    const islandProps = {
      items: buildTabsItems(c['children'], renderedChildren),
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
        <div className="border-border border-b">
          <div className="flex gap-4 px-4">
            <div className="bg-background-subtle h-8 w-20 animate-pulse rounded" />
            <div className="bg-background-subtle h-8 w-20 animate-pulse rounded" />
            <div className="bg-background-subtle h-8 w-20 animate-pulse rounded" />
          </div>
        </div>
        <div className="p-4">
          <div className="bg-background-subtle h-24 animate-pulse rounded" />
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
          <div className="bg-background-subtle h-5 w-32 animate-pulse rounded" />
          <div className="bg-background-subtle h-5 w-28 animate-pulse rounded" />
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
          <div className="bg-background-subtle h-5 w-9 animate-pulse rounded-full" />
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
        <div className="bg-background-subtle h-1.5 w-full rounded-full">
          <div className="bg-primary h-full w-1/2 rounded-full" />
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
          className="bg-background-subtle text-foreground rounded-md px-3 py-2 text-sm"
        >
          {(rawProps?.content as string) ?? 'Toggle'}
        </button>
      </div>
    )
  },

  'toggle-group': ({ rawProps, elementProps, component }) => {
    const c = asRecord(component)
    const rawOptions = pickFromComponent(c, rawProps, 'options') ?? rawProps?.items
    const items = Array.isArray(rawOptions)
      ? rawOptions.map((option) => {
          const o = option as Record<string, unknown>
          return {
            id: (o.value ?? o.id ?? '') as string,
            label: (o.label ?? o.value ?? o.id ?? '') as string,
            disabled: o.disabled as boolean | undefined,
          }
        })
      : undefined
    const props = {
      items,
      toggleType: pickFromComponent(c, rawProps, 'toggleType'),
      orientation: pickFromComponent(c, rawProps, 'orientation'),
      size: pickFromComponent(c, rawProps, 'size'),
      defaultValue: pickFromComponent(c, rawProps, 'defaultValue'),
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="toggle-group"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div className="border-border inline-flex rounded-md border">
          <div className="bg-background-subtle h-9 w-16 animate-pulse" />
          <div className="bg-background-subtle h-9 w-16 animate-pulse" />
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
          className="border-border flex rounded-md border"
        >
          <div className="bg-background-subtle h-8 w-16 animate-pulse rounded" />
          <div className="bg-background-subtle h-8 w-16 animate-pulse rounded" />
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
    const userClassName = elementProps['className'] as string | undefined
    const navClassName = userClassName
      ? `flex items-center gap-1 ${userClassName}`
      : 'flex items-center gap-1'
    return (
      <nav
        data-island="navigation-menu"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
        aria-label={elementProps['aria-label'] as string | undefined}
        className={navClassName}
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
          <div className="bg-background-subtle h-8 w-60 animate-pulse rounded" />
        )}
      </nav>
    )
  },

  'scroll-area': ({ rawProps, elementProps, component, renderedChildren }) => {
    const c = asRecord(component)
    const scrollAreaHeight = pickFromComponent(c, rawProps, 'scrollAreaHeight') as
      | string
      | undefined
    const scrollOrientation = pickFromComponent(c, rawProps, 'scrollOrientation') as
      | 'vertical'
      | 'horizontal'
      | 'both'
      | undefined
    const childrenHtml = renderedChildren.map((child) => renderToStaticMarkup(child)).join('')
    const props = {
      scrollAreaHeight,
      scrollOrientation,
      childrenHtml,
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="scroll-area"
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
        style={{ maxHeight: scrollAreaHeight ?? '400px', overflow: 'auto' }}
        id={elementProps.id as string | undefined}
        className={elementProps.className as string | undefined}
        dangerouslySetInnerHTML={{ __html: childrenHtml }}
      />
    )
  },
}
