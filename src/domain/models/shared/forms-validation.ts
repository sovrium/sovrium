/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Forms cross-validation
 *
 * Bundled into a single helper to keep the AppSchema `.pipe()` chain short
 * (TypeScript's deep-instantiation depth limit is hit when too many
 * `Schema.filter` calls stack on top of `Schema.Struct`).
 *
 * Each rule short-circuits with a string error message when violated;
 * returns `true` when all rules pass.
 */

/**
 * Compound condition shape used for cross-validation. Mirrors
 * `VisibleWhenCondition` from `./visible-when.ts` but kept structurally
 * compatible to avoid the schema-import cost in this file.
 */
type ConditionRuleShape =
  | {
      readonly field: string
      readonly operator: string
      readonly value?: unknown
    }
  | { readonly and: ReadonlyArray<ConditionRuleShape> }
  | { readonly or: ReadonlyArray<ConditionRuleShape> }

/**
 * Per-field shape used for cross-validation. The discriminated `kind`
 * preserves the runtime shape so we can lookup `column` / `name` without
 * paying the cost of importing FormFieldSchema's full type tree here.
 */
interface FormFieldShape {
  readonly kind: 'table-field' | 'standalone' | 'calculation' | 'section' | 'signature'
  readonly column?: string
  readonly name?: string
  readonly inputType?: string
  readonly defaultValue?: string | number | boolean
  readonly hidden?: boolean
  readonly visibleWhen?: ConditionRuleShape
  readonly requiredWhen?: ConditionRuleShape
  readonly disabledWhen?: ConditionRuleShape
}

interface FormStepShape {
  readonly id: string
  readonly fields: ReadonlyArray<string>
  readonly visibleWhen?: ConditionRuleShape
  readonly goToWhen?: ReadonlyArray<{
    readonly when: ConditionRuleShape
    readonly goTo: string
  }>
}

interface FormShape {
  readonly id: number
  readonly name: string
  readonly path?: string
  readonly submitTo: {
    readonly table?: string
    readonly automation?: string
    readonly mapping?: Readonly<Record<string, string>>
  }
  readonly fields?: ReadonlyArray<FormFieldShape>
  readonly layout?: 'single-page' | 'multi-step' | 'one-question'
  readonly steps?: ReadonlyArray<FormStepShape>
}

interface TableFieldShape {
  readonly name: string
}

interface TableShape {
  readonly name: string
  readonly fields?: ReadonlyArray<TableFieldShape>
}

interface PageShape {
  readonly name: string
  readonly path: string
  readonly components?: ReadonlyArray<Record<string, unknown> & { readonly type: string }>
}

interface AppForFormsValidation {
  readonly forms?: ReadonlyArray<FormShape>
  readonly pages?: ReadonlyArray<PageShape>
  readonly tables?: ReadonlyArray<TableShape>
  readonly automations?: ReadonlyArray<{ readonly name: string }>
}

/**
 * Find the first duplicate value in an array using a key extractor.
 * Returns [priorIndex, currentIndex, key] when a duplicate is found, or undefined.
 *
 * Uses a single reduce pass with an accumulator carrying the seen-map and an
 * optional duplicate hit. Once a duplicate is found, subsequent iterations
 * are no-ops (preserves first-duplicate semantics without early-exit loops).
 */
const findFirstDuplicate = <T, K>(
  items: ReadonlyArray<T>,
  keyOf: (item: T) => K
): readonly [number, number, K] | undefined => {
  type Acc = {
    readonly seen: ReadonlyMap<K, number>
    readonly hit: readonly [number, number, K] | undefined
  }
  const init: Acc = { seen: new Map<K, number>(), hit: undefined }
  return items.reduce<Acc>((acc, item, index) => {
    if (acc.hit !== undefined) return acc
    const key = keyOf(item)
    const prior = acc.seen.get(key)
    if (prior !== undefined) {
      return { seen: acc.seen, hit: [prior, index, key] }
    }
    // Build the next seen-map immutably: create a new Map from concatenated
    // entries so no mutation method (.set) is invoked on a Map reference.
    const nextSeen: ReadonlyMap<K, number> = new Map<K, number>([...acc.seen, [key, index]])
    return { seen: nextSeen, hit: undefined }
  }, init).hit
}

/**
 * Validate name uniqueness across forms[].
 */
