/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Renderers from '../../renderers/element-renderers'
import { renderStatusBadge } from '../../renderers/element-renderers/html-element-renderer'
import { convertBadgeProps } from '../component-registry-helpers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

function resolveStatusDotColorClass(value: unknown): string {
  switch (value) {
    case 'green':
      return 'bg-success-solid'
    case 'red':
      return 'bg-error-solid'
    case 'amber':
    case 'yellow':
      return 'bg-warning-solid'
    case 'blue':
      return 'bg-info-solid'
    case 'gray':
    default:
      return 'bg-neutral-600'
  }
}

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
  }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const variant = c['variant'] as string | undefined
    const size = c['size'] as string | undefined
    const loading = c['loading'] as boolean | undefined

    const variantClass = variant && variant !== 'default' ? `btn-${variant}` : ''
    const sizeClass = size && size !== 'md' ? `btn-${size}` : ''
    const btnClasses = ['btn', variantClass, sizeClass].filter(Boolean).join(' ')
    const authorClassName = elementProps.className as string | undefined
    const mergedClassName = authorClassName ? `${btnClasses} ${authorClassName}` : btnClasses

    return Renderers.renderButton({
      props: { ...elementProps, className: mergedClassName },
      content,
      children: renderedChildren,
      interactions,
      action,
      tables,
      routeParams,
      loading,
    })
  },

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

  badge: ({ elementProps, content, renderedChildren, interactions, component }) => {
    const badgeProps = convertBadgeProps(elementProps)

    const variant = (component as { variant?: unknown } | undefined)?.variant
    if (variant === 'status') {
      const status = (component as { status?: unknown } | undefined)?.status
      const statusColor = (component as { statusColor?: unknown } | undefined)?.statusColor
      const pulse = (component as { pulse?: unknown } | undefined)?.pulse === true
      const dotColorClass = resolveStatusDotColorClass(statusColor)
      const dotClassName = pulse
        ? `inline-block h-2 w-2 rounded-full ${dotColorClass} animate-pulse`
        : `inline-block h-2 w-2 rounded-full ${dotColorClass}`
      const statusLabel = typeof status === 'string' ? status : undefined
      return renderStatusBadge({
        props: badgeProps,
        dotClassName,
        label: statusLabel,
      })
    }

    return Renderers.renderHTMLElement({
      type: 'span',
      props: badgeProps,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    })
  },

  customHTML: ({ elementProps, content, component }) => {
    const trustedContent = (component as { trustedContent?: unknown } | undefined)?.trustedContent
    if (typeof trustedContent === 'string') {
      return Renderers.renderCustomHTML(elementProps, trustedContent, true)
    }
    return Renderers.renderCustomHTML(elementProps, content)
  },

  'language-switcher': ({ elementProps, languages }) =>
    Renderers.renderLanguageSwitcher(elementProps, languages),

  searchInput: ({ elementProps }) => Renderers.renderSearchInput(elementProps),
}
