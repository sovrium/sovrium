/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Renderers from '../../renderers/element-renderers'
import { buildConfirmAttributes } from '../../renderers/element-renderers/button-action-builders'
import {
  computeButtonDefaultClasses,
  type ButtonSize,
  type ButtonState,
  type ButtonVariant,
} from '../../renderers/element-renderers/recipes/button-default-classes'
import {
  computeAlertClasses,
  computeBadgeClasses,
  computeStatusBadgeDotClasses,
  computeStatusBadgeWrapperClasses,
  type AlertVariant,
  type BadgeVariant,
  type StatusDotColor,
} from '../../renderers/element-renderers/recipes/feedback-default-classes'
import {
  computeInputDefaultClasses,
  type InputState,
} from '../../renderers/element-renderers/recipes/input-default-classes'
import { convertBadgeProps } from '../component-registry-helpers'
import { buildIconClassName, buildLinkClassName, variantFromButtonClassName } from './interactive-prestyle-builders'
import { pickCompField, resolveUploadActionUrl } from './island-overlay-props-builders'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

const STATUS_DOT_COLORS = new Set<StatusDotColor>([
  'green',
  'red',
  'amber',
  'yellow',
  'blue',
  'gray',
])

function resolveStatusDotColor(value: unknown): StatusDotColor {
  return typeof value === 'string' && STATUS_DOT_COLORS.has(value as StatusDotColor)
    ? (value as StatusDotColor)
    : 'gray'
}

const BADGE_VARIANTS = new Set<BadgeVariant>(['default', 'secondary', 'destructive', 'outline'])

function buildBadgeClassName(
  componentRaw: Record<string, unknown>,
  authorClassName: string | undefined
): string {
  const rawVariant = componentRaw['badgeVariant']
  const variant = BADGE_VARIANTS.has(rawVariant as BadgeVariant)
    ? (rawVariant as BadgeVariant)
    : undefined
  const defaults = computeBadgeClasses({ variant })
  return authorClassName ? `${defaults} ${authorClassName}` : defaults
}

const ALERT_VARIANTS = new Set<AlertVariant>([
  'default',
  'destructive',
  'warning',
  'info',
  'success',
])

function buildAlertClassName(
  componentRaw: Record<string, unknown>,
  authorClassName: string | undefined
): string {
  const rawVariant = componentRaw['alertVariant'] ?? componentRaw['variant']
  const variant = ALERT_VARIANTS.has(rawVariant as AlertVariant)
    ? (rawVariant as AlertVariant)
    : undefined
  const defaults = computeAlertClasses({ variant })
  return authorClassName ? `${defaults} ${authorClassName}` : defaults
}

function overlayButtonSchemaFallbacks(
  elementProps: Record<string, unknown>,
  componentRaw: Record<string, unknown>
): Record<string, unknown> {
  const topLabel =
    typeof componentRaw['label'] === 'string' ? (componentRaw['label'] as string) : undefined
  return {
    ...elementProps,
    ...(topLabel !== undefined && elementProps.label === undefined ? { label: topLabel } : {}),
    ...buildConfirmAttributes(componentRaw['confirm'], elementProps),
  }
}

const BUTTON_VARIANTS = new Set<ButtonVariant>([
  'default',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link',
  'fab',
])
const BUTTON_SIZES = new Set<ButtonSize>(['sm', 'md', 'lg'])

function buildButtonClassName(
  componentRaw: Record<string, unknown>,
  authorClassName: string | undefined,
  state: ButtonState
): string {
  const rawVariant = componentRaw['variant']
  const rawSize = componentRaw['size']
  const variant = BUTTON_VARIANTS.has(rawVariant as ButtonVariant)
    ? (rawVariant as ButtonVariant)
    : variantFromButtonClassName(authorClassName)
  const size = BUTTON_SIZES.has(rawSize as ButtonSize) ? (rawSize as ButtonSize) : undefined
  const defaults = computeButtonDefaultClasses({ variant, size, state })
  return authorClassName ? `${defaults} ${authorClassName}` : defaults
}