const validateNameUniqueness = (forms: ReadonlyArray<FormShape>): string | undefined => {
  if (forms.length < 2) return undefined
  const dup = findFirstDuplicate(forms, (f) => f.name)
  if (dup === undefined) return undefined
  const [prior, index, name] = dup
  return `forms[].name '${name}' is duplicated at forms[${prior}] and forms[${index}]`
}

/**
 * Validate id uniqueness across forms[].
 */
const validateIdUniqueness = (forms: ReadonlyArray<FormShape>): string | undefined => {
  if (forms.length < 2) return undefined
  const dup = findFirstDuplicate(forms, (f) => f.id)
  if (dup === undefined) return undefined
  const [prior, index, id] = dup
  return `forms[].id ${id} is duplicated at forms[${prior}] (name '${forms[prior]?.name}') and forms[${index}] (name '${forms[index]?.name}')`
}

/**
 * Validate path uniqueness across forms[] and across pages[].
 */
const validatePathUniqueness = (
  forms: ReadonlyArray<FormShape>,
  pages: ReadonlyArray<PageShape>
): string | undefined => {
  // First: detect duplicate paths within forms[] (skip undefined paths).
  // findFirstDuplicate compares keys with Map equality; mark forms with
  // undefined paths using a unique symbol so they never collide.
  const dup = findFirstDuplicate(forms, (f): string | symbol => f.path ?? Symbol('no-path'))
  if (dup !== undefined) {
    const [prior, index, key] = dup
    if (typeof key === 'string') {
      return `forms[].path '${key}' is duplicated at forms[${prior}] (name '${forms[prior]?.name}') and forms[${index}] (name '${forms[index]?.name}')`
    }
  }

  // Then: detect form-vs-page path collisions. Page paths have already been
  // validated for uniqueness at the page level by AppSchema; only form-vs-page
  // collisions need checking here.
  return pages.reduce<string | undefined>((acc, page, pageIndex) => {
    if (acc !== undefined) return acc
    const formIndex = forms.findIndex((f) => f.path === page.path)
    if (formIndex >= 0) {
      const form = forms[formIndex]
      return `Path collision: forms[${formIndex}] (name '${form?.name}') and pages[${pageIndex}] (name '${page.name}') both claim path '${page.path}'`
    }
    return undefined
  }, undefined)
}

/**
 * Validate submitTo.table cross-references.
 */
const validateSubmitToTable = (
  forms: ReadonlyArray<FormShape>,
  tableNames: ReadonlySet<string>
): string | undefined =>
  forms.reduce<string | undefined>((acc, form, index) => {
    if (acc !== undefined) return acc
    const target = form.submitTo.table
    if (target !== undefined && !tableNames.has(target)) {
      return `forms[${index}] '${form.name}': submitTo.table '${target}' does not match any tables[].name`
    }
    return undefined
  }, undefined)

/**
 * Validate submitTo.automation cross-references.
 */
const validateSubmitToAutomation = (
  forms: ReadonlyArray<FormShape>,
  automationNames: ReadonlySet<string>
): string | undefined =>
  forms.reduce<string | undefined>((acc, form, index) => {
    if (acc !== undefined) return acc
    const target = form.submitTo.automation
    if (target !== undefined && !automationNames.has(target)) {
      return `forms[${index}] '${form.name}': submitTo.automation '${target}' does not match any automations[].name`
    }
    return undefined
  }, undefined)

interface FormComponentLocator {
  readonly pageIndex: number
  readonly page: PageShape
  readonly componentIndex: number
  readonly component: Record<string, unknown> & { readonly type: string }
}

/**
 * Build a "mutually exclusive with inline X, Y, Z" suffix listing whichever
 * of dataSource/fields/fieldGroups are present on the component.
 */
const inlineConflictsSuffix = (component: Record<string, unknown>): string | undefined => {
  const hasDataSource = component['dataSource'] !== undefined
  const hasFields = component['fields'] !== undefined
  const hasFieldGroups = component['fieldGroups'] !== undefined
  if (!hasDataSource && !hasFields && !hasFieldGroups) return undefined
  return [
    hasDataSource ? 'dataSource' : undefined,
    hasFields ? 'fields' : undefined,
    hasFieldGroups ? 'fieldGroups' : undefined,
  ]
    .filter((c): c is string => c !== undefined)
    .join(', ')
}

