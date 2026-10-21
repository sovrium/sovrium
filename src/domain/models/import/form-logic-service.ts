/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A form's rules, turned into what a Sovrium form can say: a `visibleWhen`
 * and a `requiredWhen` per question, and a `calculation` per variable.
 *
 * ## Jumps become visibility
 *
 * A jump is evaluated after its source question, the first one whose condition
 * holds wins, and the questions between the source and the target are skipped.
 * So a question is shown exactly when no jump that would skip it is taken: for
 * each such jump, the jump's source was never reached, or the jump's own
 * condition failed (or an earlier jump of the same question was taken). That is
 * computed question by question in reading order, and printed as `and`/`or`.
 *
 * It holds only when every jump of a question goes FORWARD and every condition
 * of the question has an opposite. A question whose jumps go back, aim at a
 * screen Sovrium has no equivalent for, or compare in a way that cannot be
 * reversed is reported, quoting its rules, and none of them is converted: a
 * half-converted jump list would show questions the source never showed.
 *
 * ## Calculations
 *
 * A variable whose every step applies unconditionally becomes one `{{...}}`
 * formula over the form's fields. A conditional score — "add 2 when the answer
 * is Barcelona" — has no formula equivalent and is reported; the values the
 * source computed are still kept in the variable's column.
 */

import {
  FALSE,
  TRUE,
  allOf,
  anyOf,
  isRefusal,
  negate,
  readCondition,
  type ConditionFields,
  type LogicExpr,
} from './form-condition-service'
import { toolDisplayName } from './source-display-name-service'
import type { CanonicalForm } from './canonical-form'
import type { FormSourceTool } from './form-question-mappings'

type Rule = CanonicalForm['rules'][number]

/** One rule that did not translate. */
export interface LogicTodo {
  /** The question source id or variable name it concerns, when it concerns one. */
  readonly question?: string
  readonly variable?: string
  readonly original: string
  readonly reason: string
}

/** What the rules of one form became. */
export interface FormLogic {
  /** The visibility of each question, by question source id; absent means always shown. */
  readonly visibility: ReadonlyMap<string, LogicExpr>
  /** When each question is required, by question source id. */
  readonly requirement: ReadonlyMap<string, LogicExpr>
  /** The calculation formula of each variable that has one. */
  readonly formulas: ReadonlyMap<string, string>
  readonly todo: readonly LogicTodo[]
}

/** The fields a rule may name, and the numeric ones a formula may read. */
export interface LogicFields extends ConditionFields {
  readonly numeric: (sourceId: string) => boolean
}

const quote = (rules: readonly Rule[]): string =>
  JSON.stringify(rules.length === 1 ? rules[0]?.raw : rules.map((rule) => rule.raw))

/** A jump, resolved to question positions. */
interface Jump {
  readonly from: number
  readonly to: number
  readonly when: LogicExpr
  readonly rule: Rule
}

/** One question's jumps, in order, with the condition under which each is TAKEN. */
interface JumpList {
  readonly from: number
  readonly taken: readonly {
    readonly to: number
    readonly taken: LogicExpr
    readonly skip: LogicExpr
  }[]
}

/** The position a jump target names; the form's end for a thank-you screen. */
const targetIndex = (form: CanonicalForm, order: readonly string[], target: string | undefined) => {
  if (target === undefined) return undefined
  if (target === 'end' || target.startsWith('end:')) return order.length
  const question = order.indexOf(target)
  if (question >= 0) return question
  const page = form.questions.find((one) => one.page === target && order.includes(one.sourceId))
  return page === undefined ? undefined : order.indexOf(page.sourceId)
}

/** What resolving a form's jumps reads. */
interface JumpScope {
  readonly tool: FormSourceTool
  readonly form: CanonicalForm
  readonly order: readonly string[]
  readonly fields: ConditionFields
}

/** Resolve one question's jumps, or say why they cannot be converted. */
const resolveJumps = (
  { tool, form, order, fields }: JumpScope,
  rules: readonly Rule[]
): JumpList | string => {
  const source = rules[0]?.source
  const from = source === undefined ? -1 : order.indexOf(source)
  if (source !== undefined && from < 0) return `its question "${source}" is not in the form`
  const jumps = rules.map((rule): Jump | string => {
    const to = targetIndex(form, order, rule.target)
    if (to === undefined) return `it jumps to "${rule.target ?? ''}", which Sovrium has no step for`
    if (to <= from)
      return 'it jumps back to an earlier question, which a visibility rule cannot express'
    const when = readCondition(tool, rule.when, fields)
    return isRefusal(when) ? when.refused : { from, to, when, rule }
  })
  const refused = jumps.find((jump): jump is string => typeof jump === 'string')
  if (refused !== undefined) return refused
  const resolved = jumps.filter((jump): jump is Jump => typeof jump !== 'string')
  const negations = resolved.map((jump) => negate(jump.when))
  if (negations.some((one) => one === undefined)) {
    return 'one of its conditions has no opposite, so the questions it skips cannot be shown on the reverse condition'
  }
  const opposite = negations.filter((one): one is LogicExpr => one !== undefined)
  const taken = resolved.map((jump, index) => allOf([...opposite.slice(0, index), jump.when]))
  const skip = taken.map((one) => negate(one) ?? FALSE)
  return {
    from,
    taken: resolved.map((jump, index) => ({
      to: jump.to,
      taken: taken[index] ?? FALSE,
      skip: skip[index] ?? TRUE,
    })),
  }
}

