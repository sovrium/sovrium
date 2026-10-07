/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fieldSubmitIdentifier } from '@/domain/models/app/forms/form-field-helpers'
import { computeFormRequiredMarkClasses } from '@/presentation/design/form-layout-classes'
import {
  FORM_RUNTIME_CALCULATIONS_SCRIPT,
  runtimeCalculationsConfig,
  type RuntimeCalculationsConfig,
} from './form-runtime-calculations'
import type { Form } from '@/domain/models/app/forms'
import type { VisibleWhenCondition } from '@/domain/models/app/forms/visible-when'

/**
 * Live conditions: inline JS source that applies `visibleWhen` and
 * `requiredWhen` in the browser, concatenated into the standalone form
 * runtime IIFE like its sibling fragments.
 *
 * Two parts, exported separately so the evaluator can be compiled on its own
 * by the parity test:
 *
 *   - `FORM_RUNTIME_CONDITION_EVALUATOR_SCRIPT` — a hand-written ES5 port of
 *     `evaluateVisibleWhen` (`domain/models/app/forms/visible-when-evaluator.ts`):
 *     all eleven operators plus recursive `and` / `or`, with the same string
 *     comparison for `eq`/`neq`/`in`/`notIn`, the same numeric-then-date
 *     coercion for the ordered operators, and the same "absent" definition.
 *     `Function.prototype.toString` on the domain function is not an option:
 *     it closes over module-scope helpers, and the binary's minifier renames
 *     them. `form-runtime-conditions.test.ts` pins the two against each other.
 *   - `FORM_RUNTIME_CONDITIONS_SCRIPT` — the DOM half. A field hidden by its
 *     rule gets `hidden` + `data-condition-hidden="true"` on its `.form-field`
 *     wrapper and `disabled` on every control inside, so the browser itself
 *     leaves it out of `FormData` and out of constraint validation — the same
 *     drop-and-skip the server applies on submit (`submit-form-field-shaping.ts`).
 *     `requiredWhen` sets each control's `required`.
 *
 * The DOM fragment assumes the surrounding IIFE provides `form`, `config` and
 * `namedInputs`. It defines `snapshotValues()` — the form's values exactly as
 * the submit handler posts them, so what a rule reads is what is sent — and
 * `applyConditions()`, plus
 * the `accumulatedValues` map the multi-step fragment folds each advanced
 * step into (earlier steps are no longer in the DOM, but their answers still
 * decide what a later step shows).
 *
 * `disabledWhen` is deliberately NOT applied here: a `disabled` control is not
 * submitted, while the rule promises the value still is. Nothing on the server
 * applies it to a hosted form either — the rule is accepted and has no effect.
 */
export const FORM_RUNTIME_CONDITION_EVALUATOR_SCRIPT = `
  // ---- Condition evaluator (mirrors the server's rule semantics) ------------
  function condIsAbsent(v) {
    if (v === undefined || v === null) return true
    if (typeof v === 'string' && v === '') return true
    if (Array.isArray(v) && v.length === 0) return true
    return false
  }
  function condToNumber(v) {
    if (typeof v === 'number' && isFinite(v)) return v
    if (typeof v === 'string' && v !== '') {
      var n = Number(v)
      if (isFinite(n)) return n
      var d = Date.parse(v)
      if (isFinite(d)) return d
    }
    return undefined
  }
  function condToString(v) {
    if (v === undefined || v === null) return ''
    if (Array.isArray(v)) return v.map(function (e) { return String(e) }).join(',')
    return String(v)
  }
  function condContains(v, expected) {
    if (expected === undefined) return false
    if (Array.isArray(v)) {
      return v.some(function (e) { return String(e) === String(expected) })
    }
    if (typeof v === 'string') return v.indexOf(String(expected)) >= 0
    return false
  }
  function condMembership(v, expected, positive) {
    if (!Array.isArray(expected)) return !positive
    var s = condToString(v)
    var matched = expected.some(function (e) { return String(e) === s })
    return positive ? matched : !matched
  }
  function condOrdered(v, expected, compare) {
    var left = condToNumber(v)
    if (left === undefined) return false
    var right = Array.isArray(expected) || expected === undefined ? undefined : condToNumber(expected)
    if (right === undefined) return false
    return compare(left, right)
  }
  var CONDITION_OPERATORS = {
    eq: function (v, x) { return condToString(v) === condToString(x) },
    neq: function (v, x) { return condToString(v) !== condToString(x) },
    contains: function (v, x) { return condContains(v, x) },
    empty: function (v) { return condIsAbsent(v) },
    notEmpty: function (v) { return !condIsAbsent(v) },
    gt: function (v, x) { return condOrdered(v, x, function (a, b) { return a > b }) },
    gte: function (v, x) { return condOrdered(v, x, function (a, b) { return a >= b }) },
    lt: function (v, x) { return condOrdered(v, x, function (a, b) { return a < b }) },
    lte: function (v, x) { return condOrdered(v, x, function (a, b) { return a <= b }) },
    in: function (v, x) { return condMembership(v, x, true) },
    notIn: function (v, x) { return condMembership(v, x, false) },
  }
  function evaluateCondition(condition, values) {
    if (!condition || typeof condition !== 'object') return false
    if ('or' in condition) {
      return condition.or.some(function (c) { return evaluateCondition(c, values) })
    }
    if ('and' in condition) {
      return condition.and.every(function (c) { return evaluateCondition(c, values) })
    }
    var op = Object.prototype.hasOwnProperty.call(CONDITION_OPERATORS, condition.operator)
      ? CONDITION_OPERATORS[condition.operator]
      : undefined
    if (!op) return false
    var value = Object.prototype.hasOwnProperty.call(values, condition.field)
      ? values[condition.field]
      : undefined
    return op(value, condition.value)
  }
`

