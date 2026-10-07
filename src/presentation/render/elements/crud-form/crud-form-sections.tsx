/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, type ReactNode } from 'react'
import {
  type FormSectionLayout,
  groupFieldsIntoSections,
} from '@/domain/models/app/pages/components/component-types/data/form/sections-service'
import {
  computeFormGroupClasses,
  computeFormGroupLabelClasses,
  computeFormHelpTextClasses,
} from '../../../design/form-layout-classes'
import type { ResolvedFieldDef } from './crud-form-types'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * The page form's `sections`, with each title and description passed through
 * `localize` (a `$t:key` resolves in the page language). `undefined` when the
 * form declares none — the form then draws its fields as one run.
 */
export function readFormSections(
  component: Component | undefined,
  localize: (text: string) => string
): readonly FormSectionLayout[] | undefined {
  const { sections } = (component ?? {}) as {
    readonly sections?: readonly FormSectionLayout[]
  }
  if (sections === undefined || sections.length === 0) return undefined
  return sections.map((section) => ({
    title: localize(section.title),
    ...(section.description !== undefined && { description: localize(section.description) }),
    fields: section.fields,
  }))
}

/**
 * The server-rendered field run of a sectioned form: one `fieldset` per
 * section, named by its `legend`, with the description inside it, then every
 * field no section lists. The island draws the same structure from the same
 * grouping, so the page does not shift when it takes over.
 */
export function renderSectionedFields(
  fields: readonly ResolvedFieldDef[],
  sections: readonly FormSectionLayout[] | undefined,
  renderField: (field: ResolvedFieldDef) => ReactNode
): ReactElement {
  const grouped = groupFieldsIntoSections(fields, sections)
  return (
    <>
      {grouped.sections.map((section) => (
        <fieldset
          key={section.title}
          className={computeFormGroupClasses()}
        >
          {/* The title is the group's name AND a heading, so a reader can jump to it. */}
          <legend>
            <h2 className={computeFormGroupLabelClasses()}>{section.title}</h2>
          </legend>
          {section.description !== undefined && (
            <p className={computeFormHelpTextClasses()}>{section.description}</p>
          )}
          {section.fields.map(renderField)}
        </fieldset>
      ))}
      {grouped.rest.map(renderField)}
    </>
  )
}