function deriveInputState(elementProps: Record<string, unknown>): InputState {
  if (elementProps['disabled'] === true) return 'disabled'
  const ariaInvalid = elementProps['aria-invalid']
  if (ariaInvalid === true || ariaInvalid === 'true') return 'error'
  if (elementProps['readOnly'] === true || elementProps['readonly'] === true) return 'readonly'
  return 'default'
}

function buildInputClassName(
  elementProps: Record<string, unknown>,
  authorClassName: string | undefined
): string {
  const state = deriveInputState(elementProps)
  const defaults = computeInputDefaultClasses({ state })
  return authorClassName ? `${defaults} ${authorClassName}` : defaults
}

const renderFormFromDispatch: ComponentRenderer = (cfg) =>
  Renderers.renderForm({
    props: cfg.elementProps,
    children: cfg.renderedChildren,
    action: cfg.action,
    tables: cfg.tables,
    buckets: cfg.buckets,
    component: cfg.component,
    lang: cfg.currentLang,
    languages: cfg.languages,
    landingPath: cfg.landingPath,
  })

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
    const propsWithSchemaFallbacks = overlayButtonSchemaFallbacks(elementProps, c)
    const loading = c['loading'] as boolean | undefined
    const disabled = propsWithSchemaFallbacks['disabled'] === true
    const buttonState: ButtonState = loading ? 'loading' : disabled ? 'disabled' : 'default'
    const mergedClassName = buildButtonClassName(
      c,
      propsWithSchemaFallbacks.className as string | undefined,
      buttonState
    )

    return Renderers.renderButton({
      props: { ...propsWithSchemaFallbacks, className: mergedClassName },
      content,
      children: renderedChildren,
      interactions,
      action,
      tables,
      routeParams,
      loading,
    })
  },

  link: ({ elementProps, content, renderedChildren, component }) => {
    const className = buildLinkClassName(
      (component ?? {}) as Record<string, unknown>,
      elementProps['className'] as string | undefined
    )
    return Renderers.renderLink({ ...elementProps, className }, content, renderedChildren)
  },

  alert: ({ elementProps, content, renderedChildren, theme, component }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const mergedClassName = buildAlertClassName(c, elementProps.className as string | undefined)
    return Renderers.renderAlert(
      { ...elementProps, className: mergedClassName },
      content,
      renderedChildren,
      theme
    )
  },

  form: (cfg) => renderFormFromDispatch(cfg),

  'data-form': (cfg) => renderFormFromDispatch(cfg),

  input: ({ elementProps }) => {
    const mergedClassName = buildInputClassName(
      elementProps,
      elementProps.className as string | undefined
    )
    return Renderers.renderInput({ ...elementProps, className: mergedClassName })
  },


  'time-picker': ({ elementProps, component, rawProps }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const timeFormat = c['timeFormat'] as string | undefined
    const minTime = c['minTime'] as string | undefined
    const maxTime = c['maxTime'] as string | undefined
    const minuteStep = c['minuteStep'] as number | undefined
    const label = rawProps?.['label'] as string | undefined
    const stepSeconds = typeof minuteStep === 'number' ? minuteStep * 60 : undefined
    return Renderers.renderTimePicker({
      props: elementProps,
      label,
      timeFormat,
      minTime,
      maxTime,
      stepSeconds,
    })
  },

  'date-picker': ({ elementProps, component, rawProps }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const dateFormat = c['dateFormat'] as string | undefined
    const minDate = c['minDate'] as string | undefined
    const maxDate = c['maxDate'] as string | undefined
    const datePickerMode = c['datePickerMode'] as 'single' | 'range' | undefined
    const label = rawProps?.['label'] as string | undefined
    const placeholder = rawProps?.['placeholder'] as string | undefined
    const disabled = rawProps?.['disabled'] as boolean | undefined
    const name = rawProps?.['name'] as string | undefined
    const islandProps = {
      id: elementProps.id as string | undefined,
      label,
      placeholder,
      dateFormat,
      minDate,
      maxDate,
      datePickerMode,
      disabled,
      name,
    }
    return Renderers.renderDatePickerIsland({
      props: elementProps,
      islandProps,
      label,
      placeholder,
      disabled,
    })
  },

  'number-input': ({ elementProps, component, rawProps }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const min = c['min'] as number | undefined
    const max = c['max'] as number | undefined
    const step = c['step'] as number | undefined
    const defaultValue = c['defaultValue'] as number | undefined
    const showStepper = c['showStepper'] as boolean | undefined
    const label = rawProps?.['label'] as string | undefined
    const disabled = rawProps?.['disabled'] as boolean | undefined
    const name = rawProps?.['name'] as string | undefined
    const islandProps = {
      id: elementProps.id as string | undefined,
      label,
      min,
      max,
      step,
      defaultValue,
      showStepper,
      disabled,
      name,
    }
    return Renderers.renderNumberInputIsland({
      props: elementProps,
      islandProps,
      label,
      min,
      max,
      step,
      defaultValue,
      showStepper,
    })
  },

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
    const accept = pickCompField<string>(c, rawProps, 'accept')
    const maxFiles = pickCompField<number>(c, rawProps, 'maxFiles')
    const dropZone = pickCompField<boolean>(c, rawProps, 'dropZone')
    const maxFileSize = pickCompField<number>(c, rawProps, 'maxFileSize')
    const disabled = rawProps?.['disabled'] as boolean | undefined
    const label = rawProps?.['label'] as string | undefined
    const uploadActionUrl = resolveUploadActionUrl(pickCompField(c, rawProps, 'uploadAction'))
    const onSuccess = pickCompField(c, rawProps, 'onSuccess')
    const onError = pickCompField(c, rawProps, 'onError')

    if (dropZone === true || uploadActionUrl !== undefined) {
      const islandProps = {
        accept,
        maxFiles,
        maxFileSize,
        dropZone,
        disabled,
        label,
        uploadAction: uploadActionUrl,
        onSuccess,
        onError,
        id: elementProps.id as string | undefined,
        className: elementProps.className as string | undefined,
        'data-testid': elementProps['data-testid'] as string | undefined,
      }
      return Renderers.renderFileUploadIsland({
        props: elementProps,
        islandProps,
        accept,
        maxFiles,
        dropZone,
        disabled,
        label,
      })
    }

    return Renderers.renderFileUpload({
      props: elementProps,
      accept,
      maxFiles,
      dropZone,
      disabled,
      label,
    })
  },

  icon: ({ elementProps, renderedChildren, component }) => {
    const className = buildIconClassName(
      (component ?? {}) as Record<string, unknown>,
      elementProps['className'] as string | undefined
    )
    return Renderers.renderIcon({ ...elementProps, className }, renderedChildren)
  },

  badge: ({ elementProps, content, renderedChildren, interactions, component }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const authorClassName = elementProps['className'] as string | undefined

    const { variant } = c
    if (variant === 'status') {
      const { status } = c
      const statusColor = resolveStatusDotColor(c['statusColor'])
      const pulse = c['pulse'] === true
      const dotClassName = computeStatusBadgeDotClasses({ color: statusColor, pulse })
      const wrapperDefaults = computeStatusBadgeWrapperClasses()
      const mergedWrapperClassName = authorClassName
        ? `${wrapperDefaults} ${authorClassName}`
        : wrapperDefaults
      const badgePropsForStatus = convertBadgeProps({
        ...elementProps,
        className: mergedWrapperClassName,
      })
      const statusLabel = typeof status === 'string' ? status : undefined
      return Renderers.renderStatusBadge({
        props: badgePropsForStatus,
        dotClassName,
        label: statusLabel,
      })
    }

    const mergedClassName = buildBadgeClassName(c, authorClassName)
    const badgeProps = convertBadgeProps({ ...elementProps, className: mergedClassName })

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

  pageSearch: ({ elementProps, component }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const placeholder = c['placeholder'] as string | undefined
    const maxResults = c['maxResults'] as number | undefined
    return Renderers.renderPageSearch({ props: elementProps, placeholder, maxResults })
  },
}