/**
 * Validate a single form component on a page.
 */
const validateFormComponent = (
  locator: FormComponentLocator,
  formNames: ReadonlySet<string>
): string | undefined => {
  const { pageIndex, page, componentIndex, component } = locator
  if (component.type !== 'form') return undefined
  const { formRef } = component as { readonly formRef?: unknown }
  if (typeof formRef !== 'string') return undefined
  if (!formNames.has(formRef)) {
    return `pages[${pageIndex}] '${page.name}' components[${componentIndex}]: formRef '${formRef}' does not match any forms[].name`
  }
  const conflicts = inlineConflictsSuffix(component)
  if (conflicts === undefined) return undefined
  return `pages[${pageIndex}] '${page.name}' components[${componentIndex}]: formRef '${formRef}' is mutually exclusive with inline ${conflicts}`
}

/**
 * Validate page form components: `formRef` must reference an existing form,
 * AND `formRef` is mutually exclusive with the inline `dataSource`/`fields`/
 * `fieldGroups` definition.
 */
const validatePageFormRefs = (
  pages: ReadonlyArray<PageShape>,
  formNames: ReadonlySet<string>
): string | undefined =>
  pages.reduce<string | undefined>((pageAcc, page, pageIndex) => {
    if (pageAcc !== undefined) return pageAcc
    if (!page.components) return undefined
    return page.components.reduce<string | undefined>((compAcc, component, componentIndex) => {
      if (compAcc !== undefined) return compAcc
      return validateFormComponent({ pageIndex, page, componentIndex, component }, formNames)
    }, undefined)
  }, undefined)

/**
 * Extract the submitter-facing identifier from a form field. Returns
 * undefined for kinds that have no identifier (sections, calculations have
 * no submitter input — calculations have a name but it's not tied to user
 * input the same way).
 */
const fieldIdentifier = (field: Readonly<FormFieldShape>): string | undefined => {
  if (field.kind === 'table-field') return field.column
  if (field.kind === 'standalone' || field.kind === 'signature' || field.kind === 'calculation') {
    return field.name
  }
  return undefined
}

/**
 * Validate that table-bound fields reference existing columns and that
 * `kind: 'table-field'` is only used when `submitTo.table` is configured.
 */
const validateTableFieldColumns = (
  forms: ReadonlyArray<FormShape>,
  tables: ReadonlyArray<TableShape>
): string | undefined =>
  forms.reduce<string | undefined>((acc, form, formIndex) => {
    if (acc !== undefined) return acc
    const fields = form.fields ?? []
    return fields.reduce<string | undefined>((fieldAcc, field, fieldIndex) => {
      if (fieldAcc !== undefined) return fieldAcc
      if (field.kind !== 'table-field') return undefined
      // `kind: 'table-field'` requires `submitTo.table`.
      if (form.submitTo.table === undefined) {
        return `forms[${formIndex}] '${form.name}' fields[${fieldIndex}]: kind 'table-field' requires submitTo.table to be set`
      }
      // The referenced column must exist on the bound table.
      const table = tables.find((candidate) => candidate.name === form.submitTo.table)
      if (table === undefined) {
        // submitTo.table existence is checked by validateSubmitToTable already;
        // skip here so the more-specific table-not-found error wins first.
        return undefined
      }
      const columnExists =
        field.column !== undefined &&
        (table.fields ?? []).some((tableField) => tableField.name === field.column)
      if (!columnExists) {
        return `forms[${formIndex}] '${form.name}' fields[${fieldIndex}]: column '${field.column}' does not exist on table '${table.name}'`
      }
      return undefined
    }, undefined)
  }, undefined)

/**
 * Validate that every `submitTo.mapping` target column exists on the bound
 * `submitTo.table`. A typo such as `{ fullName: 'ghost_column' }` would
 * otherwise flow through the form-submission program and crash at the SQL
 * layer; catching it at app-load time gives the operator a precise error
 * naming the form, the source field, and the missing target column.
 *
 * Skipped when `submitTo.table` is unset (mapping is meaningless without a
 * table) or when the bound table itself does not exist (the more-specific
 * `validateSubmitToTable` error wins first).
 */
