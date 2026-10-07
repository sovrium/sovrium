/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Calculation fields: parse, evaluate and order.
 *
 * A `kind: calculation` formula is ONE `{{...}}` expression in the template
 * grammar: a field name (`{{quantity}}`), a number literal, or a helper applied
 * to arguments, where an argument may itself be a parenthesised helper call
 * (`{{round (multiply covers price_per_cover) 2}}`). Only the number helpers
 * below are admitted; they compute the same values as their automation-template
 * namesakes, except that `round` answers a number rather than a fixed-digit
 * string, because a calculation's value is a number.
 *
 * The parsed tree is the contract shared by the three readers: boot validation
 * (unknown names, refused helpers, cycles), the server recompute on submit, and
 * the browser runtime, which receives the tree as JSON and evaluates it with a
 * hand-written port of {@link evaluateCalculation} — no parser ships to the page.
 */

/** A parsed calculation expression. */
export type CalculationExpression =
  | { readonly ref: string }
  | { readonly num: number }
  | { readonly call: string; readonly args: ReadonlyArray<CalculationExpression> }

/** The helpers a calculation may call: every one of them answers a number. */
export const CALCULATION_HELPERS = [
  'add',
  'subtract',
  'multiply',
  'divide',
  'modulo',
  'round',
  'ceil',
  'floor',
  'abs',
  'min',
  'max',
  'clamp',
  'percentage',
] as const

/** A failure to read a formula, with the reason in reader words. */
export interface CalculationParseFailure {
  readonly error: string
}

const TOKEN = /\(|\)|-?\d+(?:\.\d+)?(?![\w.-])|[A-Za-z_][\w.-]*|\S/g

const tokenize = (source: string): ReadonlyArray<string> =>
  [...source.matchAll(TOKEN)].map((match) => match[0])

const isNumberToken = (token: string): boolean => /^-?\d+(?:\.\d+)?$/.test(token)
const isNameToken = (token: string): boolean => /^[A-Za-z_][\w.-]*$/.test(token)

interface Cursor {
  readonly expression: CalculationExpression
  readonly next: number
}

type Parsed = Cursor | CalculationParseFailure

const isFailure = (value: Parsed): value is CalculationParseFailure => 'error' in value

/** One argument: a number, a field name, or a parenthesised helper call. */
const parseArgument = (tokens: ReadonlyArray<string>, at: number): Parsed => {
  const token = tokens[at]
  if (token === undefined) return { error: 'the expression ends early' }
  if (isNumberToken(token)) return { expression: { num: Number(token) }, next: at + 1 }
  if (isNameToken(token)) return { expression: { ref: token }, next: at + 1 }
  if (token !== '(') return { error: `'${token}' is not a field name, number or (helper ...)` }
  const call = parseCall(tokens, at + 1, ')')
  if (isFailure(call)) return call
  return { expression: call.expression, next: call.next + 1 }
}

/** A helper name followed by its arguments, up to `closing` (or the end). */
const parseCall = (
  tokens: ReadonlyArray<string>,
  at: number,
  closing: string | undefined
): Parsed => {
  const helper = tokens[at]
  if (helper === undefined || !isNameToken(helper)) {
    return { error: 'a parenthesis must open with a helper name' }
  }
  const collect = (
    from: number,
    args: ReadonlyArray<CalculationExpression>
  ): Parsed | { readonly args: ReadonlyArray<CalculationExpression>; readonly next: number } => {
    const token = tokens[from]
    if (token === closing) return { args, next: from }
    if (token === undefined) return { error: `a '(' is never closed` }
    if (token === ')') return { error: `an unexpected ')'` }
    const argument = parseArgument(tokens, from)
    if (isFailure(argument)) return argument
    return collect(argument.next, [...args, argument.expression])
  }
  const collected = collect(at + 1, [])
  if ('error' in collected) return collected
  if (!('args' in collected)) return collected
  return { expression: { call: helper, args: collected.args }, next: collected.next }
}

/**
 * Parse a calculation formula. A single name or number is a reference or a
 * literal; a name followed by arguments is a helper call.
 */
