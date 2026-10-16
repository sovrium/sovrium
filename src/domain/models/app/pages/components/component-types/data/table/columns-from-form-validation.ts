/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A grid deriving its answer columns from a form (`columnsFrom: { form }`) must
 * name a form the app declares. A literal name is judged here, at the decode
 * boundary, because the component schema sees one grid and cannot read
 * `forms[]`. A `$param.<segment>` reference names no form until a request
 * arrives, so it is judged per request instead (an unknown name answers 404);
 * whether its segment exists is the page-binding rules' question. Pure: no I/O.
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
    ...Object.entries(node).flatMap(([key, child]) => collectNodes(child, `${path}.${key}`)),
  ]
}

/** The literal form name a node's `columnsFrom` names, if any. */
const literalFormOf = (node: RawRecord): string | undefined => {
  const source = node['columnsFrom']
  if (!isRecord(source)) return undefined
  const { form } = source
  return typeof form === 'string' && !form.startsWith('$') ? form : undefined
}

/**
 * Every grid whose `columnsFrom.form` names, literally, a form the app does not
 * declare.
 *
 * @returns one message per refusal; empty when every named form exists
 */
export function validateFormColumnSources(config: unknown): readonly string[] {
  if (!isRecord(config)) return []
  const forms = Array.isArray(config['forms']) ? config['forms'] : []
  const declared = new Set(
    forms.flatMap((form: unknown) =>
      isRecord(form) && typeof form['name'] === 'string' ? [form['name']] : []
    )
  )
  return collectNodes(config['pages'], 'pages').flatMap(([node, path]) => {
    const form = literalFormOf(node)
    return form === undefined || declared.has(form)
      ? []
      : [
          `${path}: columnsFrom names the form \`${form}\`, and no form of \`forms[]\` has that name. Its answer columns are that form's fields: declare it, or name one that exists.`,
        ]
  })
}
