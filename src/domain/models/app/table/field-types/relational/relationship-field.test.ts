/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { RelationshipFieldSchema } from './relationship-field'

describe('RelationshipFieldSchema', () => {
  describe('valid values', () => {
    test('should accept valid relationship field', () => {
      // Given: A valid input
      const field = {
        id: 1,
        name: 'author',
        type: 'relationship' as const,
        relatedTable: 'users',
        relationType: 'many-to-one',

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }

      const result = Schema.decodeSync(RelationshipFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept relationship field with reciprocalField', () => {
      // Given: A valid input with reciprocalField for bidirectional relationships
      const field = {
        id: 1,
        name: 'tasks',
        type: 'relationship' as const,
        relatedTable: 'tasks',
        relationType: 'one-to-many',
        reciprocalField: 'project',
      }

      const result = Schema.decodeSync(RelationshipFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept relationship field with allowMultiple', () => {
      // Given: A valid input with allowMultiple for single-link constraint
      const field = {
        id: 1,
        name: 'assignee',
        type: 'relationship' as const,
        relatedTable: 'users',
        relationType: 'many-to-one',
        allowMultiple: false,
      }

      const result = Schema.decodeSync(RelationshipFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept relationship field with limitToView', () => {
      // Given: A valid input with limitToView to restrict linkable records
      const field = {
        id: 1,
        name: 'lead_developer',
        type: 'relationship' as const,
        relatedTable: 'users',
        relationType: 'many-to-one',
        limitToView: 'active_developers',
      }

      const result = Schema.decodeSync(RelationshipFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept relationship field with all optional properties', () => {
      // Given: A valid input with all optional properties
      const field = {
        id: 1,
        name: 'project',
        type: 'relationship' as const,
        relatedTable: 'projects',
        relationType: 'many-to-one',
        displayField: 'name',
        onDelete: 'cascade',
        onUpdate: 'cascade',
        reciprocalField: 'tasks',
        allowMultiple: true,
        limitToView: 'active_projects',
        required: true,
        unique: false,
        indexed: true,
      }

      const result = Schema.decodeSync(RelationshipFieldSchema)(field)
      expect(result).toEqual(field)
    })
  })

  describe('invalid values', () => {
    test('should reject field without relatedTable', () => {
      // Given: An invalid input
      const field = {
        id: 1,
        name: 'author',
        type: 'relationship' as const,
        relationType: 'many-to-one',

        // When: The value is validated against the schema
        // Then: Validation should throw an error
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: relatedTable
        Schema.decodeSync(RelationshipFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field with empty reciprocalField', () => {
      // Given: An invalid input with empty reciprocalField
      const field = {
        id: 1,
        name: 'tasks',
        type: 'relationship' as const,
        relatedTable: 'tasks',
        relationType: 'one-to-many',
        reciprocalField: '',
      }

      expect(() => {
        Schema.decodeSync(RelationshipFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field with empty limitToView', () => {
      // Given: An invalid input with empty limitToView
      const field = {
        id: 1,
        name: 'lead',
        type: 'relationship' as const,
        relatedTable: 'users',
        relationType: 'many-to-one',
        limitToView: '',
      }

      expect(() => {
        Schema.decodeSync(RelationshipFieldSchema)(field)
      }).toThrow()
    })
  })
})
