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
import { localizeChildLabel } from './island-child-label'
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
    defaultValue: pickFromComponent(c, rawProps, 'defaultValue'),
    disabled: rawProps?.disabled,
    label: rawProps?.label ?? rawProps?.fieldLabel,
    // `publishes` marks the control as a shared-filter PUBLISHER. Like every
    // other form-control field it is a sibling of `props` at the component top
    // level, so it must be read through `pickFromComponent` — `rawProps` never
    // carries it, and reading it there would leave the declaration inert.
    publishes: pickFromComponent(c, rawProps, 'publishes'),
    ...baseProps(elementProps, designStyles),
  }
}

/** The `select` component: the platform control, or the themed island over an SSR placeholder. */
export const selectComponent: ComponentRenderer = ({
  rawProps,
  elementProps,
  component,
  designStyles,
  currentLang,
  languages,
}) => {
  const built = buildSelectProps(rawProps, elementProps, component, designStyles)
  // The caption is read off `rawProps`, which the props translation pass never
  // reaches, so a `$t:` label is resolved HERE — once, on the way into the
  // props both the platform control and the island serialise, so neither the
  // SSR document nor the hydrated island prints the key.
  const selectProps =
    typeof built.label === 'string'
      ? { ...built, label: localizeChildLabel(built.label, currentLang, languages) }
      : built
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
      data-island="select"
      data-component-type={hostComponentType(elementProps)}
      data-island-props={JSON.stringify(selectProps)}
      data-testid={elementProps['data-testid'] as string | undefined}
    >
      {renderSsrSelectPlaceholder(selectProps)}
    </div>
  )
}