export const FORM_RUNTIME_CONDITIONS_SCRIPT = `
  // ---- Live conditions ---------------------------------------------------------
  // A field whose rule is false is taken off screen and its controls are
  // disabled: the browser then neither validates nor sends it, which is what
  // the server does with it on submit. Rules read the same values the
  // submission is built from, plus the answers of earlier steps.
  // The form's current values, exactly as the submission posts them: the
  // live conditions evaluate this same snapshot, so what is evaluated is
  // what is sent. A disabled control is absent from FormData by the browser.
  function snapshotValues() {
    var formData = new FormData(form)
    var payload = {}
    // Repeated keys (multi-select / checkbox groups / array hidden inputs) must
    // collect into an array — a plain overwrite keeps only the last value.
    formData.forEach(function (value, key) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        if (Array.isArray(payload[key])) payload[key].push(value)
        else payload[key] = [payload[key], value]
      } else {
        payload[key] = value
      }
    })
    return payload
  }

  var conditions = Array.isArray(config.conditions) ? config.conditions : []
  var accumulatedValues = {}
  function conditionValues() {
    var merged = {}
    var snapshot = snapshotValues()
    Object.keys(accumulatedValues).forEach(function (k) { merged[k] = accumulatedValues[k] })
    Object.keys(snapshot).forEach(function (k) { merged[k] = snapshot[k] })
    return merged
  }
  function conditionControls(name) {
    var found = []
    namedInputs().forEach(function (input) {
      if (input.name === name && input.type !== 'hidden') found.push(input)
    })
    return found
  }
  function setVisible(controls, visible) {
    var changed = false
    var wrapper = controls[0].closest('.form-field')
    if (wrapper) {
      var wasHidden = wrapper.hasAttribute('data-condition-hidden')
      if (visible && wasHidden) {
        wrapper.removeAttribute('hidden')
        wrapper.removeAttribute('data-condition-hidden')
        changed = true
      } else if (!visible && !wasHidden) {
        wrapper.setAttribute('hidden', '')
        wrapper.setAttribute('data-condition-hidden', 'true')
        changed = true
      }
    }
    controls.forEach(function (control) {
      if (control.disabled !== !visible) {
        control.disabled = !visible
        changed = true
      }
    })
    return changed
  }
  // A field required by a rule is announced and marked as one required by
  // config is: aria-required on its control (on the group for radios) and the
  // mark after its label, both added and removed as the rule turns.
  function setRequired(controls, required) {
    var wrapper = controls[0].closest('.form-field')
    controls.forEach(function (control) {
      control.required = required
      if (control.type !== 'radio') toggleAttr(control, 'aria-required', required)
    })
    if (!wrapper) return
    var group = wrapper.matches('[role="radiogroup"]') ? wrapper : wrapper.querySelector('[role="radiogroup"]')
    if (group) toggleAttr(group, 'aria-required', required)
    var label = wrapper.querySelector('label, .form-field-legend')
    var mark = label && label.querySelector('[data-required-mark]')
    if (required && label && !mark) {
      mark = document.createElement('span')
      mark.className = config.requiredMarkClass || ''
      mark.setAttribute('data-required-mark', 'true')
      mark.setAttribute('aria-hidden', 'true')
      mark.textContent = ' *'
      label.appendChild(mark)
    } else if (!required && mark) {
      removeIfPresent(mark)
    }
  }
  function toggleAttr(el, name, on) {
    if (on) el.setAttribute(name, 'true')
    else el.removeAttribute(name)
  }
  function applyConditionsOnce() {
    var values = conditionValues()
    var changed = false
    conditions.forEach(function (rule) {
      var controls = conditionControls(rule.name)
      if (controls.length === 0) return
      if (rule.visibleWhen && setVisible(controls, evaluateCondition(rule.visibleWhen, values))) {
        changed = true
      }
      if (rule.requiredWhen) setRequired(controls, evaluateCondition(rule.requiredWhen, values))
    })
    return changed
  }
  // Hiding a field removes its value, which can flip a rule that reads it;
  // repeat until nothing moves (bounded by the number of rules).
  function applyConditions() {
    for (var pass = 0; pass <= conditions.length; pass++) {
      if (!applyConditionsOnce()) return
    }
  }
  if (conditions.length > 0) {
    form.addEventListener('input', applyConditions)
    form.addEventListener('change', applyConditions)
    applyConditions()
  }
${FORM_RUNTIME_CALCULATIONS_SCRIPT}`

