/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { withEmptyOption } from '@/domain/models/app/pages/select-empty-option'
import {
  renderNativeSelect,
  renderSsrSelectPlaceholder,
} from '@/presentation/render/elements/native-select'
import { hostComponentType } from '@/presentation/render/registry/island-host-attributes'
import { localizeChildLabel, resolveInterpreterStringOverrides } from './island-child-label'
import { asRecord, baseProps, pickFromComponent } from './island-form-props'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ElemProps, RawProps } from './island-form-props'
import type { ComponentDesignResolution } from '@/presentation/design/resolve-component-classes'

/**
 * `emptyOption` is folded into `options` HERE rather than in either renderer, so
 * the platform `<select>` and the themed island receive one list and cannot
 * disagree about what is in it — and so the declaration itself never reaches the
 * island props, where it would be a second, contradictory way to say the same
 * thing.
 *
 * Its label is NOT run through `$t:`, deliberately: `substitutePropsTranslationTokens`
 * covers `props` and never a component's top-level fields, so the sibling
 * `options[].label` captions are not translated either. Translating this one row
 * and not the rest would be the odder of the two behaviours; widening `$t:` to
 * top-level option captions is its own story.
 */
function buildSelectProps(
  rawProps: RawProps,
  elementProps: ElemProps,
  component?: unknown,
  designStyles?: ComponentDesignResolution
) {
  const c = asRecord(component)
  return {
    options: withEmptyOption(
      pickFromComponent(c, rawProps, 'options'),
      pickFromComponent(c, rawProps, 'emptyOption')
    ),
    placeholder: rawProps?.placeholder,
    multiple: pickFromComponent(c, rawProps, 'multiple'),
    clearable: pickFromComponent(c, rawProps, 'clearable'),
    chips: pickFromComponent(c, rawProps, 'chips'),
    name: rawProps?.name,
    // `native` selects the PLATFORM control. Read here rather than in
    // the renderer so the single lookup contract documented above keeps covering
    // every top-level field of the select schema.
    native: pickFromComponent(c, rawProps, 'native'),
    searchable: pickFromComponent(c, rawProps, 'searchable'),
    // `searchPlaceholder` overrides the generic `placeholder` inside the
    // combobox search input. `allowCustomValue` opts the combobox into
    // free-form input (typed values not in the option list are accepted).
    searchPlaceholder: pickFromComponent(c, rawProps, 'searchPlaceholder'),
    allowCustomValue: pickFromComponent(c, rawProps, 'allowCustomValue'),
    // With an `emptyOption` and no `defaultValue` the control rests on that row:
    // its value is the empty string, as the platform control's first option is.
    defaultValue:
      pickFromComponent(c, rawProps, 'defaultValue') ??
      (pickFromComponent(c, rawProps, 'emptyOption') === undefined ? undefined : ''),
    disabled: rawProps?.disabled,
    label: rawProps?.label ?? rawProps?.fieldLabel,
    // A `field` around the select names it by its label (`slot-children.ts`).
    labelledBy: elementProps['aria-labelledby'] as string | undefined,
    // A select with no caption and no field around it is named by its own
    // `props['aria-label']`, carried onto the control the island draws.
    ariaLabel: elementProps['aria-label'] as string | undefined,
    // `publishes` marks the control as a shared-filter PUBLISHER. Like every
    // other form-control field it is a sibling of `props` at the component top
    // level, so it must be read through `pickFromComponent` — `rawProps` never
    // carries it, and reading it there would leave the declaration inert.
    publishes: pickFromComponent(c, rawProps, 'publishes'),
    ...baseProps(elementProps, designStyles),
  }
}

/**
 * The select's own words in the page language (`select.*`), where they differ
 * from English: its empty prompt when the author wrote none, and the names the
 * island gives its open and clear controls.
 */
const withSelectWords = <T extends { readonly placeholder?: unknown }>(
  props: T,
  words: Readonly<Record<string, string>> | undefined
): T =>
  words === undefined
    ? props
    : {
        ...props,
        uiStrings: words,
        ...(props.placeholder === undefined &&
          words['select.placeholder'] !== undefined && {
            placeholder: words['select.placeholder'],
          }),
      }

/**
 * The themed select, hosted by the island named `islandKey`: `select`, or
 * `combobox`, which mounts the same island with type-ahead always on.
 */
const themedSelect =
  (islandKey: 'select' | 'combobox'): ComponentRenderer =>
  ({ rawProps, elementProps, component, designStyles, currentLang, languages }) => {
    const built = buildSelectProps(rawProps, elementProps, component, designStyles)
    // The caption is read off `rawProps`, which the props translation pass never
    // reaches, so a `$t:` label is resolved HERE — once, on the way into the
    // props both the platform control and the island serialise, so neither the
    // SSR document nor the hydrated island prints the key.
    const selectProps = withSelectWords(
      typeof built.label === 'string'
        ? { ...built, label: localizeChildLabel(built.label, currentLang, languages) }
        : built,
      resolveInterpreterStringOverrides(['select.'], currentLang, languages)
    )
    // The PLATFORM control: the same element this renderer already
    // produced below, left enabled and emitted with NO island marker — so
    // nothing replaces it and the page ships no component code for it.
    // `selectProps` already carries `id` / `className` / `data-testid` through
    // `baseProps`, so only `name` (a `rawProps`-only field) has to be threaded.
    if (selectProps.native === true) {
      return renderNativeSelect(selectProps, rawProps?.name as string | undefined)
    }
    return (
      <div
        id={elementProps.id as string | undefined}
        data-island={islandKey}
        data-component-type={hostComponentType(elementProps)}
        data-island-props={JSON.stringify(selectProps)}
        data-testid={elementProps['data-testid'] as string | undefined}
      >
        {renderSsrSelectPlaceholder(selectProps)}
      </div>
    )
  }

/** The `select` component: the platform control, or the themed island over an SSR placeholder. */
export const selectComponent: ComponentRenderer = themedSelect('select')

/**
 * The `combobox` component: one choice found by typing. The `select` island
 * with type-ahead always on, mounted under its own key so a page carrying only
 * comboboxes still ships the island.
 */
export const comboboxComponent: ComponentRenderer = (context) =>
  themedSelect('combobox')({
    ...context,
    component: { ...asRecord(context.component), searchable: true },
  })

/**
 * The `native-select` component: the browser's own `<select>`, rendered with no
 * island. It is the platform branch of {@link selectComponent}, reached by its
 * own type rather than by `native: true` on a `select`.
 */
export const nativeSelectComponent: ComponentRenderer = (context) =>
  selectComponent({ ...context, component: { ...asRecord(context.component), native: true } })

/** The select family's renderers, keyed by type, for the island form registry. */
export const selectComponents = {
  select: selectComponent,
  combobox: comboboxComponent,
  'native-select': nativeSelectComponent,
} as const satisfies Readonly<Record<string, ComponentRenderer>>
