/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { formatFieldForDisplay } from './display-formatter'
import type { App } from '@/domain/models/app'
import type { CurrencyField } from '@/domain/models/app/table/field-types/currency-field'

// Helper to create a minimal app with a table and currency field
function createAppWithCurrencyField(fieldConfig: Partial<CurrencyField>): App {
  return {
    name: 'TestApp',
    tables: [
      {
        name: 'products',
        fields: [
          {
            name: 'price',
            type: 'currency',
            currency: 'USD',
            precision: 2,
            symbolPosition: 'before',
            negativeFormat: 'minus',
            thousandsSeparator: 'comma',
            ...fieldConfig,
          } as CurrencyField,
        ],
      },
    ],
  } as unknown as App
}

describe('formatFieldForDisplay', () => {
  describe('Currency Symbols', () => {
    test('formats USD with dollar symbol', () => {
      const app = createAppWithCurrencyField({ currency: 'USD' })
      const result = formatFieldForDisplay('price', 1234.56, app, 'products')
      expect(result).toBe('$1,234.56')
    })

    test('formats EUR with euro symbol', () => {
      const app = createAppWithCurrencyField({ currency: 'EUR' })
      const result = formatFieldForDisplay('price', 1234.56, app, 'products')
      expect(result).toBe('€1,234.56')
    })

    test('formats GBP with pound symbol', () => {
      const app = createAppWithCurrencyField({ currency: 'GBP' })
      const result = formatFieldForDisplay('price', 1234.56, app, 'products')
      expect(result).toBe('£1,234.56')
    })

    test('formats JPY with yen symbol', () => {
      const app = createAppWithCurrencyField({ currency: 'JPY' })
      const result = formatFieldForDisplay('price', 1234.56, app, 'products')
      expect(result).toBe('¥1,234.56')
    })

    test('uses currency code for unknown currencies', () => {
      const app = createAppWithCurrencyField({ currency: 'XYZ' })
      const result = formatFieldForDisplay('price', 1234.56, app, 'products')
      expect(result).toBe('XYZ1,234.56')
    })
  })

  describe('Precision', () => {
    test('formats with 0 decimal places', () => {
      const app = createAppWithCurrencyField({ precision: 0 })
      const result = formatFieldForDisplay('price', 1234.56, app, 'products')
      expect(result).toBe('$1,235')
    })

    test('formats with 2 decimal places (default)', () => {
      const app = createAppWithCurrencyField({ precision: 2 })
      const result = formatFieldForDisplay('price', 1234.567, app, 'products')
      expect(result).toBe('$1,234.57')
    })

    test('formats with 4 decimal places', () => {
      const app = createAppWithCurrencyField({ precision: 4 })
      const result = formatFieldForDisplay('price', 1234.567_89, app, 'products')
      expect(result).toBe('$1,234.5679')
    })

    test('handles precision undefined (defaults to 2)', () => {
      const app = createAppWithCurrencyField({ precision: undefined })
      const result = formatFieldForDisplay('price', 1234.56, app, 'products')
      expect(result).toBe('$1,234.56')
    })
  })

  describe('Symbol Position', () => {
    test('places symbol before amount (default)', () => {
      const app = createAppWithCurrencyField({ symbolPosition: 'before' })
      const result = formatFieldForDisplay('price', 1234.56, app, 'products')
      expect(result).toBe('$1,234.56')
    })

    test('places symbol after amount', () => {
      const app = createAppWithCurrencyField({ symbolPosition: 'after' })
      const result = formatFieldForDisplay('price', 1234.56, app, 'products')
      expect(result).toBe('1,234.56$')
    })

    test('handles symbolPosition undefined (defaults to before)', () => {
      const app = createAppWithCurrencyField({ symbolPosition: undefined })
      const result = formatFieldForDisplay('price', 1234.56, app, 'products')
      expect(result).toBe('$1,234.56')
    })
  })

  describe('Negative Format', () => {
    test('formats negative with minus sign (default)', () => {
      const app = createAppWithCurrencyField({ negativeFormat: 'minus' })
      const result = formatFieldForDisplay('price', -1234.56, app, 'products')
      expect(result).toBe('-$1,234.56')
    })

    test('formats negative with parentheses', () => {
      const app = createAppWithCurrencyField({ negativeFormat: 'parentheses' })
      const result = formatFieldForDisplay('price', -1234.56, app, 'products')
      expect(result).toBe('($1,234.56)')
    })

    test('handles negativeFormat undefined (defaults to minus)', () => {
      const app = createAppWithCurrencyField({ negativeFormat: undefined })
      const result = formatFieldForDisplay('price', -1234.56, app, 'products')
      expect(result).toBe('-$1,234.56')
    })

    test('does not apply negative format to positive numbers', () => {
      const app = createAppWithCurrencyField({ negativeFormat: 'parentheses' })
      const result = formatFieldForDisplay('price', 1234.56, app, 'products')
      expect(result).toBe('$1,234.56')
    })

    test('formats zero without negative formatting', () => {
      const app = createAppWithCurrencyField({ negativeFormat: 'parentheses' })
      const result = formatFieldForDisplay('price', 0, app, 'products')
      expect(result).toBe('$0.00')
    })
  })

  describe('Thousands Separator', () => {
    test('formats with comma separator (default)', () => {
      const app = createAppWithCurrencyField({ thousandsSeparator: 'comma' })
      const result = formatFieldForDisplay('price', 1_234_567.89, app, 'products')
      expect(result).toBe('$1,234,567.89')
    })

    test('formats with period separator (European style)', () => {
      const app = createAppWithCurrencyField({ thousandsSeparator: 'period' })
      const result = formatFieldForDisplay('price', 1_234_567.89, app, 'products')
      expect(result).toBe('$1.234.567,89')
    })

    test('formats with space separator', () => {
      const app = createAppWithCurrencyField({ thousandsSeparator: 'space' })
      const result = formatFieldForDisplay('price', 1_234_567.89, app, 'products')
      expect(result).toBe('$1 234 567.89')
    })

    test('formats with no separator', () => {
      const app = createAppWithCurrencyField({ thousandsSeparator: 'none' })
      const result = formatFieldForDisplay('price', 1_234_567.89, app, 'products')
      expect(result).toBe('$1234567.89')
    })

    test('handles thousandsSeparator undefined (defaults to comma)', () => {
      const app = createAppWithCurrencyField({ thousandsSeparator: undefined })
      const result = formatFieldForDisplay('price', 1_234_567.89, app, 'products')
      expect(result).toBe('$1,234,567.89')
    })

    test('uses comma as decimal separator when period is thousands separator', () => {
      const app = createAppWithCurrencyField({ thousandsSeparator: 'period', precision: 2 })
      const result = formatFieldForDisplay('price', 1234.56, app, 'products')
      expect(result).toBe('$1.234,56')
    })

    test('uses period as decimal separator for non-period thousands separators', () => {
      const app = createAppWithCurrencyField({ thousandsSeparator: 'comma', precision: 2 })
      const result = formatFieldForDisplay('price', 1234.56, app, 'products')
      expect(result).toBe('$1,234.56')
    })
  })

  describe('Edge Cases', () => {
    test('formats zero correctly', () => {
      const app = createAppWithCurrencyField({})
      const result = formatFieldForDisplay('price', 0, app, 'products')
      expect(result).toBe('$0.00')
    })

    test('formats very small positive numbers', () => {
      const app = createAppWithCurrencyField({ precision: 4 })
      const result = formatFieldForDisplay('price', 0.0001, app, 'products')
      expect(result).toBe('$0.0001')
    })

    test('formats very small negative numbers', () => {
      const app = createAppWithCurrencyField({ precision: 4 })
      const result = formatFieldForDisplay('price', -0.0001, app, 'products')
      expect(result).toBe('-$0.0001')
    })

    test('formats very large numbers', () => {
      const app = createAppWithCurrencyField({})
      const result = formatFieldForDisplay('price', 1_234_567_890.12, app, 'products')
      expect(result).toBe('$1,234,567,890.12')
    })

    test('handles string numeric values', () => {
      const app = createAppWithCurrencyField({})
      const result = formatFieldForDisplay('price', '1234.56', app, 'products')
      expect(result).toBe('$1,234.56')
    })

    test('returns undefined for invalid numeric strings', () => {
      const app = createAppWithCurrencyField({})
      const result = formatFieldForDisplay('price', 'invalid', app, 'products')
      expect(result).toBeUndefined()
    })

    test('returns undefined for NaN values', () => {
      const app = createAppWithCurrencyField({})
      const result = formatFieldForDisplay('price', NaN, app, 'products')
      expect(result).toBeUndefined()
    })
  })

  describe('Complex Combinations', () => {
    test('formats negative with parentheses, after symbol, and period separator', () => {
      const app = createAppWithCurrencyField({
        currency: 'EUR',
        negativeFormat: 'parentheses',
        symbolPosition: 'after',
        thousandsSeparator: 'period',
        precision: 2,
      })
      const result = formatFieldForDisplay('price', -1_234_567.89, app, 'products')
      expect(result).toBe('(1.234.567,89€)')
    })

    test('formats with space separator and 0 precision', () => {
      const app = createAppWithCurrencyField({
        thousandsSeparator: 'space',
        precision: 0,
      })
      const result = formatFieldForDisplay('price', 1_234_567, app, 'products')
      expect(result).toBe('$1 234 567')
    })

    test('formats CAD with all custom settings', () => {
      const app = createAppWithCurrencyField({
        currency: 'CAD',
        precision: 4,
        symbolPosition: 'after',
        negativeFormat: 'parentheses',
        thousandsSeparator: 'space',
      })
      const result = formatFieldForDisplay('price', -12_345.6789, app, 'products')
      expect(result).toBe('(12 345.6789$)')
    })
  })

  describe('Non-Currency Fields', () => {
    test('returns undefined for non-currency field types', () => {
      const app: App = {
        name: 'TestApp',
        tables: [
          {
            name: 'products',
            fields: [
              {
                name: 'name',
                type: 'text',
              },
            ],
          },
        ],
      } as unknown as App

      const result = formatFieldForDisplay('name', 'Product Name', app, 'products')
      expect(result).toBeUndefined()
    })
  })

  describe('Missing Table or Field', () => {
    test('returns undefined when table does not exist', () => {
      const app = createAppWithCurrencyField({})
      const result = formatFieldForDisplay('price', 1234.56, app, 'nonexistent')
      expect(result).toBeUndefined()
    })

    test('returns undefined when field does not exist', () => {
      const app = createAppWithCurrencyField({})
      const result = formatFieldForDisplay('nonexistent', 1234.56, app, 'products')
      expect(result).toBeUndefined()
    })

    test('returns undefined when app has no tables', () => {
      const app: App = {
        name: 'TestApp',
        tables: undefined,
      } as App

      const result = formatFieldForDisplay('price', 1234.56, app, 'products')
      expect(result).toBeUndefined()
    })
  })
})
