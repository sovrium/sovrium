/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `questionnaire` submits through the top-level form it names, so the form
 * must exist and every item must answer one of its fields; an item with
 * neither `choices` nor an `input` has nothing for the reader to answer. Each
 * is refused at the shared decode boundary, naming the form or the item —
 * the schema sees one component and cannot read `forms[]`. Pure: no I/O.
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every object at any depth, with its location. */
function collectNodes(node: unknown, path: string): readonly (readonly [RawRecord, string])[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => collectNodes(item, `${path}[${String(index)}]`))
  }
  if (!isRecord(node)) return []
  return [
    [node, path],
    ...Object.entries(node).flatMap(([key, child]) =>
      collectNodes(child, path === '' ? key : `${path}.${key}`)
    ),
  ]
}

/** The submitter-facing name of a form field: its column, or its own name. */
const fieldNameOf = (field: unknown): string | undefined => {
  if (!isRecord(field)) return undefined
  const name = field['kind'] === 'table-field' ? field['column'] : field['name']
  return typeof name === 'string' ? name : undefined
}

/** Each form's field names, by form name. */
const formFieldsByName = (config: RawRecord): ReadonlyMap<string, ReadonlySet<string>> =>
  new Map(
    (Array.isArray(config['forms']) ? config['forms'] : []).flatMap((form: unknown) => {
      if (!isRecord(form) || typeof form['name'] !== 'string') return []
      const fields = Array.isArray(form['fields']) ? form['fields'] : []
      const names = fields.map(fieldNameOf).filter((n): n is string => n !== undefined)
      return [[form['name'], new Set(names)] as const]
    })
  )

/** The refusals of one questionnaire. */
function questionnaireViolations(
  node: RawRecord,
  path: string,
  forms: ReadonlyMap<string, ReadonlySet<string>>
): readonly string[] {
  const { formRef } = node
  if (typeof formRef !== 'string') return []
  const fields = forms.get(formRef)
  if (fields === undefined) {
    return [
      `${path}: the questionnaire names \`formRef: ${formRef}\`, and no form of \`forms[]\` has that name. It submits its answers through that form: declare it, or name one that exists.`,
    ]
  }
  const items = Array.isArray(node['items']) ? node['items'].filter(isRecord) : []
  return items.flatMap((item) => {
    const name = String(item['name'])
    const outside = fields.has(name)
      ? []
      : [
          `${path}: the questionnaire item \`${name}\` is not a field of the form \`${formRef}\` (its fields: ${[...fields].join(', ') || 'none'}). Each answer is stored in the field its item names.`,
        ]
    const unanswerable =
      item['choices'] === undefined && item['input'] === undefined
        ? [
            `${path}: the questionnaire item \`${name}\` has neither \`choices\` nor an \`input\`, so there is nothing to answer. Give it its choices, or an \`input\` for a typed answer.`,
          ]
        : []
    return [...outside, ...unanswerable]
  })
}

/**
 * Every questionnaire whose form or items do not resolve.
 *
 * @returns one message per refusal; empty when every questionnaire is answerable
 */
export function validateQuestionnaires(config: unknown): readonly string[] {
  if (!isRecord(config)) return []
  const forms = formFieldsByName(config)
  return collectNodes(config['pages'], 'pages')
    .filter(([node]) => node['type'] === 'questionnaire')
    .flatMap(([node, path]) => questionnaireViolations(node, path, forms))
}
