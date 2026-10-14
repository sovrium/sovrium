/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `crud` delete button: a host the crud-form island mounts its delete view
 * into, with a server-drawn button standing in until it does. Split out of
 * `crud-form-renderer.tsx` so that file stays under its size ceiling.
 *
 * The button's in-flight word arrives on the props as
 * `data-action-pending-label` — resolved in the page language by the button
 * schema overlay (`button-pending-label.ts`), the action's own `pendingLabel`
 * first — and rides into the island props rather than onto the host. Its
 * resting word, when it declares no `content`, arrives the same way.
 *
 * Who is offered the button at all is the page's CRUD gate
 * (`page-crud-gating.tsx`), from the table's `permissions.delete`.
 */

import { type ReactElement } from 'react'
import { omitInternalMarkers } from '../../props/internal-marker-props'
import { DELETE_LABEL_ATTR, PENDING_LABEL_ATTR } from '../button-pending-label'
import { buildCrudIslandProps } from './crud-form-island-props'
import type { ElementProps } from '../html-element-renderer'
import type { CrudFormAction } from './crud-form-types'
import type { RouteParams } from '@/domain/kernel/matching/route-matcher'

type DeleteButtonConfig = {
  readonly props: ElementProps
  readonly content: string | undefined
  readonly action: CrudFormAction
  readonly routeParams?: RouteParams
}

function buildDeleteButtonAttrs(action: CrudFormAction): Record<string, unknown> {
  return {
    'data-action-type': 'crud',
    'data-action-method': 'delete',
    'data-action-table': action.table,
    ...(action.onSuccess?.navigate && { 'data-on-success-redirect': action.onSuccess.navigate }),
    ...(action.confirm && { 'data-confirm': 'true' }),
    ...(action.confirmMessage && { 'data-confirm-message': action.confirmMessage }),
  }
}

export function renderCrudDeleteButton(config: DeleteButtonConfig): ReactElement {
  const { props, content, action, routeParams } = config
  const record = (props._record ?? {}) as Record<string, unknown>
  const {
    [PENDING_LABEL_ATTR]: pendingLabel,
    [DELETE_LABEL_ATTR]: restingLabel,
    ...restProps
  } = omitInternalMarkers(props) as Record<string, unknown>
  const label = content ?? (typeof restingLabel === 'string' ? restingLabel : 'Delete')
  const recordId = String(record['id'] ?? routeParams?.['id'] ?? '')
  const islandProps = buildCrudIslandProps({
    operation: 'delete',
    action,
    fields: [],
    recordId,
    testId: restProps['data-testid'],
    id: restProps['id'],
    buttonLabel: label,
    ...(typeof pendingLabel === 'string' ? { pendingLabel } : {}),
  })
  const buttonAttrs = buildDeleteButtonAttrs(action)

  return (
    <div
      {...(restProps as ElementProps)}
      data-island="crud-form"
      data-island-props={islandProps}
    >
      <button {...buttonAttrs}>{label}</button>
    </div>
  )
}
