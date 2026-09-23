/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `input-group` — an input with a leading addon, a trailing addon, or an
 * attached control.
 *
 * ─── THE SEAM IS THE COMPONENT ─────────────────────────────────────────────
 *
 * An addon does not decorate the box, it CHANGES it: the field loses the corner
 * radius it shares with the addon, the two agree on one height, and their edges
 * touch. Every one of those is a rule about the PAIR, which is why this is a
 * type rather than a prop on `input` — expressing it as `input.prefix` would put
 * the pair's rules inside the shape of one of its halves.
 *
 * ─── AND THE ADDON IS OUTSIDE THE VALUE, STRUCTURALLY ──────────────────────
 *
 * The `€` lives in a `<span>` beside the `<input>`, never in its `value`. That
 * is not a formatting choice: a renderer that prefilled `€4120.00` would look
 * identical on screen and write the currency sign into the record.
 *
 * ─── THE LABEL REACHES THE FIELD, NEVER AN ADDON ───────────────────────────
 *
 * An addon is not a control, and a screen reader announcing "Weight, kg" as the
 * field is the failure the explicit `htmlFor` exists to prevent. The id is
 * derived from `name` — the value a submission is keyed by, so two groups that
 * could collide are already two groups the form itself could not tell apart.
 *
 * Source: src/domain/models/app/pages/components/component-types/form-controls/input-group.ts
 * Specs: [internal ref]
 */

import {
  computeInputGroupActionClasses,
  computeInputGroupAddonClasses,
  computeInputGroupFieldClasses,
  computeInputGroupLabelClasses,
  computeInputGroupRootClasses,
  computeInputGroupRowClasses,
} from '../../design/forms-default-classes'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/** The control attached to the trailing edge, as the schema declares it. */
interface InputGroupAction {
  readonly label: string
  readonly href: string
}

/** Read one string field off a component definition. */
const text = (source: Readonly<Record<string, unknown>>, key: string): string | undefined => {
  const value = source[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * The id the label points at.
 *
 * Derived from `name` when there is one, because that is what a submitted value
 * is keyed by: two groups sharing a name are already indistinguishable to the
 * form. Falling back to a slug of the label keeps an unnamed, labelled group
 * reachable by `getByLabel` — the association is what a screen-reader user gets,
 * and it must not depend on the author having declared a form field name.
 */
const fieldIdOf = (name: string | undefined, label: string | undefined): string | undefined => {
  if (name !== undefined) return `input-group-${name}`
  if (label === undefined || label === '') return undefined
  return `input-group-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`
}

/** The attached control, when the author declared one. */
const actionOf = (source: Readonly<Record<string, unknown>>): InputGroupAction | undefined => {
  const declared = source['action']
  return typeof declared === 'object' && declared !== null
    ? (declared as InputGroupAction)
    : undefined
}

/**
 * The row: the leading addon, the field, the trailing addon, the control.
 *
 * The trailing edge is "attached" when EITHER a suffix or an action sits there.
 * Both are boxes the field's corner meets, and asking which one it was would
 * give two answers to one geometric question.
 */
const renderGroupRow = ({
  source,
  fieldId,
}: {
  readonly source: Readonly<Record<string, unknown>>
  readonly fieldId: string | undefined
}): ReactElement => {
  const prefix = text(source, 'prefix')
  const suffix = text(source, 'suffix')
  const action = actionOf(source)
  const seam = {
    leading: prefix !== undefined,
    trailing: suffix !== undefined || action !== undefined,
  }
  return (
    <div className={computeInputGroupRowClasses()}>
      {prefix === undefined ? undefined : (
        <span
          data-input-group-prefix=""
          className={computeInputGroupAddonClasses({ side: 'leading', content: prefix })}
        >
          {prefix}
        </span>
      )}
      <input
        id={fieldId}
        name={text(source, 'name')}
        type={text(source, 'inputType') ?? 'text'}
        placeholder={text(source, 'placeholder')}
        defaultValue={text(source, 'value')}
        className={computeInputGroupFieldClasses(seam)}
      />
      {suffix === undefined ? undefined : (
        <span
          data-input-group-suffix=""
          className={computeInputGroupAddonClasses({ side: 'trailing', content: suffix })}
        >
          {suffix}
        </span>
      )}
      {action === undefined ? undefined : (
        <a
          data-input-group-action=""
          href={action.href}
          className={computeInputGroupActionClasses()}
        >
          {action.label}
        </a>
      )}
    </div>
  )
}

/** `input-group` — the label, then the row of addons and the field. */
export const inputGroupComponent: ComponentRenderer = ({ elementPropsWithSpacing, component }) => {
  const source = (component ?? {}) as unknown as Readonly<Record<string, unknown>>
  const label = text(source, 'label')
  const fieldId = fieldIdOf(text(source, 'name'), label)
  const { className: authorClassName, ...rest } = omitInternalMarkers(elementPropsWithSpacing)

  return (
    <div
      {...rest}
      className={mergePrestyle(
        computeInputGroupRootClasses(),
        authorClassName as string | undefined
      )}
    >
      {label === undefined ? undefined : (
        <label
          htmlFor={fieldId}
          className={computeInputGroupLabelClasses()}
        >
          {label}
        </label>
      )}
      {renderGroupRow({ source, fieldId })}
    </div>
  )
}
