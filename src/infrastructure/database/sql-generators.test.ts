/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import {
  mapFieldTypeToPostgres,
  generateColumnDefinition,
  generateTableConstraints,
  generateUniqueConstraints,
  isUserReferenceField,
  isUserField,
} from './sql-generators'
import type { Fields } from '@/domain/models/app/table/fields'

describe('sql-generators', () => {
  describe('isUserReferenceField', () => {
    test('returns true for created-by field', () => {
      // Given

      const field = {
        name: 'created_by',
        type: 'created-by',
      }

      // When
      const result = isUserReferenceField(field as any)

      // Then
      expect(result).toBe(true)
    })

    test('returns true for updated-by field', () => {
      // Given

      const field = {
        name: 'updated_by',
        type: 'updated-by',
      }

      // When
      const result = isUserReferenceField(field as any)

      // Then
      expect(result).toBe(true)
    })

    test('returns false for user field', () => {
      // Given

      const field = {
        name: 'author',
        type: 'user',
      }

      // When
      const result = isUserReferenceField(field as any)

      // Then
      expect(result).toBe(false)
    })

    test('returns false for non-user reference fields', () => {
      // Given

      const textField = {
        name: 'title',
        type: 'single-line-text',
      }

      const integerField = {
        name: 'count',
        type: 'integer',
      }

      // When/Then
      expect(isUserReferenceField(textField as any)).toBe(false)
      expect(isUserReferenceField(integerField as any)).toBe(false)
    })
  })

  describe('isUserField', () => {
    test('returns true for user field', () => {
      // Given

      const field = {
        name: 'author',
        type: 'user',
      }

      // When
      const result = isUserField(field as any)

      // Then
      expect(result).toBe(true)
    })

    test('returns false for created-by field', () => {
      // Given

      const field = {
        name: 'created_by',
        type: 'created-by',
      }

      // When
      const result = isUserField(field as any)

      // Then
      expect(result).toBe(false)
    })

    test('returns false for updated-by field', () => {
      // Given

      const field = {
        name: 'updated_by',
        type: 'updated-by',
      }

      // When
      const result = isUserField(field as any)

      // Then
      expect(result).toBe(false)
    })

    test('returns false for non-user fields', () => {
      // Given

      const emailField = {
        name: 'email',
        type: 'email',
      }

      const checkboxField = {
        name: 'active',
        type: 'checkbox',
      }

      // When/Then
      expect(isUserField(emailField as any)).toBe(false)
      expect(isUserField(checkboxField as any)).toBe(false)
    })
  })

  describe('mapFieldTypeToPostgres', () => {
    test('maps integer to INTEGER', () => {
      // Given

      const field = {
        name: 'count',
        type: 'integer',
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('INTEGER')
    })

    test('maps single-line-text to VARCHAR(255)', () => {
      // Given

      const field = {
        name: 'title',
        type: 'single-line-text',
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('VARCHAR(255)')
    })

    test('maps long-text to TEXT', () => {
      // Given

      const field = {
        name: 'description',
        type: 'long-text',
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('TEXT')
    })

    test('maps email to VARCHAR(255)', () => {
      // Given

      const field = {
        name: 'email',
        type: 'email',
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('VARCHAR(255)')
    })

    test('maps checkbox to BOOLEAN', () => {
      // Given

      const field = {
        name: 'active',
        type: 'checkbox',
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('BOOLEAN')
    })

    test('maps date to DATE', () => {
      // Given

      const field = {
        name: 'birth_date',
        type: 'date',
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('DATE')
    })

    test('maps datetime to TIMESTAMPTZ', () => {
      // Given

      const field = {
        name: 'event_time',
        type: 'datetime',
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('TIMESTAMPTZ')
    })

    test('maps decimal to DECIMAL', () => {
      // Given

      const field = {
        name: 'price',
        type: 'decimal',
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('DECIMAL')
    })

    test('maps decimal with precision to NUMERIC', () => {
      // Given

      const field = {
        name: 'price',
        type: 'decimal',
        precision: 10,
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('NUMERIC(10,2)')
    })

    test('maps currency with precision to NUMERIC', () => {
      // Given

      const field = {
        name: 'amount',
        type: 'currency',
        precision: 12,
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('NUMERIC(12,2)')
    })

    test('maps percentage with precision to NUMERIC', () => {
      // Given

      const field = {
        name: 'discount',
        type: 'percentage',
        precision: 5,
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('NUMERIC(5,2)')
    })

    test('maps user to TEXT', () => {
      // Given

      const field = {
        name: 'author',
        type: 'user',
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('TEXT')
    })

    test('maps created-by to TEXT', () => {
      // Given

      const field = {
        name: 'created_by',
        type: 'created-by',
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('TEXT')
    })

    test('maps updated-by to TEXT', () => {
      // Given

      const field = {
        name: 'updated_by',
        type: 'updated-by',
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('TEXT')
    })

    test('maps json to JSONB', () => {
      // Given

      const field = {
        name: 'metadata',
        type: 'json',
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('JSONB')
    })

    test('maps multi-select to TEXT[]', () => {
      // Given

      const field = {
        name: 'tags',
        type: 'multi-select',
        options: ['tag1', 'tag2'],
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('TEXT[]')
    })

    test('maps array with default itemType to TEXT[]', () => {
      // Given

      const field = {
        name: 'items',
        type: 'array',
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('TEXT[]')
    })

    test('maps array with integer itemType to INTEGER[]', () => {
      // Given

      const field = {
        name: 'numbers',
        type: 'array',
        itemType: 'integer',
      }

      // When
      const result = mapFieldTypeToPostgres(field as any)

      // Then
      expect(result).toBe('INTEGER[]')
    })
  })

  describe('generateColumnDefinition', () => {
    test('generates definition for simple text field', () => {
      // Given

      const field = {
        name: 'title',
        type: 'single-line-text',
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe('title VARCHAR(255)')
    })

    test('generates definition for required field with NOT NULL', () => {
      // Given

      const field = {
        name: 'title',
        type: 'single-line-text',
        required: true,
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe('title VARCHAR(255) NOT NULL')
    })

    test('generates definition for field with default value', () => {
      // Given

      const field = {
        name: 'status',
        type: 'single-line-text',
        default: 'draft',
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe("status VARCHAR(255) DEFAULT 'draft'")
    })

    test('generates definition for checkbox field with boolean default', () => {
      // Given

      const field = {
        name: 'active',
        type: 'checkbox',
        default: true,
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe('active BOOLEAN DEFAULT true')
    })

    test('generates SERIAL for autonumber field', () => {
      // Given

      const field = {
        name: 'order_number',
        type: 'autonumber',
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe('order_number SERIAL NOT NULL')
    })

    test('generates SERIAL for integer primary key', () => {
      // Given

      const field = {
        name: 'id',
        type: 'integer',
      }

      // When
      const result = generateColumnDefinition(field as any, true)

      // Then
      expect(result).toBe('id SERIAL NOT NULL')
    })

    test('generates definition for created-at with CURRENT_TIMESTAMP', () => {
      // Given

      const field = {
        name: 'created_at',
        type: 'created-at',
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe('created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP')
    })

    test('generates definition for updated-at with CURRENT_TIMESTAMP', () => {
      // Given

      const field = {
        name: 'updated_at',
        type: 'updated-at',
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe('updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP')
    })

    test('generates definition for created-by with NOT NULL', () => {
      // Given

      const field = {
        name: 'created_by',
        type: 'created-by',
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe('created_by TEXT NOT NULL')
    })

    test('generates definition for updated-by with NOT NULL', () => {
      // Given

      const field = {
        name: 'updated_by',
        type: 'updated-by',
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe('updated_by TEXT NOT NULL')
    })

    test('generates GENERATED column for formula field', () => {
      // Given

      const field = {
        name: 'total',
        type: 'formula',
        formula: 'price * quantity',
        resultType: 'decimal',
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe('total DECIMAL GENERATED ALWAYS AS (price * quantity) STORED')
    })

    test('generates GENERATED column for formula with integer result', () => {
      // Given

      const field = {
        name: 'count',
        type: 'formula',
        formula: 'items + 1',
        resultType: 'integer',
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe('count INTEGER GENERATED ALWAYS AS (items + 1) STORED')
    })

    test('generates GENERATED column with TEXT default for formula without resultType', () => {
      // Given

      const field = {
        name: 'computed',
        type: 'formula',
        formula: 'value',
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe('computed TEXT GENERATED ALWAYS AS (value) STORED')
    })

    test('auto-detects TEXT[] for STRING_TO_ARRAY formula without array resultType', () => {
      // Given
      const field = {
        name: 'parts',
        type: 'formula',
        formula: "STRING_TO_ARRAY(text, ',')",
        resultType: 'text',
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe("parts TEXT[] GENERATED ALWAYS AS (STRING_TO_ARRAY(text, ',')) STORED")
    })

    test('does not add duplicate [] when resultType already specifies array', () => {
      // Given
      const field = {
        name: 'items',
        type: 'formula',
        formula: "STRING_TO_ARRAY(data, ';')",
        resultType: 'text[]',
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe("items TEXT[] GENERATED ALWAYS AS (STRING_TO_ARRAY(data, ';')) STORED")
    })

    test('handles STRING_TO_ARRAY with string[] resultType', () => {
      // Given
      const field = {
        name: 'values',
        type: 'formula',
        formula: "STRING_TO_ARRAY(field, ',')",
        resultType: 'string[]',
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe("values TEXT[] GENERATED ALWAYS AS (STRING_TO_ARRAY(field, ',')) STORED")
    })

    test('translates SUBSTR in formula with array detection', () => {
      // Given
      const field = {
        name: 'parts',
        type: 'formula',
        formula: "STRING_TO_ARRAY(SUBSTR(text, 1, 10), ',')",
        resultType: 'text',
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe(
        "parts TEXT[] GENERATED ALWAYS AS (STRING_TO_ARRAY(SUBSTRING(text FROM 1 FOR 10), ',')) STORED"
      )
    })

    test('generates GENERATED column for nested function calls', () => {
      // Given
      const field = {
        name: 'result',
        type: 'formula',
        formula: 'ROUND(SQRT(ABS(value)), 2)',
        resultType: 'decimal',
      }

      // When
      const result = generateColumnDefinition(field as any, false)

      // Then
      expect(result).toBe('result DECIMAL GENERATED ALWAYS AS (ROUND(SQRT(ABS(value)), 2)) STORED')
    })
  })

  describe('generateUniqueConstraints', () => {
    test('generates UNIQUE constraint for field with unique property', () => {
      // Given
      const tableName = 'users'
      const fields = [
        {
          name: 'email',
          type: 'email',
          unique: true,
        },
      ] as unknown as readonly Fields[number][]

      // When
      const result = generateUniqueConstraints(tableName, fields)

      // Then
      expect(result).toEqual(['CONSTRAINT users_email_key UNIQUE (email)'])
    })

    test('generates multiple UNIQUE constraints', () => {
      // Given
      const tableName = 'products'
      const fields = [
        {
          name: 'sku',
          type: 'single-line-text',
          unique: true,
        },
        {
          name: 'barcode',
          type: 'barcode',
          format: 'EAN-13',
          unique: true,
        },
      ] as unknown as readonly Fields[number][]

      // When
      const result = generateUniqueConstraints(tableName, fields)

      // Then
      expect(result).toEqual([
        'CONSTRAINT products_sku_key UNIQUE (sku)',
        'CONSTRAINT products_barcode_key UNIQUE (barcode)',
      ])
    })

    test('returns empty array when no unique fields', () => {
      // Given
      const tableName = 'posts'
      const fields = [
        {
          name: 'title',
          type: 'single-line-text',
        },
        {
          name: 'content',
          type: 'long-text',
        },
      ] as unknown as readonly Fields[number][]

      // When
      const result = generateUniqueConstraints(tableName, fields)

      // Then
      expect(result).toEqual([])
    })

    test('ignores fields without unique property', () => {
      // Given
      const tableName = 'tasks'
      const fields = [
        {
          name: 'title',
          type: 'single-line-text',
        },
        {
          name: 'code',
          type: 'single-line-text',
          unique: true,
        },
        {
          name: 'description',
          type: 'long-text',
        },
      ] as unknown as readonly Fields[number][]

      // When
      const result = generateUniqueConstraints(tableName, fields)

      // Then
      expect(result).toEqual(['CONSTRAINT tasks_code_key UNIQUE (code)'])
    })
  })

  describe('generateTableConstraints', () => {
    test('generates CHECK constraint for numeric field with min/max', () => {
      // Given

      const table = {
        name: 'products',
        fields: [
          {
            name: 'rating',
            type: 'rating',
            min: 1,
            max: 5,
          },
        ] as any,
      }

      // When
      const result = generateTableConstraints(table as any)

      // Then
      expect(result).toContain('CONSTRAINT check_rating_range CHECK (rating >= 1 AND rating <= 5)')
    })

    test('generates CHECK constraint for progress field (0-100)', () => {
      // Given

      const table = {
        name: 'tasks',
        fields: [
          {
            name: 'completion',
            type: 'progress',
          },
        ] as any,
      }

      // When
      const result = generateTableConstraints(table as any)

      // Then
      expect(result).toContain(
        'CONSTRAINT check_completion_range CHECK (completion >= 0 AND completion <= 100)'
      )
    })

    test('generates CHECK constraint for single-select enum', () => {
      // Given

      const table = {
        name: 'posts',
        fields: [
          {
            name: 'status',
            type: 'single-select',
            options: ['draft', 'published', 'archived'],
          },
        ] as any,
      }

      // When
      const result = generateTableConstraints(table as any)

      // Then
      expect(result).toContain(
        "CONSTRAINT check_status_enum CHECK (status IN ('draft', 'published', 'archived'))"
      )
    })

    test('generates CHECK constraint for status field', () => {
      // Given
      const table = {
        id: 1,
        name: 'tasks',
        fields: [
          {
            name: 'status',
            type: 'status',
            options: [
              { value: 'todo', color: '#gray' },
              { value: 'in-progress', color: '#blue' },
              { value: 'done', color: '#green' },
            ] as any,
          },
        ] as any,
      }

      // When
      const result = generateTableConstraints(table as any)

      // Then
      expect(result).toContain(
        "CONSTRAINT check_status_enum CHECK (status IN ('todo', 'in-progress', 'done'))"
      )
    })

    test('generates UNIQUE constraint', () => {
      // Given
      const table = {
        id: 1,
        name: 'users',
        fields: [
          {
            name: 'email',
            type: 'email',
            unique: true,
          },
        ] as any,
      }

      // When
      const result = generateTableConstraints(table as any)

      // Then
      expect(result).toContain('CONSTRAINT users_email_key UNIQUE (email)')
    })

    test('generates FOREIGN KEY constraint for user field', () => {
      // Given
      const table = {
        id: 1,
        name: 'posts',
        fields: [
          {
            name: 'author',
            type: 'user',
          },
        ] as any,
      }

      // When
      const result = generateTableConstraints(table as any)

      // Then
      expect(result).toContain(
        'CONSTRAINT posts_author_fkey FOREIGN KEY (author) REFERENCES public.users(id)'
      )
    })

    test('generates PRIMARY KEY constraint for composite key', () => {
      // Given
      const table = {
        id: 1,
        name: 'user_roles',
        fields: [
          {
            name: 'user_id',
            type: 'integer',
          },
          {
            name: 'role_id',
            type: 'integer',
          },
        ] as any,
        primaryKey: {
          type: 'composite',
          fields: ['user_id', 'role_id'],
        },
      }

      // When
      const result = generateTableConstraints(table as any)

      // Then
      expect(result).toContain('PRIMARY KEY (user_id, role_id)')
    })

    test('generates CHECK constraint for array with maxItems', () => {
      // Given

      const table = {
        name: 'posts',
        fields: [
          {
            name: 'tags',
            type: 'array',
            itemType: 'text',
            maxItems: 5,
          },
        ] as any,
      }

      // When
      const result = generateTableConstraints(table as any)

      // Then
      expect(result).toContain(
        'CONSTRAINT check_tags_max_items CHECK (array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 5)'
      )
    })

    test('generates CHECK constraint for rich-text with maxLength', () => {
      // Given

      const table = {
        name: 'posts',
        fields: [
          {
            name: 'content',
            type: 'rich-text',
            maxLength: 10_000,
          },
        ] as any,
      }

      // When
      const result = generateTableConstraints(table as any)

      // Then
      expect(result).toContain(
        'CONSTRAINT check_content_max_length CHECK (LENGTH(content) <= 10000)'
      )
    })

    test('generates CHECK constraint for barcode format', () => {
      // Given

      const table = {
        name: 'products',
        fields: [
          {
            name: 'barcode',
            type: 'barcode',
            format: 'EAN-13',
          },
        ] as any,
      }

      // When
      const result = generateTableConstraints(table as any)

      // Then
      expect(result).toContain("CONSTRAINT check_barcode_format CHECK (barcode ~ '^[0-9]{13}$')")
    })

    test('generates CHECK constraint for color field (hex format)', () => {
      // Given

      const table = {
        name: 'themes',
        fields: [
          {
            name: 'primary_color',
            type: 'color',
          },
        ] as any,
      }

      // When
      const result = generateTableConstraints(table as any)

      // Then
      expect(result).toContain(
        "CONSTRAINT check_primary_color_format CHECK (primary_color ~ '^#[0-9a-fA-F]{6}$')"
      )
    })

    test('generates multiple constraints for complex table', () => {
      // Given

      const table = {
        name: 'products',
        fields: [
          {
            name: 'sku',
            type: 'single-line-text',
            unique: true,
          },
          {
            name: 'rating',
            type: 'rating',
            min: 1,
            max: 5,
          },
          {
            name: 'status',
            type: 'single-select',
            options: ['active', 'inactive'],
          },
          {
            name: 'owner',
            type: 'user',
          },
        ] as any,
      }

      // When
      const result = generateTableConstraints(table as any)

      // Then
      expect(result.length).toBeGreaterThan(0)
      expect(result).toContain('CONSTRAINT products_sku_key UNIQUE (sku)')
      expect(result).toContain('CONSTRAINT check_rating_range CHECK (rating >= 1 AND rating <= 5)')
      expect(result).toContain(
        "CONSTRAINT check_status_enum CHECK (status IN ('active', 'inactive'))"
      )
      expect(result).toContain(
        'CONSTRAINT products_owner_fkey FOREIGN KEY (owner) REFERENCES public.users(id)'
      )
    })

    test('returns empty array when no constraints needed', () => {
      // Given

      const table = {
        name: 'simple',
        fields: [
          {
            name: 'title',
            type: 'single-line-text',
          },
          {
            name: 'description',
            type: 'long-text',
          },
        ] as any,
      }

      // When
      const result = generateTableConstraints(table as any)

      // Then
      expect(result).toEqual([])
    })
  })
})
