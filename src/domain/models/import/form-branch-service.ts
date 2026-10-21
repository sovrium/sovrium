/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A form's `branch` rules, turned into the `goToWhen` rules of its steps.
 *
 * A branch is evaluated when the respondent leaves the page its question sits
 * on, and sends them to another page: Google Forms' "go to section based on
 * answer", set per option of a choice question. A Sovrium step says exactly
 * that with `goToWhen`: when the condition holds on Next, the named step
 * follows; otherwise the next step in order. So a branch converts one to one,
 * on three conditions, and is reported quoting the source otherwise:
 *
 * - it goes FORWARD, to a page that became a step (a step may not branch back);
 * - its condition is one comparison (`goToWhen` takes no and/or);
 * - its target is a page, not the end of the form: a step cannot submit early.
 */

import { isRefusal, readCondition, type ConditionFields } from './form-condition-service'
import { toolDisplayName } from './source-display-name-service'
import type { CanonicalForm } from './canonical-form'
import type { LogicTodo } from './form-logic-service'
import type { FormSourceTool } from './form-question-mappings'
import type { VisibleWhen } from '@/domain/models/app/forms/visible-when'

type Rule = CanonicalForm['rules'][number]

/** One step of the form being mapped: its id and the page it came from. */
export interface BranchStep {
  readonly id: string
  readonly page: string
}

/** One `goToWhen` rule of a step. */
export interface GoToRule {
  readonly when: VisibleWhen
  readonly goTo: string
}

/** What the branches of one form became. */
export interface FormBranches {
  /** The `goToWhen` rules of each step, by step id, in the source's order. */
  readonly goToWhen: ReadonlyMap<string, readonly GoToRule[]>
  readonly todo: readonly LogicTodo[]
}

/** One branch, converted or refused with the reason. */
type Planned =
  | { readonly from: string; readonly rule: GoToRule }
  | { readonly refused: string; readonly branch: Rule }

/** Why a branch from step `from` to step `to` cannot be a step's `goToWhen`, or `undefined`. */
const refusedTarget = (branch: Rule, from: number, to: number): string | undefined => {
  if (from < 0) return 'its question sits on no step of the form'
  const target = branch.target ?? 'end'
  if (target === 'end' || target.startsWith('end:')) {
    return 'it ends the form early, which a step cannot do'
  }
  if (to < 0) return 'the section it goes to holds no question, so it is no step'
  return to <= from ? 'it goes back to an earlier section, which a step cannot do' : undefined
}

const planOne = (
  form: CanonicalForm,
  branch: Rule,
  steps: readonly BranchStep[],
  fields: ConditionFields
): Planned => {
  const page = form.questions.find((question) => question.sourceId === branch.source)?.page
  const from = steps.findIndex((step) => step.page === page)
  const to = steps.findIndex((step) => step.page === branch.target)
  const refusal = refusedTarget(branch, from, to)
  if (refusal !== undefined) return { refused: refusal, branch }
  const when = readCondition(form.tool as FormSourceTool, branch.when, fields)
  if (isRefusal(when)) return { refused: when.refused, branch }
  if (when.kind !== 'leaf') return { refused: 'its condition is not one comparison', branch }
  return { from: steps[from]?.id ?? '', rule: { when: when.rule, goTo: steps[to]?.id ?? '' } }
}

/** Plan the branches of one form onto its steps. */
export const planFormBranches = (
  form: CanonicalForm,
  steps: readonly BranchStep[],
  fields: ConditionFields
): FormBranches => {
  const planned = form.rules
    .filter((rule) => rule.kind === 'branch')
    .map((branch) => planOne(form, branch, steps, fields))
  const converted = planned.flatMap((one) => ('rule' in one ? [one] : []))
  return {
    goToWhen: new Map(
      [...new Set(converted.map((one) => one.from))].map(
        (from) =>
          [from, converted.filter((one) => one.from === from).map((one) => one.rule)] as const
      )
    ),
    todo: planned.flatMap((one) =>
      'refused' in one
        ? [
            {
              ...(one.branch.source === undefined ? {} : { question: one.branch.source }),
              original: JSON.stringify(one.branch.raw),
              reason: `This ${toolDisplayName(form.tool)} branch is not converted: ${one.refused}.`,
            },
          ]
        : []
    ),
  }
}
