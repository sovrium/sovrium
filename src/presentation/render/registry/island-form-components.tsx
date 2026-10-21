/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { resolveTranslationTokensDeep } from '@/domain/models/app/languages/translation-resolver'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { hostComponentType } from '@/presentation/render/registry/island-host-attributes'
import { AccordionSkeleton } from './accordion-skeleton'
import { buildAccordionItems } from './island-accordion-items'
import { asRecord, baseProps, controlLabel, pickFromComponent } from './island-form-props'
import { renderSsrNavItem } from './island-nav-ssr'
import { islandTabsComponent } from './island-tabs-component'
import { recordPickerComponent } from './record-picker-component'
import { selectComponents } from './select-component'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'
import type { ElemProps, RawProps } from './island-form-props'
import type { SsrNavItem } from './island-nav-ssr'

function buildCheckboxProps(rawProps: RawProps, elementProps: ElemProps, component?: unknown) {
  const c = asRecord(component)
  return {
    checked: pickFromComponent(c, rawProps, 'checked'),
    indeterminate: pickFromComponent(c, rawProps, 'indeterminate'),
    disabled: rawProps?.disabled,
    label: controlLabel(rawProps),
    name: rawProps?.name,
    ariaLabel: elementProps['aria-label'] as string | undefined,
    ...baseProps(elementProps),
  }
}