export const parseCalculationFormula = (
  formula: string
): CalculationExpression | CalculationParseFailure => {
  const inner = /^\s*\{\{([^{}]+)\}\}\s*$/.exec(formula)?.[1]
  if (inner === undefined) return { error: 'a formula is exactly one {{...}} expression' }
  const tokens = tokenize(inner)
  if (tokens.length === 0) return { error: 'the expression is empty' }
  if (tokens.length === 1) {
    const single = parseArgument(tokens, 0)
    return isFailure(single) ? single : single.expression
  }
  const call = parseCall(tokens, 0, undefined)
  return isFailure(call) ? call : call.expression
}

/** Every field name an expression reads, in reading order, without repeats. */
export const calculationReferences = (expression: CalculationExpression): ReadonlyArray<string> => {
  const walk = (node: CalculationExpression): ReadonlyArray<string> => {
    if ('ref' in node) return [node.ref]
    if ('num' in node) return []
    return node.args.flatMap(walk)
  }
  return [...new Set(walk(expression))]
}

/** Every helper an expression calls, in reading order. */
export const calculationHelpers = (expression: CalculationExpression): ReadonlyArray<string> => {
  if (!('call' in expression)) return []
  return [expression.call, ...expression.args.flatMap(calculationHelpers)]
}

/** Coerce a submitted or typed value to a finite number, or `undefined`. */
export const toCalculationNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const roundTo = (value: number, digits: number | undefined): number => {
  if (digits === undefined || digits === 0) return Math.round(value)
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

type HelperFn = (args: ReadonlyArray<number>) => number

const HELPER_FNS: Readonly<Record<(typeof CALCULATION_HELPERS)[number], HelperFn>> = {
  add: ([a = 0, b = 0]) => a + b,
  subtract: ([a = 0, b = 0]) => a - b,
  multiply: ([a = 0, b = 0]) => a * b,
  divide: ([a = 0, b = 0]) => (b === 0 ? 0 : a / b),
  modulo: ([a = 0, b = 0]) => (b === 0 ? 0 : a % b),
  round: ([value = 0, digits]) => roundTo(value, digits),
  ceil: ([value = 0]) => Math.ceil(value),
  floor: ([value = 0]) => Math.floor(value),
  abs: ([value = 0]) => Math.abs(value),
  min: (values) => (values.length === 0 ? 0 : Math.min(...values)),
  max: (values) => (values.length === 0 ? 0 : Math.max(...values)),
  clamp: ([value = 0, low = value, high = value]) => Math.min(Math.max(value, low), high),
  percentage: ([part = 0, whole = 0, digits]) =>
    whole === 0 ? 0 : roundTo((part / whole) * 100, digits),
}

const isCalculationHelper = (name: string): name is (typeof CALCULATION_HELPERS)[number] =>
  (CALCULATION_HELPERS as ReadonlyArray<string>).includes(name)

/**
 * Evaluate an expression against the form's values. Answers `undefined` when
 * a field it reads holds no number yet — an empty input leaves the result
 * empty rather than computing with a zero the submitter never typed.
 */
export const evaluateCalculation = (
  expression: CalculationExpression,
  values: Readonly<Record<string, unknown>>
): number | undefined => {
  if ('num' in expression) return expression.num
  if ('ref' in expression) {
    return Object.hasOwn(values, expression.ref)
      ? toCalculationNumber(values[expression.ref])
      : undefined
  }
  if (!isCalculationHelper(expression.call)) return undefined
  const args = expression.args.map((arg) => evaluateCalculation(arg, values))
  if (args.some((arg) => arg === undefined)) return undefined
  const result = HELPER_FNS[expression.call](args as ReadonlyArray<number>)
  return Number.isFinite(result) ? result : undefined
}

/** A calculation entry with its parsed expression. */
export interface ParsedCalculation {
  readonly name: string
  readonly expression: CalculationExpression
}

/**
 * Order calculations so each comes after every calculation it reads. Answers
 * the ordered list, or the names forming a cycle (first name repeated last).
 */
export const orderCalculations = (
  calculations: ReadonlyArray<ParsedCalculation>
):
  | { readonly ordered: ReadonlyArray<ParsedCalculation> }
  | { readonly cycle: ReadonlyArray<string> } => {
  const byName = new Map(calculations.map((calc) => [calc.name, calc]))
  type Walk =
    | { readonly ordered: ReadonlyArray<ParsedCalculation> }
    | { readonly cycle: ReadonlyArray<string> }
  const visit = (
    calc: ParsedCalculation,
    path: ReadonlyArray<string>,
    ordered: ReadonlyArray<ParsedCalculation>
  ): Walk => {
    if (ordered.includes(calc)) return { ordered }
    if (path.includes(calc.name)) {
      return { cycle: [...path.slice(path.indexOf(calc.name)), calc.name] }
    }
    const afterDeps = calculationReferences(calc.expression)
      .map((ref) => byName.get(ref))
      .filter((dep): dep is ParsedCalculation => dep !== undefined)
      .reduce<Walk>(
        (acc, dep) => ('cycle' in acc ? acc : visit(dep, [...path, calc.name], acc.ordered)),
        { ordered }
      )
    if ('cycle' in afterDeps) return afterDeps
    return { ordered: [...afterDeps.ordered, calc] }
  }
  return calculations.reduce<Walk>(
    (acc, calc) => ('cycle' in acc ? acc : visit(calc, [], acc.ordered)),
    { ordered: [] }
  )
}

/**
 * Compute every calculation in dependency order, each one reading the values
 * computed before it. Answers the computed values by name; a calculation whose
 * inputs are incomplete is absent from the result.
 */
export const computeCalculations = (
  ordered: ReadonlyArray<ParsedCalculation>,
  inputs: Readonly<Record<string, unknown>>
): Readonly<Record<string, number>> =>
  ordered.reduce<Readonly<Record<string, number>>>((computed, calc) => {
    const value = evaluateCalculation(calc.expression, { ...inputs, ...computed })
    return value === undefined ? computed : { ...computed, [calc.name]: value }
  }, {})

/** Two calculation values agree when they differ by no more than float noise. */
export const calculationValuesAgree = (expected: number, submitted: number): boolean =>
  Math.abs(expected - submitted) <= 1e-9 * Math.max(1, Math.abs(expected))

interface CalculationFieldLike {
  readonly kind: string
  readonly name?: string
  readonly formula?: string
}

/**
 * A form's calculations, parsed and in dependency order. Boot validation has
 * already refused an unreadable formula or a cycle, so a failure here leaves
 * the form with no computable calculation rather than throwing.
 */
export const orderedFormCalculations = (
  fields: ReadonlyArray<CalculationFieldLike>
): ReadonlyArray<ParsedCalculation> => {
  const parsed = fields.flatMap((field): ReadonlyArray<ParsedCalculation> => {
    if (field.kind !== 'calculation' || field.name === undefined) return []
    const expression = parseCalculationFormula(field.formula ?? '')
    return 'error' in expression ? [] : [{ name: field.name, expression }]
  })
  const order = orderCalculations(parsed)
  return 'ordered' in order ? order.ordered : []
}

/**
 * Recompute a submission's calculations from its inputs and hold them against
 * what the client sent. Answers the computed values to store, or the first
 * calculation (in dependency order) whose submitted value disagrees. An
 * omitted or empty submitted value is filled, never refused.
 */
export const recomputeSubmittedCalculations = (
  fields: ReadonlyArray<CalculationFieldLike>,
  body: Readonly<Record<string, unknown>>
): { readonly values: Readonly<Record<string, number>> } | { readonly mismatch: string } => {
  const ordered = orderedFormCalculations(fields)
  const inputNames = new Set(ordered.map((calc) => calc.name))
  const inputs = Object.fromEntries(Object.entries(body).filter(([key]) => !inputNames.has(key)))
  const values = computeCalculations(ordered, inputs)
  const mismatch = ordered.find((calc) => {
    const sent = body[calc.name]
    if (sent === undefined || sent === null || sent === '') return false
    const submitted = toCalculationNumber(sent)
    const expected = values[calc.name]
    if (submitted === undefined || expected === undefined) return true
    return !calculationValuesAgree(expected, submitted)
  })
  return mismatch === undefined ? { values } : { mismatch: mismatch.name }
}
