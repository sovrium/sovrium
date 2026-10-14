/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The value axis of a cartesian chart: which numbers it spans and which it
 * labels, decided here and handed to recharts' `YAxis` as an explicit `domain`
 * and `ticks`.
 *
 * recharts would choose both on its own, and it chooses differently: its tick
 * algorithm splits `[0, 7000]` into `0, 1750, 3500, 5250, 7000`, which a
 * currency axis prints as `€1.75K`. The ticks below are the ones charts have
 * always printed — d3's round steps (`0, 1000, … 7000`) over a domain rounded
 * out to the next step — so an axis reads the same after the port as before it.
 *
 * A logarithmic axis starts one decade below the smallest positive value and
 * labels every power of ten inside its span. Its marks are drawn by recharts'
 * own log scale; a value at or below zero, which no log scale can place, is
 * plotted at the floor (see {@link plotValue}).
 */

/** How a value axis maps data onto pixels — the `yAxis.scale` literal. */
export type ValueAxisScale = 'linear' | 'logarithmic'

/** A resolved value axis: the span recharts draws, the values it labels, its scale. */
export interface ValueAxis {
  readonly domain: readonly [number, number]
  readonly ticks: readonly number[]
  readonly scale: 'linear' | 'log'
}

/** The number of tick labels a linear value axis aims for. */
const VALUE_TICK_TARGET = 5

/** How finely a linear domain is rounded out before its ticks are chosen. */
const NICE_TARGET = 10

const E10 = Math.sqrt(50)
const E5 = Math.sqrt(10)
const E2 = Math.sqrt(2)

/** The round step (1, 2 or 5 times a power of ten) splitting `[start, stop]` into ~`count` parts. */
function tickIncrement(start: number, stop: number, count: number): number {
  const step = (stop - start) / Math.max(0, count)
  const power = Math.floor(Math.log10(step))
  const error = step / 10 ** power
  const factor = error >= E10 ? 10 : error >= E5 ? 5 : error >= E2 ? 2 : 1
  // A negative increment encodes a fractional step as its inverse, as d3 does,
  // so a step of 0.2 is held as the exact integer 5 rather than as 0.2000…01.
  return power >= 0 ? 10 ** power * factor : -(10 ** -power) / factor
}

/** `[start, stop]` rounded out to whole steps of the increment chosen for `count`. */
export function niceDomain(
  start: number,
  stop: number,
  count: number = NICE_TARGET
): readonly [number, number] {
  const round = (
    bounds: readonly [number, number],
    previous: number | undefined,
    remaining: number
  ): readonly [number, number] => {
    const step = tickIncrement(bounds[0], bounds[1], count)
    if (remaining === 0 || step === previous || !Number.isFinite(step) || step === 0) return bounds
    const next: readonly [number, number] =
      step > 0
        ? [Math.floor(bounds[0] / step) * step, Math.ceil(bounds[1] / step) * step]
        : [Math.ceil(bounds[0] * step) / step, Math.floor(bounds[1] * step) / step]
    return round(next, step, remaining - 1)
  }
  return stop > start ? round([start, stop], undefined, 10) : [start, stop]
}

/** The round values inside `[start, stop]`, about `count` of them. */
export function linearTicks(start: number, stop: number, count: number): readonly number[] {
  if (start === stop) return [start]
  const step = tickIncrement(start, stop, count)
  if (!Number.isFinite(step) || step === 0) return []
  const scaled = (value: number): number => (step > 0 ? value / step : value * -step)
  const first = Math.ceil(scaled(start) - 1e-9)
  const last = Math.floor(scaled(stop) + 1e-9)
  const length = Math.max(0, last - first + 1)
  return Array.from({ length }, (_, index) =>
    step > 0 ? (first + index) * step : (first + index) / -step
  )
}

/** One decade below the smallest positive value, so the smallest mark keeps a visible height. */
function logarithmicFloor(minPositive: number): number {
  return 10 ** (Math.floor(Math.log10(minPositive)) - 1)
}

/** Every power of ten inside `[floor, top]` — the labels a log axis carries. */
function decadeTicks(floor: number, top: number): readonly number[] {
  const first = Math.ceil(Math.log10(floor))
  const span = Math.floor(Math.log10(top)) - first + 1
  return Array.from({ length: Math.max(0, span) }, (_, index) => 10 ** (first + index))
}

/**
 * Builds the value axis of one plot from the declared `yAxis.scale`.
 *
 * Logarithmic is honoured only when the data can carry it — at least one
 * strictly positive value. A series that is all zeroes has no logarithmic
 * reading, so it falls back to linear rather than to an empty domain.
 */
export function buildValueAxis(args: {
  readonly maxValue: number
  readonly minPositiveValue: number
  readonly scale: ValueAxisScale | undefined
}): ValueAxis {
  const max = args.maxValue > 0 ? args.maxValue : 1
  const usable = Number.isFinite(args.minPositiveValue) && args.minPositiveValue > 0
  if (args.scale === 'logarithmic' && usable) {
    const floor = logarithmicFloor(args.minPositiveValue)
    // Not rounded out to the next decade: the tallest mark keeps the top of
    // the plot, so two charts differing only in `scale` stay comparable.
    const top = max > floor ? max : floor * 10
    return { domain: [floor, top], ticks: decadeTicks(floor, top), scale: 'log' }
  }
  const domain = niceDomain(0, max)
  return { domain, ticks: linearTicks(domain[0], domain[1], VALUE_TICK_TARGET), scale: 'linear' }
}

/**
 * The value a mark is drawn at on this axis: the value itself, or the floor
 * of a logarithmic axis for a value that axis cannot place.
 */
export function plotValue(axis: ValueAxis, value: number): number {
  return axis.scale === 'log' && !(value > axis.domain[0]) ? axis.domain[0] : value
}