const validateSubmitToMappingTargets = (
  forms: ReadonlyArray<FormShape>,
  tables: ReadonlyArray<TableShape>
): string | undefined =>
  forms.reduce<string | undefined>((acc, form, formIndex) => {
    if (acc !== undefined) return acc
    const { mapping, table: tableName } = form.submitTo
    if (mapping === undefined) return undefined
    if (tableName === undefined) return undefined
    const table = tables.find((candidate) => candidate.name === tableName)
    if (table === undefined) return undefined
    const tableColumnNames = new Set((table.fields ?? []).map((f) => f.name))
    return Object.entries(mapping).reduce<string | undefined>(
      (entryAcc, [sourceField, targetColumn]) => {
        if (entryAcc !== undefined) return entryAcc
        if (tableColumnNames.has(targetColumn)) return undefined
        return `forms[${formIndex}] '${form.name}': submitTo.mapping for form field '${sourceField}' targets column '${targetColumn}' which does not exist on table '${tableName}'`
      },
      undefined
    )
  }, undefined)

/**
 * Validate that field identifiers (column for table-field, name for
 * standalone/signature/calculation) are unique within a single form. This
 * catches both same-kind duplicates ('comment' standalone twice) AND
 * cross-kind collisions (table-field 'email' alongside standalone 'email').
 */
const validateFieldNameUniqueness = (forms: ReadonlyArray<FormShape>): string | undefined =>
  forms.reduce<string | undefined>((acc, form, formIndex) => {
    if (acc !== undefined) return acc
    const fields = form.fields ?? []
    if (fields.length < 2) return undefined
    // findFirstDuplicate compares keys via Map equality. Use a unique symbol
    // for fields that have no identifier (sections) so they never collide.
    const dup = findFirstDuplicate(fields, (f): string | symbol => {
      const id = fieldIdentifier(f)
      return id ?? Symbol('no-identifier')
    })
    if (dup === undefined) return undefined
    const [prior, index, key] = dup
    if (typeof key === 'string') {
      return `forms[${formIndex}] '${form.name}' fields: identifier '${key}' is duplicated at fields[${prior}] and fields[${index}]`
    }
    return undefined
  }, undefined)

/**
 * Allowed prefix references in `defaultValue`. `$query.X`, `$user.X`,
 * `$parent.X`, and `$now` resolve at submit time and are valid for any
 * input type (the resolved value is then coerced).
 */
const isReferenceDefaultValue = (value: unknown): boolean => {
  if (typeof value !== 'string') return false
  if (value === '$now') return true
  return /^\$(query|user|parent)\./.test(value)
}

/**
 * Validate that `defaultValue` matches the field's input type for kinds
 * where we can statically determine the expected JS type. Only the
 * standalone kind is checked here — table-field defaults are coerced
 * against the table column's type at submission time.
 */
const validateDefaultValueTypes = (forms: ReadonlyArray<FormShape>): string | undefined =>
  forms.reduce<string | undefined>((acc, form, formIndex) => {
    if (acc !== undefined) return acc
    const fields = form.fields ?? []
    return fields.reduce<string | undefined>((fieldAcc, field, fieldIndex) => {
      if (fieldAcc !== undefined) return fieldAcc
      if (field.kind !== 'standalone') return undefined
      if (field.defaultValue === undefined) return undefined
      // Allow $-prefixed references; they resolve at submit time.
      if (isReferenceDefaultValue(field.defaultValue)) return undefined
      const expectedJsType = ((): string | undefined => {
        switch (field.inputType) {
          case 'number':
          case 'rating':
            return 'number'
          case 'checkbox':
            return 'boolean'
          default:
            return undefined
        }
      })()
      if (expectedJsType === undefined) return undefined
      const actualType = typeof field.defaultValue
      if (actualType === expectedJsType) return undefined
      return `forms[${formIndex}] '${form.name}' fields[${fieldIndex}] '${field.name ?? ''}': inputType '${field.inputType}' expects a ${expectedJsType} defaultValue but received ${actualType} '${String(field.defaultValue)}'`
    }, undefined)
  }, undefined)