/** Group a form's jumps by the question they are evaluated after, in rule order. */
const jumpGroups = (rules: readonly Rule[]): readonly (readonly Rule[])[] => {
  const keys = [...new Set(rules.map((rule) => rule.source ?? ''))]
  return keys.map((key) => rules.filter((rule) => (rule.source ?? '') === key))
}

/** Whether each question is reached, in reading order, from the jumps that skip it. */
const reachability = (count: number, lists: readonly JumpList[]): readonly LogicExpr[] =>
  Array.from({ length: count }).reduce<readonly LogicExpr[]>((reached, _unused, index) => {
    const skippers = lists.flatMap((list) =>
      list.taken
        .filter((jump) => list.from < index && index < jump.to)
        .map((jump) => {
          const sourceReached = list.from < 0 ? TRUE : (reached[list.from] ?? TRUE)
          return anyOf([negate(sourceReached) ?? FALSE, jump.skip])
        })
    )
    return [...reached, allOf(skippers)]
  }, [])

/** The rules a jump list could not convert, each reported. */
const jumpTodos = (
  form: CanonicalForm,
  group: readonly Rule[],
  reason: string
): readonly LogicTodo[] =>
  group.map((rule) => ({
    ...(rule.source === undefined ? {} : { question: rule.source }),
    original: quote([rule]),
    reason: `This ${toolDisplayName(form.tool)} jump is not converted: ${reason}.`,
  }))

/** The jumps, as visibility per question. */
const planJumps = (
  form: CanonicalForm,
  order: readonly string[],
  fields: ConditionFields
): { readonly reach: readonly LogicExpr[]; readonly todo: readonly LogicTodo[] } => {
  const tool = form.tool as FormSourceTool
  const groups = jumpGroups(form.rules.filter((rule) => rule.kind === 'jump'))
  const scope: JumpScope = { tool, form, order, fields }
  const resolved = groups.map((group) => ({ group, list: resolveJumps(scope, group) }))
  const lists = resolved.flatMap(({ list }) => (typeof list === 'string' ? [] : [list]))
  const todo = resolved.flatMap(({ group, list }) =>
    typeof list === 'string'
      ? jumpTodos(form, group, list)
      : group
          .filter((rule) => rule.target?.startsWith('end:') === true)
          .map((rule) => ({
            ...(rule.source === undefined ? {} : { question: rule.source }),
            original: quote([rule]),
            reason:
              'The form ends here as in the source, but the source showed another thank-you screen on this path; a Sovrium form shows one success message.',
          }))
  )
  return { reach: reachability(order.length, lists), todo }
}

/** The conditions of the rules of one kind aimed at one question, or the rules refused. */
const conditionsOf = (tool: FormSourceTool, rules: readonly Rule[], fields: ConditionFields) => {
  const read = rules.map((rule) => ({ rule, when: readCondition(tool, rule.when, fields) }))
  return {
    held: read.flatMap(({ rule, when }) => (isRefusal(when) ? [] : [{ rule, when }])),
    refused: read.flatMap(({ rule, when }) =>
      isRefusal(when) ? [{ rule, reason: when.refused }] : []
    ),
  }
}

/** Show, hide and require rules, per question. */
const planTargeted = (
  form: CanonicalForm,
  order: readonly string[],
  fields: ConditionFields,
  reach: readonly LogicExpr[]
) => {
  const tool = form.tool as FormSourceTool
  const of = (kind: Rule['kind'], question: string) =>
    form.rules.filter((rule) => rule.kind === kind && rule.target === question)
  const per = order.map((question, index) => {
    const show = conditionsOf(tool, of('show', question), fields)
    const hide = conditionsOf(tool, of('hide', question), fields)
    const require = conditionsOf(tool, of('require', question), fields)
    const hidden = hide.held.map(({ rule, when }) => ({ rule, shown: negate(when) }))
    const shown = show.held.length === 0 ? TRUE : anyOf(show.held.map(({ when }) => when))
    const visible = allOf([
      reach[index] ?? TRUE,
      shown,
      ...hidden.flatMap((one) => (one.shown === undefined ? [] : [one.shown])),
    ])
    const refused = [
      ...show.refused,
      ...hide.refused,
      ...require.refused,
      ...hidden
        .filter((one) => one.shown === undefined)
        .map(({ rule }) => ({ rule, reason: 'its condition has no opposite' })),
    ]
    return { question, visible, required: anyOf(require.held.map(({ when }) => when)), refused }
  })
  return {
    visibility: new Map(
      per.flatMap((one) =>
        one.visible.kind === 'const' ? [] : [[one.question, one.visible] as const]
      )
    ),
    never: per.filter((one) => one.visible.kind === 'const' && !one.visible.value),
    requirement: new Map(
      per.flatMap((one) =>
        one.required.kind === 'const' ? [] : [[one.question, one.required] as const]
      )
    ),
    todo: per.flatMap((one) =>
      one.refused.map(({ rule, reason }) => ({
        question: one.question,
        original: quote([rule]),
        reason: `This ${toolDisplayName(form.tool)} rule is not converted: ${reason}.`,
      }))
    ),
  }
}

