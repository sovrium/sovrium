/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { CheckConstraintSchema, CheckConstraintsSchema } from './check-constraints'

describe('CheckConstraintSchema', () => {
  test('validates a valid check constraint', () => {
    const constraint = {
      name: 'chk_active_members_have_email',
      check: '(is_active = false) OR (email IS NOT NULL)',
    }

    const result = Schema.decodeUnknownSync(CheckConstraintSchema)(constraint)

    expect(result).toEqual(constraint)
  })

  test('validates lowercase constraint name', () => {
    const constraint = {
      name: 'chk_price_positive',
      check: 'price > 0',
    }

    const result = Schema.decodeUnknownSync(CheckConstraintSchema)(constraint)

    expect(result).toEqual(constraint)
  })

  test('rejects empty constraint name', () => {
    const constraint = {
      name: '',
      check: 'price > 0',
    }

    expect(() => Schema.decodeUnknownSync(CheckConstraintSchema)(constraint)).toThrow()
  })

  test('rejects constraint name with uppercase letters', () => {
    const constraint = {
      name: 'CHK_Price_Positive',
      check: 'price > 0',
    }

    expect(() => Schema.decodeUnknownSync(CheckConstraintSchema)(constraint)).toThrow()
  })

  test('rejects constraint name starting with number', () => {
    const constraint = {
      name: '1chk_price',
      check: 'price > 0',
    }

    expect(() => Schema.decodeUnknownSync(CheckConstraintSchema)(constraint)).toThrow()
  })

  test('rejects empty check expression', () => {
    const constraint = {
      name: 'chk_price_positive',
      check: '',
    }

    expect(() => Schema.decodeUnknownSync(CheckConstraintSchema)(constraint)).toThrow()
  })

  test('accepts constraint name with underscores and numbers', () => {
    const constraint = {
      name: 'chk_field_1_gt_field_2',
      check: 'field_1 > field_2',
    }

    const result = Schema.decodeUnknownSync(CheckConstraintSchema)(constraint)

    expect(result).toEqual(constraint)
  })
})

describe('CheckConstraintsSchema', () => {
  test('validates empty array', () => {
    const constraints: never[] = []

    const result = Schema.decodeUnknownSync(CheckConstraintsSchema)(constraints)

    expect(result).toEqual([])
  })

  test('validates single constraint', () => {
    const constraints = [
      {
        name: 'chk_active_members_have_email',
        check: '(is_active = false) OR (email IS NOT NULL)',
      },
    ]

    const result = Schema.decodeUnknownSync(CheckConstraintsSchema)(constraints)

    expect(result).toEqual(constraints)
  })

  test('validates multiple constraints', () => {
    const constraints = [
      {
        name: 'chk_active_members_have_email',
        check: '(is_active = false) OR (email IS NOT NULL)',
      },
      {
        name: 'chk_price_positive',
        check: 'price > 0',
      },
      {
        name: 'chk_end_after_start',
        check: 'end_date > start_date',
      },
    ]

    const result = Schema.decodeUnknownSync(CheckConstraintsSchema)(constraints)

    expect(result).toEqual(constraints)
  })

  test('rejects array with invalid constraint', () => {
    const constraints = [
      {
        name: 'chk_valid',
        check: 'price > 0',
      },
      {
        name: 'INVALID_NAME',
        check: 'amount > 0',
      },
    ]

    expect(() => Schema.decodeUnknownSync(CheckConstraintsSchema)(constraints)).toThrow()
  })
})