/**
 * APP-FORMS-033 / APP-FORMS-034 helpers — conditional-logic cross-validation.
 *
 * Walks every `visibleWhen` / `requiredWhen` / `disabledWhen` rule on every
 * field of every form. Two checks per simple sub-rule:
 *   - referenced `field` must exist in the same form (matched against the
 *     field's submitter-facing identifier — `column` for table-bound,
 *     `name` for standalone / signature / calculation).
 *   - `operator` must be compatible with the referenced field's column
 *     type when the form is bound to a table; ordered operators
 *     (`gt`/`gte`/`lt`/`lte`) require a numeric or date column.
 */

const NUMERIC_DATE_TABLE_TYPES = new Set([
  'number',
  'currency',
  'rating',
  'date',
  'datetime',
  'time',
])

const NUMERIC_DATE_STANDALONE_INPUTS = new Set(['number', 'date', 'datetime', 'rating'])

/**
 * Resolve the submitter-facing identifier of a field. Mirrors the helper
 * inside `submit-form.ts` but kept inline here to avoid an application-
 * layer import from the domain layer.
 */
const fieldSubmitIdentifier = (field: Readonly<FormFieldShape>): string | undefined => {
  if (field.kind === 'table-field') return field.column
  if (field.kind === 'standalone' || field.kind === 'signature' || field.kind === 'calculation') {
    return field.name
  }
  return undefined
}

/**
 * Walk a (possibly compound) condition and yield every simple sub-rule.
 * Implemented as a flat reduction so callers can feed each leaf rule to
 * the validators below without re-implementing the recursion.
 */
const collectSimpleRules = (
  condition: Readonly<ConditionRuleShape>
): ReadonlyArray<{
  readonly field: string
  readonly operator: string
  readonly value?: unknown
}> => {
  if ('or' in condition) {
    return condition.or.reduce<
      ReadonlyArray<{ readonly field: string; readonly operator: string; readonly value?: unknown }>
    >((acc, child) => [...acc, ...collectSimpleRules(child)], [])
  }
  if ('and' in condition) {
    return condition.and.reduce<
      ReadonlyArray<{ readonly field: string; readonly operator: string; readonly value?: unknown }>
    >((acc, child) => [...acc, ...collectSimpleRules(child)], [])
  }
  return [condition]
}

/**
 * Resolve a table-bound field's column type via lookup against the bound
 * table. Pulled out of `resolveFieldType` so the parent stays under the
 * project's cyclomatic-complexity cap.
 */
const resolveTableBoundType = (
  form: Readonly<FormShape>,
  refField: Readonly<FormFieldShape>,
  tables: ReadonlyArray<TableShape>
): string | undefined => {
  if (form.submitTo.table === undefined) return undefined
  const table = tables.find((candidate) => candidate.name === form.submitTo.table)
  if (table === undefined) return undefined
  const column = (
    table.fields as ReadonlyArray<{ readonly name: string; readonly type?: string }> | undefined
  )?.find((c) => c.name === refField.column)
  return column?.type
}

/**
 * Resolve the column / standalone "type" string for a field reference
 * inside a form. Returns `undefined` when the field is not declared on
 * the form OR when the form is not bound to a table (table-bound fields
 * inherit their type from the bound column).
 */
const resolveFieldType = (
  form: Readonly<FormShape>,
  fieldRef: string,
  tables: ReadonlyArray<TableShape>
): { readonly kind: 'table-field' | 'standalone'; readonly type: string } | undefined => {
  const refField = (form.fields ?? []).find(
    (candidate) => fieldSubmitIdentifier(candidate) === fieldRef
  )
  if (refField === undefined) return undefined
  if (refField.kind === 'table-field') {
    const type = resolveTableBoundType(form, refField, tables)
    if (type === undefined) return undefined
    return { kind: 'table-field', type }
  }
  if (refField.kind === 'standalone' && refField.inputType !== undefined) {
    return { kind: 'standalone', type: refField.inputType }
  }
  return undefined
}

const ORDERED_OPERATORS = new Set(['gt', 'gte', 'lt', 'lte'])

/**
 * APP-FORMS-033: every conditional rule must reference a field that exists
 * on the same form.
 */
