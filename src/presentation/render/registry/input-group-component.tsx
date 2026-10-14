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
 * ─── THE BOX IS THE COMPONENT ──────────────────────────────────────────────
 *
 * Drawn on shadcn/ui's `InputGroup` anatomy: an addon does not decorate the
 * field, it shares one box with it. The border, the radius and the focus ring
 * belong to the `role="group"` element, and the field and its addons sit inside
 * it borderless. Every one of those is a rule about the PAIR, which is why this
 * is a type rather than a prop on `input` — expressing it as `input.prefix`
 * would put the pair's rules inside the shape of one of its halves.
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
  computeInputGroupClasses,
  computeInputGroupFieldClasses,
  computeInputGroupKbdClasses,
  computeInputGroupLabelClasses,
  computeInputGroupRootClasses,
  computeInputGroupTextareaClasses,
  type InputGroupActionSize,
  type InputGroupActionVariant,
  type InputGroupAddonAlign,
} from '../../design/input-group-default-classes'
import { LucideGlyph } from '../../design/lucide-glyph'
import { resolveLucideIconNode } from '../elements/lucide-resolver'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/** The control attached to the trailing edge, as the schema declares it. */
interface InputGroupAction {
  readonly label: string
  readonly href: string
  readonly variant?: InputGroupActionVariant
  readonly size?: InputGroupActionSize
}

/** One declared addon. */
interface InputGroupAddon {
  readonly align?: InputGroupAddonAlign
  readonly text?: string
  readonly icon?: string
  readonly kbd?: string
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
/**
 * A text addon: shadcn/ui's `InputGroupAddon` at its alignment, keeping the
 * `data-input-group-prefix` / `-suffix` marker that names which side it is.
 */
const renderAddon = (align: 'inline-start' | 'inline-end', content: string): ReactElement => (
  <div
    data-input-group-prefix={align === 'inline-start' ? '' : undefined}
    data-input-group-suffix={align === 'inline-end' ? '' : undefined}
    data-slot="input-group-addon"
    data-align={align}
    className={computeInputGroupAddonClasses({ align, content })}
  >
    {content}
  </div>
)

/** A declared addon: its icon, key hint or text, at its alignment. */
const renderDeclaredAddon = (addon: InputGroupAddon, index: number): ReactElement => {
  const align = addon.align ?? 'inline-start'
  return (
    <div
      key={`addon-${String(index)}`}
      data-slot="input-group-addon"
      data-align={align}
      className={computeInputGroupAddonClasses({ align })}
    >
      {addon.icon === undefined ? undefined : (
        <LucideGlyph
          iconNode={resolveLucideIconNode(addon.icon)}
          name={addon.icon}
          aria-hidden="true"
        />
      )}
      {addon.text}
      {addon.kbd === undefined ? undefined : (
        <kbd
          data-slot="kbd"
          className={computeInputGroupKbdClasses()}
        >
          {addon.kbd}
        </kbd>
      )}
    </div>
  )
}

/** The declared addons, when there are any. */
const addonsOf = (source: Readonly<Record<string, unknown>>): readonly InputGroupAddon[] =>
  Array.isArray(source['addons']) ? (source['addons'] as readonly InputGroupAddon[]) : []

/** The control: an input, or a textarea when `control: textarea`. */
const renderControl = (
  source: Readonly<Record<string, unknown>>,
  fieldId: string | undefined
): ReactElement =>
  source['control'] === 'textarea' ? (
    <textarea
      id={fieldId}
      name={text(source, 'name')}
      placeholder={text(source, 'placeholder')}
      defaultValue={text(source, 'value')}
      className={computeInputGroupTextareaClasses()}
      data-slot="input-group-control"
    />
  ) : (
    <input
      id={fieldId}
      name={text(source, 'name')}
      type={text(source, 'inputType') ?? 'text'}
      placeholder={text(source, 'placeholder')}
      defaultValue={text(source, 'value')}
      className={computeInputGroupFieldClasses()}
      data-slot="input-group-control"
    />
  )

/** The attached control, a link drawn as shadcn/ui's `InputGroupButton`. */
const renderAction = (action: InputGroupAction): ReactElement => (
  <div
    data-slot="input-group-addon"
    data-align="inline-end"
    className={computeInputGroupAddonClasses({ align: 'inline-end' })}
  >
    <a
      data-input-group-action=""
      data-slot="input-group-button"
      data-variant={action.variant ?? 'ghost'}
      data-size={action.size ?? 'xs'}
      href={action.href}
      className={computeInputGroupActionClasses({ variant: action.variant, size: action.size })}
    >
      {action.label}
    </a>
  </div>
)

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
  return (
    <div
      className={computeInputGroupClasses()}
      data-slot="input-group"
      role="group"
    >
      {prefix === undefined ? undefined : renderAddon('inline-start', prefix)}
      {addonsOf(source).map(renderDeclaredAddon)}
      {renderControl(source, fieldId)}
      {suffix === undefined ? undefined : renderAddon('inline-end', suffix)}
      {action === undefined ? undefined : renderAction(action)}
    </div>
  )
}

export const inputGroupComponent: ComponentRenderer = ({ elementPropsWithSpacing, component }) => {
  const source = (component ?? {}) as Readonly<Record<string, unknown>>
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
          data-slot="field-label"
        >
          {label}
        </label>
      )}
      {renderGroupRow({ source, fieldId })}
    </div>
  )
}