/** One field's live rules, as the inline runtime reads them. */
export interface FormRuntimeCondition {
  readonly name: string
  readonly visibleWhen?: VisibleWhenCondition
  readonly requiredWhen?: VisibleWhenCondition
}

/**
 * Collect the live rules of every input-bearing field. A config-`hidden`
 * field is skipped: it has no on-screen wrapper to toggle, and its rules stay
 * with the server.
 */
export function collectFormRuntimeConditions(
  form: Readonly<Pick<Form, 'fields'>>
): ReadonlyArray<FormRuntimeCondition> {
  return form.fields.flatMap((field) => {
    const name = fieldSubmitIdentifier(field)
    if (name === undefined) return []
    const { visibleWhen, requiredWhen, hidden } = field as {
      readonly visibleWhen?: VisibleWhenCondition
      readonly requiredWhen?: VisibleWhenCondition
      readonly hidden?: boolean
    }
    if (hidden === true) return []
    if (visibleWhen === undefined && requiredWhen === undefined) return []
    return [
      {
        name,
        ...(visibleWhen !== undefined ? { visibleWhen } : {}),
        ...(requiredWhen !== undefined ? { requiredWhen } : {}),
      },
    ]
  })
}

/** The live rules a hosted form's runtime applies, and what it draws them with. */
export interface RuntimeConditionsConfig extends RuntimeCalculationsConfig {
  /**
   * The `visibleWhen` / `requiredWhen` rules the runtime applies live
   * keyed by the field's submitted name. Present only
   * when at least one field carries a rule, so a form without any pays
   * nothing on the wire. `disabledWhen` is not applied on a hosted form at
   * all, here or on the server.
   */
  readonly conditions?: ReadonlyArray<FormRuntimeCondition>
  /** The required mark's classes; present only when a `requiredWhen` rule exists. */
  readonly requiredMarkClass?: string
}

/**
 * The runtime config slice for a form's live rules: the rules, and — when one
 * can require a field — the classes of the mark drawn beside its label.
 */
export function runtimeConditionsConfig(
  form: Readonly<Pick<Form, 'fields'>>
): RuntimeConditionsConfig {
  const conditions = collectFormRuntimeConditions(form)
  // Calculations are live derived state too: listed here, applied after the rules.
  const calculations = runtimeCalculationsConfig(form)
  if (conditions.length === 0) return calculations
  return conditions.some((rule) => rule.requiredWhen !== undefined)
    ? { ...calculations, conditions, requiredMarkClass: computeFormRequiredMarkClasses() }
    : { ...calculations, conditions }
}