const validateConditionalFieldReferences = (forms: ReadonlyArray<FormShape>): string | undefined =>
  forms.reduce<string | undefined>((acc, form, formIndex) => {
    if (acc !== undefined) return acc
    const fields = form.fields ?? []
    const declaredIdentifiers = new Set(
      fields.map((f) => fieldSubmitIdentifier(f)).filter((id): id is string => id !== undefined)
    )
    return fields.reduce<string | undefined>((fieldAcc, field, fieldIndex) => {
      if (fieldAcc !== undefined) return fieldAcc
      const conditions: ReadonlyArray<readonly [string, ConditionRuleShape | undefined]> = [
        ['visibleWhen', field.visibleWhen],
        ['requiredWhen', field.requiredWhen],
        ['disabledWhen', field.disabledWhen],
      ]
      return conditions.reduce<string | undefined>((condAcc, [propName, rule]) => {
        if (condAcc !== undefined) return condAcc
        if (rule === undefined) return undefined
        const simpleRules = collectSimpleRules(rule)
        const missing = simpleRules.find((r) => !declaredIdentifiers.has(r.field))
        if (missing === undefined) return undefined
        return `forms[${formIndex}] '${form.name}' fields[${fieldIndex}]: ${propName} references unknown field '${missing.field}'`
      }, undefined)
    }, undefined)
  }, undefined)

/**
 * APP-FORMS-034: ordered operators (`gt`/`gte`/`lt`/`lte`) require a numeric
 * or date field. Run after APP-FORMS-033 so reference validity is already
 * established for any leaf rule we inspect here.
 */
const validateConditionalOperatorTypes = (
  forms: ReadonlyArray<FormShape>,
  tables: ReadonlyArray<TableShape>
): string | undefined =>
  forms.reduce<string | undefined>((acc, form, formIndex) => {
    if (acc !== undefined) return acc
    const fields = form.fields ?? []
    return fields.reduce<string | undefined>((fieldAcc, field, fieldIndex) => {
      if (fieldAcc !== undefined) return fieldAcc
      const conditions: ReadonlyArray<readonly [string, ConditionRuleShape | undefined]> = [
        ['visibleWhen', field.visibleWhen],
        ['requiredWhen', field.requiredWhen],
        ['disabledWhen', field.disabledWhen],
      ]
      return conditions.reduce<string | undefined>((condAcc, [propName, rule]) => {
        if (condAcc !== undefined) return condAcc
        if (rule === undefined) return undefined
        const simpleRules = collectSimpleRules(rule)
        const offending = simpleRules.find((r) => {
          if (!ORDERED_OPERATORS.has(r.operator)) return false
          const resolved = resolveFieldType(form, r.field, tables)
          if (resolved === undefined) return false
          if (resolved.kind === 'table-field') return !NUMERIC_DATE_TABLE_TYPES.has(resolved.type)
          return !NUMERIC_DATE_STANDALONE_INPUTS.has(resolved.type)
        })
        if (offending === undefined) return undefined
        const resolved = resolveFieldType(form, offending.field, tables)
        const typeLabel = resolved?.type ?? 'unknown'
        return `forms[${formIndex}] '${form.name}' fields[${fieldIndex}]: ${propName} uses operator '${offending.operator}' on field '${offending.field}' of type '${typeLabel}' — ${offending.operator} requires a numeric or date field`
      }, undefined)
    }, undefined)
  }, undefined)

/**
 * APP-FORMS-036: `layout: 'multi-step'` requires `steps[]` to be non-empty.
 * The schema's `Schema.Array(...).pipe(Schema.minItems(1))` already rejects
 * an explicit empty array, but `steps[]` is `optional`, so a missing `steps`
 * key alongside `layout: 'multi-step'` slips through; this rule closes that
 * gap with a focused error message.
 */
const validateMultiStepRequiresSteps = (forms: ReadonlyArray<FormShape>): string | undefined =>
  forms.reduce<string | undefined>((acc, form, formIndex) => {
    if (acc !== undefined) return acc
    if (form.layout !== 'multi-step') return undefined
    const steps = form.steps ?? []
    if (steps.length === 0) {
      return `forms[${formIndex}] '${form.name}': layout 'multi-step' requires steps[] to be non-empty`
    }
    return undefined
  }, undefined)

/**
 * APP-FORMS-038: step ids must be unique within `steps[]`. Walks each form's
 * `steps[]` and reports the first duplicate, naming both occurrences.
 */
