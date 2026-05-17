/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { renderCrudDeleteButton, type CrudFormAction } from './crud-form-renderer'
import type { ElementProps } from './html-element-renderer'
import type { Tables } from '@/domain/models/app/tables'
import type { RouteParams } from '@/domain/utils/route-matcher'

/**
 * Build data attributes for click interactions
 */
function buildClickDataAttributes(clickInteraction: {
  animation?: string
  navigate?: string
  openUrl?: string
  openInNewTab?: boolean
  scrollTo?: string
  toggleElement?: string
  submitForm?: string
  modal?: string
}): Record<string, string> {
  return {
    ...(clickInteraction.animation && { 'data-click-animation': clickInteraction.animation }),
    ...(clickInteraction.navigate && { 'data-click-navigate': clickInteraction.navigate }),
    ...(clickInteraction.openUrl && { 'data-click-open-url': clickInteraction.openUrl }),
    ...(clickInteraction.openInNewTab !== undefined && {
      'data-click-open-in-new-tab': String(clickInteraction.openInNewTab),
    }),
    ...(clickInteraction.scrollTo && { 'data-click-scroll-to': clickInteraction.scrollTo }),
    ...(clickInteraction.toggleElement && {
      'data-click-toggle-element': clickInteraction.toggleElement,
    }),
    ...(clickInteraction.submitForm && {
      'data-click-submit-form': clickInteraction.submitForm,
    }),
    ...(clickInteraction.modal && { 'data-click-modal': clickInteraction.modal }),
  }
}

type RenderButtonOptions = {
  readonly props: ElementProps
  readonly content: string | undefined
  readonly children: readonly React.ReactNode[]
  readonly interactions?: unknown
  readonly action?: unknown
  readonly tables?: Tables
  readonly routeParams?: RouteParams
  readonly loading?: boolean
}

type AutomationAction = {
  type: 'automation'
  name: string
  await?: boolean
  onSuccess?: { toast?: { message?: string; variant?: string } }
}

/**
 * Returns true if the given action is an automation action
 */
function isAutomationAction(action: unknown): action is AutomationAction {
  return (action as { type?: string })?.type === 'automation'
}

/**
 * Build data attributes for automation actions
 */
function buildAutomationDataAttributes(action: AutomationAction): Record<string, string> {
  return {
    'data-action-type': 'automation',
    'data-action-name': action.name,
    'data-action-await': String(action.await ?? false),
    ...(action.onSuccess?.toast?.message && {
      'data-on-success-message': action.onSuccess.toast.message,
    }),
    ...(action.onSuccess?.toast?.variant && {
      'data-on-success-variant': action.onSuccess.toast.variant,
    }),
  }
}

/**
 * Returns true if the given action is a CRUD delete action
 */
function isCrudDeleteAction(action: unknown): action is CrudFormAction {
  return (
    (action as CrudFormAction)?.type === 'crud' &&
    (action as CrudFormAction)?.operation === 'delete'
  )
}

/**
 * Renders an automation action button with data attributes for client-side handling
 */
function renderAutomationButton(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[],
  action: AutomationAction
): ReactElement {
  const automationAttrs = buildAutomationDataAttributes(action)
  const label = (props.label ?? props['data-label']) as string | undefined
  const { label: _label, 'data-label': _dataLabel, ...restProps } = props as Record<string, unknown>
  const buttonContent = content || (children.length > 0 ? children : undefined) || label
  return (
    <button
      {...restProps}
      {...automationAttrs}
    >
      {buttonContent}
    </button>
  )
}

const LoadingSpinner = (
  <svg
    className="animate-spin"
    data-loading="true"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      opacity="0.25"
    />
    <path
      fill="currentColor"
      opacity="0.75"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
)

/**
 * Renders a disabled button with a spinner for loading state
 */
function renderLoadingButton(
  buttonProps: Record<string, unknown>,
  buttonContent: React.ReactNode
): ReactElement {
  return (
    <button
      {...buttonProps}
      disabled
    >
      {LoadingSpinner}
      {buttonContent}
    </button>
  )
}

/**
 * Renders button element with click interactions
 */
export function renderButton({
  props,
  content,
  children,
  interactions,
  action,
  tables,
  routeParams,
  loading,
}: RenderButtonOptions): ReactElement {
  if (isCrudDeleteAction(action)) {
    return renderCrudDeleteButton({ props, content, action, tables, routeParams })
  }

  if (isAutomationAction(action)) {
    return renderAutomationButton(props, content, children, action)
  }

  const interactionsTyped = interactions as
    | {
        click?: {
          animation?: string
          navigate?: string
          openUrl?: string
          openInNewTab?: boolean
          scrollTo?: string
          toggleElement?: string
          submitForm?: string
          modal?: string
        }
      }
    | undefined
  const clickInteraction = interactionsTyped?.click

  // Extract label from props as fallback button text
  const label = (props.label ?? props['data-label']) as string | undefined
  const { label: _label, 'data-label': _dataLabel, ...restProps } = props as Record<string, unknown>

  // Store interaction data in data attributes for client-side JavaScript handler
  const buttonProps = clickInteraction
    ? { ...restProps, ...buildClickDataAttributes(clickInteraction) }
    : restProps

  const buttonContent = content || (children.length > 0 ? children : undefined) || label

  if (loading) {
    return renderLoadingButton(buttonProps, buttonContent)
  }

  return <button {...buttonProps}>{buttonContent}</button>
}
