/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The unit conversions design-token export AND import both perform.
 *
 * ─── ONE MODULE, BECAUSE THE ROUND TRIP DEPENDS ON IT ─────────────────────
 *
 * A value written by an export adapter and read back by the matching import
 * comes back unchanged only when both sides convert at the same root font
 * size, round at the same precision and spell an opacity as the same byte.
 * Two copies of those three rules could drift apart silently; one module
 * cannot.
 */

/**
 * The root font size `rem` converts at. A px-only tool (Figma) has no root
 * font size, so 16px is an assumption, stated once for both directions.
 */
export const REM_BASE_PX = 16

/** The decimals a converted length or colour channel keeps. */
export const UNIT_DIGITS = 4

/** Round away binary noise (`0.1 * 3`) without hiding a real fraction. */
export const roundTo = (value: number, digits: number = UNIT_DIGITS): number => {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

/** A number printed with at most `digits` decimals, no trailing zeros, never `-0`. */
export const printNumber = (value: number, digits: number = UNIT_DIGITS): string =>
  String(roundTo(value, digits)).replace(/^-0$/, '0')

/** A `rem` amount in px, at {@link REM_BASE_PX}. */
export const remToPx = (rem: number): number => roundTo(rem * REM_BASE_PX)

/** A px amount in `rem`, at {@link REM_BASE_PX}. */
export const pxToRem = (px: number): number => roundTo(px / REM_BASE_PX)

/** An opacity on a 0–1 scale as the two hex digits of a `#rrggbbaa`, clamped. */
export const alphaHexByte = (alpha: number): string =>
  Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')

/**
 * Two hex digits (a colour channel or an opacity byte) as a fraction on a 0–1
 * scale, at six decimals: enough that {@link alphaHexByte} gives the same byte
 * back for every one of the 256 values.
 */
export const hexByteFraction = (byte: string): number => roundTo(Number.parseInt(byte, 16) / 255, 6)