const validateStepIdUniqueness = (forms: ReadonlyArray<FormShape>): string | undefined =>
  forms.reduce<string | undefined>((acc, form, formIndex) => {
    if (acc !== undefined) return acc
    const steps = form.steps ?? []
    if (steps.length < 2) return undefined
    const dup = findFirstDuplicate(steps, (step) => step.id)
    if (dup === undefined) return undefined
    const [prior, index, id] = dup
    return `forms[${formIndex}] '${form.name}' steps: duplicate step id '${id}' at steps[${prior}] and steps[${index}]`
  }, undefined)

/**
 * APP-FORMS-037: every entry in `step.fields[]` must match a top-level form
 * field's submitter-facing identifier (column for table-bound, name for
 * standalone / signature / calculation). Reports the first unknown reference,
 * naming the step id and the missing field.
 */
const validateStepFieldNames = (forms: ReadonlyArray<FormShape>): string | undefined =>
  forms.reduce<string | undefined>((acc, form, formIndex) => {
    if (acc !== undefined) return acc
    const steps = form.steps ?? []
    if (steps.length === 0) return undefined
    const fields = form.fields ?? []
    const declared = new Set<string>(
      fields.map((f) => fieldSubmitIdentifier(f)).filter((id): id is string => id !== undefined)
    )
    return steps.reduce<string | undefined>((stepAcc, step, stepIndex) => {
      if (stepAcc !== undefined) return stepAcc
      const missing = step.fields.find((name) => !declared.has(name))
      if (missing === undefined) return undefined
      return `forms[${formIndex}] '${form.name}' steps[${stepIndex}] '${step.id}': field '${missing}' is not declared in fields[]`
    }, undefined)
  }, undefined)

/**
 * APP-FORMS-044: every `goToWhen[].goTo` must reference an existing
 * `step.id` in the same form. A self-reference is allowed (matches a
 * declared id and is documented as a "no-op" pattern).
 */
const validateGoToWhenTargets = (forms: ReadonlyArray<FormShape>): string | undefined =>
  forms.reduce<string | undefined>((acc, form, formIndex) => {
    if (acc !== undefined) return acc
    const steps = form.steps ?? []
    if (steps.length === 0) return undefined
    const stepIds = new Set(steps.map((s) => s.id))
    return steps.reduce<string | undefined>((stepAcc, step, stepIndex) => {
      if (stepAcc !== undefined) return stepAcc
      const rules = step.goToWhen ?? []
      return rules.reduce<string | undefined>((ruleAcc, rule, ruleIndex) => {
        if (ruleAcc !== undefined) return ruleAcc
        if (stepIds.has(rule.goTo)) return undefined
        return `forms[${formIndex}] '${form.name}' steps[${stepIndex}] '${step.id}' goToWhen[${ruleIndex}].goTo '${rule.goTo}' does not match any step id`
      }, undefined)
    }, undefined)
  }, undefined)

/**
 * Run all forms cross-validation rules.
 *
 * Rules are evaluated in order via short-circuit reduce; the first rule that
 * returns a string error wins. Returns `true` when all rules pass.
 */
export const validateAllFormsReferences = (app: AppForFormsValidation): string | true => {
  const forms = app.forms ?? []
  const pages = app.pages ?? []
  const tables = app.tables ?? []
  const tableNames = new Set(tables.map((t) => t.name))
  const automationNames = new Set((app.automations ?? []).map((a) => a.name))
  const formNames = new Set(forms.map((f) => f.name))

  const rules: ReadonlyArray<() => string | undefined> = [
    () => validateNameUniqueness(forms),
    () => validateIdUniqueness(forms),
    () => validatePathUniqueness(forms, pages),
    () => validateSubmitToTable(forms, tableNames),
    () => validateSubmitToAutomation(forms, automationNames),
    () => validatePageFormRefs(pages, formNames),
    () => validateTableFieldColumns(forms, tables),
    () => validateSubmitToMappingTargets(forms, tables),
    () => validateFieldNameUniqueness(forms),
    () => validateDefaultValueTypes(forms),
    () => validateConditionalFieldReferences(forms),
    () => validateConditionalOperatorTypes(forms, tables),
    () => validateMultiStepRequiresSteps(forms),
    () => validateStepIdUniqueness(forms),
    () => validateStepFieldNames(forms),
    () => validateGoToWhenTargets(forms),
  ]

  const firstError = rules.reduce<string | undefined>((acc, rule) => acc ?? rule(), undefined)
  return firstError ?? true
}