/** A formula expression: a field, a number, or a helper over two expressions. */
const render = (expression: string): string =>
  expression.startsWith('(') ? `{{${expression.slice(1, -1)}}}` : `{{${expression}}}`

/** One unconditional calculation step, or `undefined` when it is not one a formula can say. */
const stepOf = (
  tool: FormSourceTool,
  rule: Rule,
  fields: LogicFields
): { readonly operator: string; readonly value: string } | undefined => {
  const when = readCondition(tool, rule.when, fields)
  const always = !isRefusal(when) && when.kind === 'const' && when.value
  const operation = always ? rule.operation : undefined
  if (operation === undefined || 'variable' in operation.operand) return undefined
  if ('constant' in operation.operand) {
    return { operator: operation.operator, value: String(operation.operand.constant) }
  }
  const { question } = operation.operand
  const field = fields.numeric(question) ? fields.question(question) : undefined
  return field === undefined ? undefined : { operator: operation.operator, value: field }
}

/** One variable's steps as a formula, or `undefined` when they are not one. */
const formulaOf = (
  tool: FormSourceTool,
  variable: { readonly name: string; readonly initial?: number },
  rules: readonly Rule[],
  fields: LogicFields
): string | undefined => {
  const steps = rules.map((rule) => stepOf(tool, rule, fields))
  if (steps.length === 0 || steps.some((step) => step === undefined)) return undefined
  const expression = steps.reduce<string>(
    (acc, step) =>
      step === undefined
        ? acc
        : step.operator === 'set'
          ? step.value
          : `(${step.operator} ${acc} ${step.value})`,
    String(variable.initial ?? 0)
  )
  return render(expression)
}

/** The calculations: a formula where every step is unconditional, a TODO otherwise. */
const planCalculations = (form: CanonicalForm, fields: LogicFields) => {
  const tool = form.tool as FormSourceTool
  const calculate = form.rules.filter((rule) => rule.kind === 'calculate')
  const names = [...new Set(calculate.map((rule) => rule.target ?? ''))]
  const planned = names.map((name) => {
    const rules = calculate.filter((rule) => (rule.target ?? '') === name)
    const declared = form.variables?.find((variable) => variable.name === name)
    return { name, rules, formula: formulaOf(tool, declared ?? { name }, rules, fields) }
  })
  return {
    formulas: new Map(
      planned.flatMap((one) =>
        one.formula === undefined ? [] : [[one.name, one.formula] as const]
      )
    ),
    todo: planned
      .filter((one) => one.formula === undefined)
      .map((one) => ({
        variable: one.name,
        original: quote(one.rules),
        reason: `The ${toolDisplayName(form.tool)} calculation of "${one.name}" depends on conditions or on another variable, which a Sovrium calculation cannot express; the values the source computed are kept in its column.`,
      })),
  }
}

/** Plan the rules of one form. */
export const planFormLogic = (form: CanonicalForm, fields: LogicFields): FormLogic => {
  const order = form.questions
    .filter((question) => question.retired !== true)
    .map((one) => one.sourceId)
  const jumps = planJumps(form, order, fields)
  const targeted = planTargeted(form, order, fields, jumps.reach)
  const calculations = planCalculations(form, fields)
  const others = form.rules
    .filter((rule) => rule.kind === 'other')
    .map((rule) => ({
      ...(rule.target === undefined ? {} : { question: rule.target }),
      original: quote([rule]),
      reason: rule.reason ?? `This ${toolDisplayName(form.tool)} rule has no Sovrium equivalent.`,
    }))
  const never = targeted.never.map((one) => ({
    question: one.question,
    original: quote(form.rules.filter((rule) => rule.kind === 'jump')),
    reason: 'The source never shows this question on any path, so it is left visible; review it.',
  }))
  return {
    visibility: targeted.visibility,
    requirement: targeted.requirement,
    formulas: calculations.formulas,
    todo: [...jumps.todo, ...targeted.todo, ...calculations.todo, ...others, ...never],
  }
}