/** Form, navigation, and interactive island components */
export const islandFormComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  'record-picker': recordPickerComponent,
  ...selectComponents,
  accordion: ({ component, elementProps, currentLang, languages }) => {
    // `accordionType`, `defaultOpen`, `children` are top-level fields, as in tabs.
    const c = asRecord(component)
    const props = {
      items: buildAccordionItems(c['children'], currentLang, languages),
      accordionType: (c['accordionType'] as 'single' | 'multiple' | undefined) ?? 'single',
      defaultOpen: c['defaultOpen'] as readonly string[] | undefined,
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="accordion"
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <AccordionSkeleton rawChildren={c['children']} />
      </div>
    )
  },

  tabs: islandTabsComponent,

  checkbox: ({ rawProps, elementProps, component }) => {
    const checkboxProps = buildCheckboxProps(rawProps, elementProps, component)
    return (
      <div
        data-island="checkbox"
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(checkboxProps)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <label className="inline-flex items-center gap-2 text-sm leading-none font-medium select-none">
          <input
            type="checkbox"
            defaultChecked={checkboxProps.checked as boolean | undefined}
            disabled
          />
          <span>{controlLabel(rawProps) ?? ''}</span>
        </label>
      </div>
    )
  },

  'radio-group': ({ rawProps, elementProps, component }) => {
    // `options`, `defaultValue`, `orientation` live at the component top level
    // (siblings of `props`) per the radio-group schema. See pickFromComponent
    // doc-comment for the full lookup contract.
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
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <fieldset className="flex flex-col gap-2">
          <div className="bg-muted h-5 w-32 animate-pulse rounded" />
          <div className="bg-muted h-5 w-28 animate-pulse rounded" />
        </fieldset>
      </div>
    )
  },

  switch: ({ rawProps, elementProps, component }) => {
    const c = asRecord(component) // `checked` and `size` are top-level fields (switch.ts)
    const props = {
      checked: pickFromComponent(c, rawProps, 'checked'),
      disabled: rawProps?.disabled,
      size: pickFromComponent(c, rawProps, 'size'),
      label: controlLabel(rawProps),
      name: rawProps?.name,
      ariaLabelledBy: rawProps?.['aria-labelledby'],
      ariaLabel: elementProps['aria-label'] as string | undefined,
      publishes: pickFromComponent(c, rawProps, 'publishes'),
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="switch"
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <label className="inline-flex items-center gap-2 text-sm leading-none font-medium select-none">
          <div className="bg-input h-[18.4px] w-[32px] animate-pulse rounded-full" />
          <span>{controlLabel(rawProps) ?? ''}</span>
        </label>
      </div>
    )
  },

  slider: ({ rawProps, elementProps, component }) => {
    const c = asRecord(component) // `min`…`showValue` are top-level fields (slider.ts)
    const props = {
      min: pickFromComponent(c, rawProps, 'min'),
      max: pickFromComponent(c, rawProps, 'max'),
      step: pickFromComponent(c, rawProps, 'step'),
      defaultValue: pickFromComponent(c, rawProps, 'defaultValue'),
      showValue: pickFromComponent(c, rawProps, 'showValue'),
      disabled: rawProps?.disabled,
      label: rawProps?.label ?? rawProps?.fieldLabel,
      publishes: pickFromComponent(c, rawProps, 'publishes'),
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="slider"
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
          <div className="bg-primary h-full w-1/2" />
        </div>
      </div>
    )
  },

  toggle: ({ rawProps, elementProps, component }) => {
    // `pressed`, `toggleType`, `size` and `toggleVariant` are top-level fields (toggle.ts).
    const c = asRecord(component)
    const props = {
      pressed: pickFromComponent(c, rawProps, 'pressed'),
      disabled: rawProps?.disabled,
      variant:
        pickFromComponent(c, rawProps, 'toggleVariant') ??
        pickFromComponent(c, rawProps, 'variant'),
      size: pickFromComponent(c, rawProps, 'size'),
      label: controlLabel(rawProps) ?? rawProps?.['aria-label'],
      publishes: pickFromComponent(c, rawProps, 'publishes'),
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="toggle"
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <button
          type="button"
          disabled
          className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2.5 text-sm font-medium whitespace-nowrap"
        >
          {controlLabel(rawProps) ?? 'Toggle'}
        </button>
      </div>
    )
  },

  'toggle-group': ({ rawProps, elementProps, component }) => {
    // `OptionsSchema` `{ label, value }` becomes the island's `{ id, label }` items.
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
      variant: pickFromComponent(c, rawProps, 'toggleVariant'),
      spacing: pickFromComponent(c, rawProps, 'spacing'),
      label: rawProps?.['aria-label'],
      defaultValue: pickFromComponent(c, rawProps, 'defaultValue'),
      publishes: pickFromComponent(c, rawProps, 'publishes'),
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="toggle-group"
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div className="inline-flex gap-2">
          <div className="bg-muted h-8 w-16 animate-pulse rounded-lg" />
          <div className="bg-muted h-8 w-16 animate-pulse rounded-lg" />
        </div>
      </div>
    )
  },

  menubar: ({ rawProps, elementProps, component }) => {
    // `menus` is a top-level schema field (a sibling of `props`), read like
    // every other form-control field through `pickFromComponent`.
    const props = {
      menus: pickFromComponent(asRecord(component), rawProps, 'menus'),
      ...baseProps(elementProps),
    }
    return (
      <div
        data-island="menubar"
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        <div
          role="menubar"
          className="border-border flex rounded-md border"
        >
          <div className="bg-muted h-8 w-16 animate-pulse rounded" />
          <div className="bg-muted h-8 w-16 animate-pulse rounded" />
        </div>
      </div>
    )
  },

  'navigation-menu': ({
    rawProps,
    elementProps,
    renderedChildren,
    component,
    languages,
    currentLang,
  }) => {
    const navMenuComp = component?.type === 'navigation-menu' ? component : undefined
    const rawNavItems =
      (navMenuComp && Array.isArray(navMenuComp.navItems)
        ? (navMenuComp.navItems as readonly SsrNavItem[])
        : undefined) ?? (rawProps?.navItems as readonly SsrNavItem[] | undefined)
    // The navbar dropdown capability set (round-4): `openOnHover` + `triggerClassName` are top-level schema
    // fields (siblings of `navItems`). Serialize them into the island props so the
    // hydrated NavMenuIsland opens on hover and applies the
    // authored trigger override. `triggerClassName` is ALSO
    // applied to the SSR placeholder trigger below so the two class lists match.
    const openOnHover = navMenuComp?.openOnHover
    const triggerClassName = navMenuComp?.triggerClassName
    // Schema-level navItems can carry `$t:` tokens in label/description/href:
    // resolve them BEFORE serialization so both the SSR fallback and the
    // hydrated island show the translated strings.
    const navItems = resolveTranslationTokensDeep(rawNavItems, currentLang, languages) as
      readonly SsrNavItem[] | undefined
    const props = { navItems, openOnHover, triggerClassName, ...baseProps(elementProps) }
    // Respect className from schema props; default to horizontal flex when not provided.
    const userClassName = elementProps['className'] as string | undefined
    const navClassName = resolveClasses('flex items-center gap-1', userClassName)
    // Landmark discipline: the mega-menu (`navItems`) form
    // renders a `div` wrapper — menus carry their own roles, and the standard
    // header composition embeds this component inside an authored `<nav>`,
    // which must stay the page's ONLY navigation landmark. The legacy
    // children-based form keeps its `<nav>` element (page-direct standalone
    // usage relies on the landmark, e.g. `nav a` selectors in the
    // responsive-override specs).
    const Wrapper = navItems !== undefined ? 'div' : 'nav'
    // Only the `navItems` form is an island. The island renders `navItems` and
    // nothing else, and it mounts INSIDE this host, replacing what the server
    // rendered — so marking the children-based form as an island erased the
    // author's children (and the empty placeholder) on hydration, leaving an
    // empty, zero-size nav. That form is complete as served.
    const isIsland = navItems !== undefined
    return (
      <Wrapper
        data-island={isIsland ? 'navigation-menu' : undefined}
        data-slot="navigation-menu"
        data-component-type={hostComponentType(elementProps)}
        data-island-props={isIsland ? JSON.stringify(props) : undefined}
        data-testid={elementProps['data-testid'] as string | undefined}
        aria-label={elementProps['aria-label'] as string | undefined}
        className={navClassName}
      >
        {renderedChildren.length > 0 ? (
          renderedChildren
        ) : navItems && navItems.length > 0 ? (
          navItems.map((item, index) => renderSsrNavItem(item, index, triggerClassName))
        ) : (
          <div className="bg-muted h-8 w-60 animate-pulse rounded" />
        )}
      </Wrapper>
    )
  },

  'scroll-area': ({ rawProps, elementProps, component, renderedChildren }) => {
    const c = asRecord(component)
    const scrollAreaHeight = pickFromComponent(c, rawProps, 'scrollAreaHeight') as
      string | undefined
    const scrollOrientation = pickFromComponent(c, rawProps, 'scrollOrientation') as
      'vertical' | 'horizontal' | 'both' | undefined
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
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(props)}
        data-testid={elementProps['data-testid'] as string | undefined}
        style={{ maxHeight: scrollAreaHeight ?? '400px', overflow: 'auto' }}
        id={elementProps.id as string | undefined}
        className={elementProps.className as string | undefined}
        // eslint-disable-next-line sovrium/require-sanitized-html -- server-rendered markup: renderToStaticMarkup output, which escapes every text and attribute value
        dangerouslySetInnerHTML={{ __html: childrenHtml }}
      />
    )
  },
}
