/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { orderedFormCalculations } from '@/domain/models/app/forms/form-calculation-service'
import type { Form } from '@/domain/models/app/forms'
import type { CalculationExpression } from '@/domain/models/app/forms/form-calculation-service'

/** One calculation as the runtime receives it: its name and parsed expression. */
export interface RuntimeCalculation {
  readonly name: string
  readonly expr: CalculationExpression
  /** `currency` shows two decimals; every other format shows the number as computed. */
  readonly currency?: true
}

/**
 * The form's calculations, parsed on the server and listed in dependency
 * order, so the page evaluates a tree and never parses a formula.
 */
export interface RuntimeCalculationsConfig {
  /** The form's calculations in dependency order; absent when it has none. */
  readonly calculations?: ReadonlyArray<RuntimeCalculation>
}

export const runtimeCalculationsConfig = (
  form: Readonly<Pick<Form, 'fields'>>
): RuntimeCalculationsConfig => {
  const ordered = orderedFormCalculations(form.fields)
  if (ordered.length === 0) return {}
  const currencyNames = new Set(
    form.fields.flatMap((field) =>
      field.kind === 'calculation' && field.format === 'currency' ? [field.name] : []
    )
  )
  return {
    calculations: ordered.map((calc) => ({
      name: calc.name,
      expr: calc.expression,
      ...(currencyNames.has(calc.name) ? { currency: true as const } : {}),
    })),
  }
}

/**
 * A hand-written ES5 port of `evaluateCalculation`
 * (`domain/models/app/forms/form-calculation-service.ts`): same helpers, same
 * defaults for a missing argument, same "an input without a number leaves the
 * result empty". `form-runtime-calculations.test.ts` pins the two against each
 * other. Exported on its own so the parity test can compile it.
 */
export const FORM_RUNTIME_CALCULATION_EVALUATOR_SCRIPT = `
  // ---- Calculation evaluator (mirrors the server's recompute) --------------
  function calcNumber(v) {
    if (typeof v === 'number') return isFinite(v) ? v : undefined
    if (typeof v !== 'string' || v.trim() === '') return undefined
    var n = Number(v)
    return isFinite(n) ? n : undefined
  }
  function calcArg(args, i, dflt) {
    return args.length > i ? args[i] : dflt
  }
  function calcRound(v, d) {
    if (d === undefined || d === 0) return Math.round(v)
    var f = Math.pow(10, d)
    return Math.round(v * f) / f
  }
  var CALC_FNS = {
    add: function (a) { return calcArg(a, 0, 0) + calcArg(a, 1, 0) },
    subtract: function (a) { return calcArg(a, 0, 0) - calcArg(a, 1, 0) },
    multiply: function (a) { return calcArg(a, 0, 0) * calcArg(a, 1, 0) },
    divide: function (a) { var b = calcArg(a, 1, 0); return b === 0 ? 0 : calcArg(a, 0, 0) / b },
    modulo: function (a) { var b = calcArg(a, 1, 0); return b === 0 ? 0 : calcArg(a, 0, 0) % b },
    round: function (a) { return calcRound(calcArg(a, 0, 0), calcArg(a, 1, undefined)) },
    ceil: function (a) { return Math.ceil(calcArg(a, 0, 0)) },
    floor: function (a) { return Math.floor(calcArg(a, 0, 0)) },
    abs: function (a) { return Math.abs(calcArg(a, 0, 0)) },
    min: function (a) { return a.length === 0 ? 0 : Math.min.apply(null, a) },
    max: function (a) { return a.length === 0 ? 0 : Math.max.apply(null, a) },
    clamp: function (a) {
      var v = calcArg(a, 0, 0)
      return Math.min(Math.max(v, calcArg(a, 1, v)), calcArg(a, 2, v))
    },
    percentage: function (a) {
      var whole = calcArg(a, 1, 0)
      return whole === 0 ? 0 : calcRound((calcArg(a, 0, 0) / whole) * 100, calcArg(a, 2, undefined))
    },
  }
  function evaluateCalc(expr, values) {
    if (typeof expr.num === 'number') return expr.num
    if (typeof expr.ref === 'string') {
      return Object.prototype.hasOwnProperty.call(values, expr.ref) ? calcNumber(values[expr.ref]) : undefined
    }
    if (!Object.prototype.hasOwnProperty.call(CALC_FNS, expr.call)) return undefined
    var args = []
    for (var i = 0; i < expr.args.length; i++) {
      var arg = evaluateCalc(expr.args[i], values)
      if (arg === undefined) return undefined
      args.push(arg)
    }
    var result = CALC_FNS[expr.call](args)
    return isFinite(result) ? result : undefined
  }
`

/**
 * The evaluator plus the DOM half: recompute every calculation, in the order
 * the server listed them, whenever an input changes, and write each result
 * into its read-only input. Assumes the surrounding IIFE provides `form`,
 * `config` and `snapshotValues()` (from the conditions fragment).
 */
export const FORM_RUNTIME_CALCULATIONS_SCRIPT = `${FORM_RUNTIME_CALCULATION_EVALUATOR_SCRIPT}
  var calculations = Array.isArray(config.calculations) ? config.calculations : []
  function applyCalculations() {
    if (calculations.length === 0) return
    var values = snapshotValues()
    calculations.forEach(function (calc) {
      var result = evaluateCalc(calc.expr, values)
      values[calc.name] = result
      var target = form.querySelector('[name="' + calc.name + '"]')
      if (!target) return
      if (result === undefined) target.value = ''
      else target.value = calc.currency ? result.toFixed(2) : String(result)
    })
  }
  if (calculations.length > 0) {
    form.addEventListener('input', applyCalculations)
    form.addEventListener('change', applyCalculations)
    applyCalculations()
  }
`
