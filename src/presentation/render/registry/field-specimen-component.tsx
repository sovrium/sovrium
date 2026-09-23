/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The dispatcher entry for `field-specimen`.
 *
 * ─── WHY THIS EXISTS WHEN A RENDER-TIME PASS ALREADY EXPANDS THE TYPE ───────
 *
 * `expandFieldSpecimens` (`presentation/rendering/field-specimen-resolver.ts`)
 * rewrites every `field-specimen` node into a pre-rendered `customHTML`
 * equivalent before the page is dispatched, so on the ordinary path this
 * renderer is never reached.
 *
 * It is not therefore dead, and calling it a fallback undersells what it is
 * for. That walk recurses through `children`, which covers every position an
 * author writes a specimen in today — but "today" is the whole problem. A
 * specimen placed somewhere the walk does not reach would fall through
 * `dispatchComponentType` to a bare `<div>`: the page would boot, the config
 * would validate, nothing would go red, and the component simply would not be
 * what the author asked for. That is the exact silent failure
 * `check-component-renderer-drift` exists to make impossible, and the reason it
 * requires every schema type to have an entry here.
 *
 * The two allow-lists it offers instead were both measured and neither fits:
 * `RENDERED_BY_PARENT` describes a type a PARENT renderer consumes structurally
 * (a `tab-panel` folded into the tabs island), and no parent consumes this one;
 * `RENDER_TIME_ONLY` describes a type that is never schema-authored, and this
 * one is authored by definition — `command-palette` was removed from that list
 * on exactly that ground the day it became a real schema type.
 *
 * ─── ONE CONTROL, WHICHEVER PATH REACHES IT ─────────────────────────────────
 *
 * So this renders through the SAME `renderFieldSpecimen` the expansion pass
 * spends, via the same normalisation. A specimen drawn here and a specimen
 * drawn by the pass are the same markup, because a second drawing of a field
 * type is a second answer to the question the catalogue exists to answer once.
 *
 * The markup is emitted with `dangerouslySetInnerHTML` for the reason the
 * expansion uses `trustedContent` rather than `content`: the HTML comes from the
 * crud-form renderer and never from user input, and the rich-text allowlist
 * sanitiser `content` would run drops every interactive element — `<input>`,
 * `<select>`, `<textarea>`, `<label>` — which would strip a field specimen to
 * bare label text. A schema author cannot supply it: the string is produced
 * here from a decoded `fieldType`, which the boot-time rule has already checked
 * against the field catalogue.
 */

import { fieldSpecimenMarkup } from '@/presentation/render/resolve/field-specimen-resolver'
import { omitInternalMarkers } from '../props/internal-marker-props'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/** Read a string member off the decoded component, or `undefined`. */
const text = (component: unknown, key: string): string | undefined => {
  const value = (component as Record<string, unknown> | undefined)?.[key]
  return typeof value === 'string' ? value : undefined
}

/** Read a boolean member off the decoded component, or `undefined`. */
const flag = (component: unknown, key: string): boolean | undefined => {
  const value = (component as Record<string, unknown> | undefined)?.[key]
  return typeof value === 'boolean' ? value : undefined
}

/** Read a string-array member off the decoded component, or `undefined`. */
const list = (component: unknown, key: string): readonly string[] | undefined => {
  const value = (component as Record<string, unknown> | undefined)?.[key]
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? (value as readonly string[])
    : undefined
}

export const fieldSpecimenComponent: ComponentRenderer = ({
  elementPropsWithSpacing,
  component,
}): ReactElement => {
  const fieldType = text(component, 'fieldType') ?? ''
  const { html, attributes } = fieldSpecimenMarkup({
    fieldType,
    ...(text(component, 'name') === undefined ? {} : { name: text(component, 'name') }),
    ...(text(component, 'label') === undefined ? {} : { label: text(component, 'label') }),
    ...(list(component, 'options') === undefined ? {} : { options: list(component, 'options') }),
    ...(text(component, 'placeholder') === undefined
      ? {}
      : { placeholder: text(component, 'placeholder') }),
    ...(text(component, 'description') === undefined
      ? {}
      : { description: text(component, 'description') }),
    ...(text(component, 'value') === undefined ? {} : { value: text(component, 'value') }),
    ...(flag(component, 'compact') === undefined ? {} : { compact: flag(component, 'compact') }),
  })

  return (
    <div
      {...omitInternalMarkers(elementPropsWithSpacing)}
      {...attributes}
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- the markup IS the specimen; a stateless SSR renderer emitting it once, on the same footing as the swatch painting its own colour. The HTML comes from the crud-form renderer over a decoded `fieldType` the boot rule already checked against the field catalogue, never from user input — and `content` is not an alternative, since its rich-text allowlist sanitiser drops every interactive element and would strip the specimen to bare label text.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
