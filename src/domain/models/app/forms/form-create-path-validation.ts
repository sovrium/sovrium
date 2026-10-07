/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The page `form` never creates a table row on its own.
 *
 * Two form surfaces, one job each: a top-level `forms[]` entry takes something
 * in, the page `form` component works on data already inside the app, and
 * `formRef` is the only bridge between them. So a page form that would add a
 * record is refused here and pointed at that bridge.
 *
 * ## Why this is a rule and not a narrower schema
 *
 * The two shapes refused are a VALUE and a COMBINATION, not unknown keys:
 *
 * - `action: { type: crud, operation: create }` on a `form`. `CrudActionSchema`
 *   stays as it is, because `create` is still legal on every other component
 *   that carries an action (a calendar's date click, a button, a row action).
 *   Narrowing the `action` union for `form` alone would turn this into a
 *   union-mismatch report listing the variants — which says nothing about
 *   where the form went.
 * - `inlinePrefill` on a form declared in place. It stays on a `formRef`
 *   embed, which is how an embedded form receives its parent's id; on a form
 *   with no `formRef` there is no longer a create to prefill.
 *
 * The keys the page form lost outright (`wizard`, `fieldGroups`, the
 * conditional and upload options of its fields) are unknown keys now, and are
 * explained by `removed-keys.ts` beside the form component.
 *
 * ## Reach
 *
 * Every node under each page's `components` and `layout`, at any depth (a form
 * in a dialog, a tab panel, a breakpoint's children), and every shared
 * template in `app.components` — a template is drawn wherever it is placed, so
 * it is judged once, where it is declared. Structural on purpose: a rule keyed
 * on known container names would stop firing the day a new container is added.
 *
 * Pure, no schema import.
 */

/** The slice of the app this rule reads. */
interface AppForFormCreatePaths {
  readonly pages?: ReadonlyArray<unknown>
  readonly components?: ReadonlyArray<unknown>
}

type Node = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every object node reachable from `value`, depth first. */
const walk = (value: unknown): readonly Node[] => {
  if (Array.isArray(value)) return value.flatMap(walk)
  if (!isRecord(value)) return []
  return [value, ...Object.values(value).flatMap(walk)]
}

const isCrudCreate = (action: unknown): boolean =>
  isRecord(action) && action['type'] === 'crud' && action['operation'] === 'create'

/**
 * The refusals for ONE node, empty when it is not a page form that tries to
 * create. `where` names the page or template the node sits in.
 */
const nodeViolations = (node: Node, where: string): readonly string[] => {
  if (node['type'] !== 'form') return []
  const createMessage = isCrudCreate(node['action'])
    ? [
        `${where}: a page \`form\` no longer creates a table row with \`action: { type: crud, operation: create }\`. Declare the form in \`forms[]\` with \`submitTo.table\` (its fields, steps, conditions, uploads and \`onSuccess\` live there) and place it on the page with \`formRef\`.`,
      ]
    : []
  const prefillMessage =
    node['inlinePrefill'] !== undefined && node['formRef'] === undefined
      ? [
          `${where}: \`inlinePrefill\` applies only to a form placed with \`formRef\`. Declare the form in \`forms[]\` and place it with \`formRef\`, keeping \`inlinePrefill\` on that component to prefill it from the page record.`,
        ]
      : []
  return [...createMessage, ...prefillMessage]
}

const nameOf = (value: unknown, fallback: string): string =>
  isRecord(value) && typeof value['name'] === 'string' ? value['name'] : fallback

/**
 * Every page `form` that tries to create a record, as a human-readable
 * message per offence. Empty when none does. @internal — exported for the
 * test that pins the reach; production reads {@link validateFormCreatePaths}.
 */
export const collectFormCreatePathViolations = (app: AppForFormCreatePaths): readonly string[] => {
  const onPages = (app.pages ?? []).flatMap((page, index) => {
    if (!isRecord(page)) return []
    const where = `pages[${index}] '${nameOf(page, 'unnamed')}'`
    return [...walk(page['components']), ...walk(page['layout'])].flatMap((node) =>
      nodeViolations(node, where)
    )
  })
  const inTemplates = (app.components ?? []).flatMap((template, index) =>
    walk(template).flatMap((node) =>
      nodeViolations(node, `components[${index}] '${nameOf(template, 'unnamed')}'`)
    )
  )
  return [...onPages, ...inTemplates]
}

/** The first refusal, or `undefined` — the shape `validateAllFormsReferences` chains. */
export const validateFormCreatePaths = (app: AppForFormCreatePaths): string | undefined =>
  collectFormCreatePathViolations(app)[0]
