/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Renderers from '../../renderers/element-renderers'
import { convertBadgeProps } from '../component-registry-helpers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Interactive components (button, link, form, input, icon, badge, etc.)
 *
 * These components render interactive elements and form controls.
 */
export const interactiveComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  button: ({
    elementProps,
    content,
    renderedChildren,
    interactions,
    action,
    tables,
    routeParams,
    component,
  }) =>
    Renderers.renderButton({
      props: elementProps,
      content,
      children: renderedChildren,
      interactions,
      action,
      tables,
      routeParams,
      loading: (component as { loading?: boolean } | undefined)?.loading,
    }),

  link: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderLink(elementProps, content, renderedChildren),

  alert: ({ elementProps, content, renderedChildren, theme }) =>
    Renderers.renderAlert(elementProps, content, renderedChildren, theme),

  form: ({ elementProps, renderedChildren, action, tables, buckets, component }) =>
    Renderers.renderForm({
      props: elementProps,
      children: renderedChildren,
      action,
      tables,
      buckets,
      component,
    }),

  input: ({ elementProps }) => Renderers.renderInput(elementProps),

  textarea: ({ elementProps, component, rawProps }) => {
    // `rows`, `maxLength`, `autoResize` are top-level schema fields per
    // textarea.ts (siblings of `props`), not inside `props`. Same lookup
    // contract as the form-control islands — see `pickFromComponent`
    // doc-comment in `island-form-components.tsx`.
    //
    // `props.label` (when present) is translated into `aria-label` so
    // `getByRole('textbox', { name: ... })` resolves. Same pattern as the
    // select/checkbox renderers which read `rawProps?.label`.
    const c = (component ?? {}) as Record<string, unknown>
    const rows = c['rows'] as number | undefined
    const maxLength = c['maxLength'] as number | undefined
    const autoResize = c['autoResize'] as boolean | undefined
    const label = rawProps?.['label'] as string | undefined

    return Renderers.renderTextarea({
      props: elementProps,
      rows,
      maxLength,
      label,
      autoResize,
      placeholder: rawProps?.['placeholder'] as string | undefined,
      name: rawProps?.['name'] as string | undefined,
    })
  },

  field: ({ elementProps, component, renderedChildren }) => {
    // `fieldLabel`, `fieldDescription`, `fieldError`, `required` are top-level
    // schema fields per field.ts (siblings of `props`). The first child's
    // `props.id` is used as the label's `htmlFor` target so a click on the
    // label focuses the nested control natively (no JS / island required).
    const c = (component ?? {}) as Record<string, unknown>
    return Renderers.renderField({
      props: elementProps,
      fieldLabel: c['fieldLabel'] as string | undefined,
      fieldDescription: c['fieldDescription'] as string | undefined,
      fieldError: c['fieldError'] as string | undefined,
      required: c['required'] as boolean | undefined,
      controlId: Renderers.extractFirstChildId(component),
      children: renderedChildren,
    })
  },

  'file-upload': ({ elementProps, component, rawProps }) => {
    // `accept`, `maxFiles`, `dropZone`, and `disabled` are top-level schema
    // fields on the file-upload component (siblings of `props`), not nested
    // inside `props` — same lookup contract as the form-control islands. See
    // the `pickFromComponent` doc-comment in `island-form-components.tsx`.
    const c = (component ?? {}) as Record<string, unknown>
    return Renderers.renderFileUpload({
      props: elementProps,
      accept: (c['accept'] as string | undefined) ?? (rawProps?.['accept'] as string | undefined),
      maxFiles:
        (c['maxFiles'] as number | undefined) ?? (rawProps?.['maxFiles'] as number | undefined),
      dropZone:
        (c['dropZone'] as boolean | undefined) ?? (rawProps?.['dropZone'] as boolean | undefined),
      disabled: rawProps?.['disabled'] as boolean | undefined,
      label: rawProps?.['label'] as string | undefined,
    })
  },

  icon: ({ elementProps, renderedChildren }) =>
    Renderers.renderIcon(elementProps, renderedChildren),

  badge: ({ elementProps, content, renderedChildren, interactions }) => {
    const badgeProps = convertBadgeProps(elementProps)
    return Renderers.renderHTMLElement({
      type: 'span',
      props: badgeProps,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    })
  },

  customHTML: ({ elementProps, content }) => Renderers.renderCustomHTML(elementProps, content),

  'language-switcher': ({ elementProps, languages }) =>
    Renderers.renderLanguageSwitcher(elementProps, languages),

  searchInput: ({ elementProps }) => Renderers.renderSearchInput(elementProps),
}
