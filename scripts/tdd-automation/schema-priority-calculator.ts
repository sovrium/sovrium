/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Schema-Based Priority Calculator
 *
 * Processes tests by domain (App → Api → Admin) and schema group in serial,
 * with regression tests last for each group.
 *
 * Domain priority order:
 * - APP specs: 0-999,999 (highest priority, runs first)
 * - API specs: 1,000,000-1,999,999 (medium priority, runs after APP)
 * - ADMIN specs: 2,000,000-2,999,999 (lowest priority, runs last)
 *
 * Priority calculation within each domain:
 * - Schema groups get base priorities (1000, 2000, 3000, etc.) based on hierarchy
 * - Within each schema: individual tests (+1, +2, +3, etc.)
 * - Regression tests: +900 (ensures they run last in their schema group)
 *
 * Example execution order:
 * - APP-VERSION-001 (1001), APP-VERSION-002 (1002), APP-VERSION-REGRESSION (1900)
 * - APP-NAME-001 (2001), APP-NAME-002 (2002), APP-NAME-REGRESSION (2900)
 * - API-PATHS-HEALTH-001 (1,001,001), API-PATHS-AUTH-001 (1,002,001)
 * - ADMIN-TABLES-001 (2,001,001), ADMIN-TABLES-002 (2,001,002)
 *
 * This ensures:
 * 1. All APP specs complete before API specs
 * 2. All API specs complete before ADMIN specs
 * 3. All tests from same schema are processed together
 * 4. Regression tests validate the schema after all its tests
 * 5. Schema order follows hierarchy (required root → optional root → nested)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Spec domain type
 */
type SpecDomain = 'app' | 'api' | 'admin'

/**
 * Domain base priorities (in millions to separate domains completely)
 */
const DOMAIN_BASE_PRIORITIES: Record<SpecDomain, number> = {
  app: 0, // Runs first (0-999,999)
  api: 1_000_000, // Runs after APP specs (1,000,000-1,999,999)
  admin: 2_000_000, // Runs after API specs (2,000,000-2,999,999)
}

/**
 * Schema property metadata
 */
interface SchemaProperty {
  name: string
  level: number
  required: boolean
  parent: string | null
}

/**
 * Schema hierarchy map
 */
type SchemaHierarchy = Map<string, SchemaProperty>

/**
 * Detect spec domain from spec ID prefix
 *
 * @param specId Full spec ID (e.g., "APP-VERSION-001", "API-PATHS-HEALTH-001", "ADMIN-TABLES-001")
 * @returns Domain type ('app', 'api', or 'admin')
 */
function getSpecDomain(specId: string): SpecDomain {
  const prefix = specId.split('-')[0]?.toUpperCase()
  if (prefix === 'APP') return 'app'
  if (prefix === 'API') return 'api'
  if (prefix === 'ADMIN') return 'admin'
  return 'app' // Default fallback for unknown prefixes
}

/**
 * Load and parse app.schema.json to build hierarchy
 */
export function loadSchemaHierarchy(rootSchemaPath: string): SchemaHierarchy {
  const hierarchy = new Map<string, SchemaProperty>()
  const schemasDir = path.dirname(rootSchemaPath)

  // Load root schema
  const rootSchema = JSON.parse(fs.readFileSync(rootSchemaPath, 'utf-8'))
  const requiredProps = new Set(rootSchema.required || [])

  // Process root properties
  for (const [propName, propDef] of Object.entries(rootSchema.properties || {})) {
    const prop: SchemaProperty = {
      name: propName,
      level: 1,
      required: requiredProps.has(propName),
      parent: null,
    }
    hierarchy.set(`app/${propName}`, prop)

    // Load nested schema if referenced
    const ref = (propDef as { $ref?: string }).$ref
    if (ref) {
      const nestedSchemaPath = path.resolve(schemasDir, ref)
      if (fs.existsSync(nestedSchemaPath)) {
        processNestedSchema(nestedSchemaPath, `app/${propName}`, 2, hierarchy)
      }
    }
  }

  return hierarchy
}

/**
 * Recursively process nested schema files
 */
function processNestedSchema(
  schemaPath: string,
  parentPath: string,
  level: number,
  hierarchy: SchemaHierarchy
): void {
  try {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'))
    const requiredProps = new Set(schema.required || [])
    const schemasDir = path.dirname(schemaPath)

    for (const [propName, propDef] of Object.entries(schema.properties || {})) {
      const fullPath = `${parentPath}/${propName}`
      const prop: SchemaProperty = {
        name: propName,
        level,
        required: requiredProps.has(propName),
        parent: parentPath,
      }
      hierarchy.set(fullPath, prop)

      // Recursively process nested references (limit depth to prevent infinite loops)
      if (level < 5) {
        const ref = (propDef as { $ref?: string }).$ref
        if (ref) {
          const nestedSchemaPath = path.resolve(schemasDir, ref)
          if (fs.existsSync(nestedSchemaPath)) {
            processNestedSchema(nestedSchemaPath, fullPath, level + 1, hierarchy)
          }
        }
      }
    }
  } catch (error) {
    // Silently skip schemas that can't be parsed
    console.error(`Warning: Could not parse schema at ${schemaPath}:`, error)
  }
}

/**
 * Calculate priority for a spec ID based on schema hierarchy
 *
 * Priority calculation:
 * - Schema groups get base priorities (1000, 2000, 3000, etc.)
 * - Individual tests within schema: base + test number (1, 2, 3, etc.)
 * - Regression tests: base + 900 (always last in group)
 *
 * Supported regression patterns:
 * - APP-THEME-ANIMATIONS-REGRESSION → priority: base + 900
 * - APP-THEME-ANIMATIONS-REGRESSION-001 → priority: base + 900
 *
 * @param specId The full spec ID (e.g., "APP-VERSION-001", "APP-VERSION-REGRESSION", "APP-VERSION-REGRESSION-001")
 * @param hierarchy The schema hierarchy map
 * @returns Priority number for queue ordering
 */
export function calculateSchemaBasedPriority(specId: string, hierarchy: SchemaHierarchy): number {
  // Extract feature path and test identifier
  const parts = specId.split('-')
  const testIdentifier = parts[parts.length - 1] || ''

  // Check if this is a regression test
  // Pattern 1: *-REGRESSION (e.g., APP-THEME-ANIMATIONS-REGRESSION)
  // Pattern 2: *-REGRESSION-NNN (e.g., APP-THEME-ANIMATIONS-REGRESSION-001)
  const isRegressionOnly = testIdentifier.toUpperCase() === 'REGRESSION'
  const secondToLastPart = parts.length >= 2 ? parts[parts.length - 2] : undefined
  const isRegressionWithNumber =
    secondToLastPart !== undefined &&
    secondToLastPart.toUpperCase() === 'REGRESSION' &&
    /^\d+$/.test(testIdentifier)
  const isRegression = isRegressionOnly || isRegressionWithNumber

  // Get feature path (without test number/regression suffix)
  const featurePath = getFeaturePathFromSpecId(specId)

  // Calculate base priority for the schema group
  const schemaBasePriority = calculateSchemaGroupPriority(featurePath, hierarchy)

  // Add offset within the group
  if (isRegression) {
    // Regression tests always run last in their group
    return schemaBasePriority + 900
  } else {
    // Individual test number (001 → 1, 002 → 2, etc.)
    const testNumber = parseInt(testIdentifier, 10) || 1
    return schemaBasePriority + testNumber
  }
}

/**
 * Calculate base priority for a schema group
 * Groups are separated by 1000 to ensure all tests from one schema
 * complete before moving to the next schema
 */
function calculateSchemaGroupPriority(featurePath: string, hierarchy: SchemaHierarchy): number {
  // Direct match in hierarchy
  const property = hierarchy.get(featurePath)
  if (property) {
    return calculatePropertyGroupPriority(property, hierarchy) * 1000
  }

  // Try parent paths (for deeply nested features not directly in schema)
  const parts = featurePath.split('/')
  for (let i = parts.length - 1; i > 0; i--) {
    const parentPath = parts.slice(0, i).join('/')
    const parentProp = hierarchy.get(parentPath)
    if (parentProp) {
      // Found parent in hierarchy - now calculate priority for this sub-feature
      const baseGroup = calculatePropertyGroupPriority(parentProp, hierarchy)

      // For sub-features not in schema (e.g., app/pages/navlinks when only app/pages exists),
      // we need to assign different priorities based on alphabetical order
      // This ensures all tests from same sub-feature are processed together

      // Extract the sub-feature name (the part after parent)
      const remainingParts = parts.slice(i)

      if (remainingParts.length > 0) {
        // Get alphabetical index among sibling sub-features
        // This ensures: footer (001,002,003,REG) → layout (001,002,003,REG) → meta (...)
        const subFeatureName = remainingParts[0]!
        const siblingIndex = getAlphabeticalIndexForSubFeature(subFeatureName)

        // Multiply by 2000 to create 2000-slot groups for each sub-feature
        // This ensures room for 1000 tests (1-999) + regression test (900) without overlap
        // Example: nav=13.065*2000=26130, navlinks=13.709*2000=27418
        // Gap of 1288 slots ensures nav-regression (26130+900=27030) < navlinks-001 (27418+1)
        const scaledSiblingIndex = siblingIndex * 2000

        // Each sub-feature gets its own range with sufficient separation
        return (baseGroup + scaledSiblingIndex) * 1000
      }

      // Direct child, use parent priority with small offset
      const additionalLevels = parts.length - i
      return (baseGroup + additionalLevels * 0.1) * 1000
    }
  }

  // Fallback for unknown paths
  return 100_000
}

/**
 * Get alphabetical index for a sub-feature name
 * Used to assign consistent priorities to sub-features not in schema
 *
 * This creates a unique numeric priority based on the full feature name
 * to ensure tests from the same sub-feature are always processed together,
 * while preserving alphabetical ordering across all sub-features.
 *
 * The algorithm converts the feature name to a base-26 number representation:
 * - First char: integer part (0-25)
 * - Next chars: decimal fractions (each position divided by 26^n)
 *
 * Examples (showing first char + first decimal):
 * - "breadcrumb" → 1.xxx (b=1, r=17)
 * - "footer" → 5.xxx (f=5, o=14)
 * - "layout" → 11.xxx (l=11, a=0)
 * - "meta" → 12.xxx (m=12, e=4)
 * - "name" → 13.000 (n=13, a=0)
 * - "nav" → 13.021 (n=13, a=0, v=21)
 * - "navlinks" → 13.022 (n=13, a=0, v=21, l=11)
 *
 * This ensures: name < nav < navlinks (alphabetical order preserved)
 */
function getAlphabeticalIndexForSubFeature(subFeatureName: string): number {
  const name = subFeatureName.toLowerCase()

  // Base offset from first character (0-25)
  const firstCharOffset = name.charCodeAt(0) - 97

  // Convert remaining characters to decimal fraction preserving order
  // Each subsequent character adds less weight (divided by 26^position)
  let decimalOffset = 0
  const maxChars = Math.min(name.length, 8) // Limit to prevent precision issues

  for (let i = 1; i < maxChars; i++) {
    const charValue = name.charCodeAt(i) - 97 // 0-25 (handle non-letters as 0)
    const normalizedValue = Math.max(0, Math.min(25, charValue))
    decimalOffset += normalizedValue / Math.pow(26, i)
  }

  // Combine: integer part (first letter) + decimal part (rest of name)
  // This preserves alphabetical order while ensuring unique priorities
  return firstCharOffset + decimalOffset
}

/**
 * Calculate group priority for a specific property
 * Returns a group number (1, 2, 3, etc.) that will be multiplied by 1000
 * for the final schema group base priority
 */
function calculatePropertyGroupPriority(
  property: SchemaProperty,
  hierarchy: SchemaHierarchy
): number {
  // Group assignment based on schema hierarchy
  // Required root properties get groups 1-3
  // Optional root properties get groups 4+
  // Nested properties get higher groups

  if (property.level === 1 && property.required) {
    // Required root property: Only 'name' is required in the schema
    // Priority group 1 for 'name'
    if (property.name === 'name') {
      return 1
    }
    // If other properties become required in the future
    return 2
  }

  if (property.level === 1 && !property.required) {
    // Optional root properties: Priority groups 2+
    // Prioritize common metadata fields (version, description) before others

    // High-priority optional metadata fields
    const metadataOrder = ['version', 'description']
    const metadataIndex = metadataOrder.indexOf(property.name)
    if (metadataIndex >= 0) {
      return 2 + metadataIndex // version=2, description=3
    }

    // Other optional root properties (alphabetical)
    const otherOptionalProps = Array.from(hierarchy.values())
      .filter((p) => p.level === 1 && !p.required && !metadataOrder.includes(p.name))
      .sort((a, b) => a.name.localeCompare(b.name))

    const index = otherOptionalProps.findIndex((p) => p.name === property.name)
    return 4 + index // Starting from group 4
  }

  // Nested properties (level 2+): Higher group numbers
  // Calculate base group based on parent property
  const parentProp = hierarchy.get(property.parent!)
  if (parentProp) {
    const parentGroup = calculatePropertyGroupPriority(parentProp, hierarchy)

    // Get siblings at same level and sort
    const siblings = Array.from(hierarchy.values())
      .filter((p) => p.level === property.level && p.parent === property.parent)
      .sort((a, b) => a.name.localeCompare(b.name))

    const siblingIndex = siblings.findIndex((p) => p.name === property.name)

    // Nested properties start at parent + 100 to ensure they come after parent's regression tests
    // Each nesting level adds 100, siblings add 10
    return parentGroup + 100 * property.level + 10 + siblingIndex
  }

  // Fallback for unknown properties
  return 100
}

/**
 * Get feature path from spec ID
 * Examples:
 * - APP-VERSION-001 → app/version
 * - APP-VERSION-REGRESSION → app/version
 * - APP-VERSION-REGRESSION-001 → app/version
 * - APP-THEME-COLORS-001 → app/theme/colors
 * - APP-THEME-COLORS-REGRESSION → app/theme/colors
 * - APP-THEME-COLORS-REGRESSION-001 → app/theme/colors
 * - API-PATHS-HEALTH-001 → api/paths/health
 */
export function getFeaturePathFromSpecId(specId: string): string {
  // Split by hyphens and convert to lowercase path
  const parts = specId.split('-')

  // Check if last part is "REGRESSION" (case-insensitive)
  const lastPart = parts[parts.length - 1] || ''
  const isRegressionOnly = lastPart.toUpperCase() === 'REGRESSION'

  // Check if second-to-last part is "REGRESSION" with numeric suffix
  // Pattern: *-REGRESSION-NNN (e.g., APP-THEME-ANIMATIONS-REGRESSION-001)
  const secondToLastPart = parts.length >= 2 ? parts[parts.length - 2] : undefined
  const isRegressionWithNumber =
    secondToLastPart !== undefined &&
    secondToLastPart.toUpperCase() === 'REGRESSION' &&
    /^\d+$/.test(lastPart)

  // Remove suffix based on pattern
  let pathParts: string[]
  if (isRegressionWithNumber) {
    // Pattern: APP-THEME-ANIMATIONS-REGRESSION-001 → app/theme/animations
    pathParts = parts.slice(0, -2)
  } else if (isRegressionOnly) {
    // Pattern: APP-THEME-ANIMATIONS-REGRESSION → app/theme/animations
    pathParts = parts.slice(0, -1)
  } else if (/^\d+$/.test(lastPart)) {
    // Pattern: APP-THEME-ANIMATIONS-001 → app/theme/animations
    pathParts = parts.slice(0, -1)
  } else {
    // No recognized suffix
    pathParts = parts
  }

  return pathParts.join('/').toLowerCase()
}

/**
 * Load schema hierarchy and create priority calculator function
 * Returns a function that takes a spec ID and returns its priority
 *
 * @param rootSchemaPath Path to the root app.schema.json file
 * @returns Function that calculates priority for spec IDs
 */
export function createSchemaPriorityCalculator(rootSchemaPath: string): (specId: string) => number {
  const hierarchy = loadSchemaHierarchy(rootSchemaPath)

  return (specId: string) => calculateSchemaBasedPriority(specId, hierarchy)
}

/**
 * Calculate simple priority for API and ADMIN specs
 * Uses alphabetical ordering of feature path with test number offset
 *
 * @param specId Full spec ID (e.g., "API-PATHS-HEALTH-001", "ADMIN-TABLES-001")
 * @returns Priority number within domain (0-999,999)
 */
function calculateSimplePriority(specId: string): number {
  // Extract feature path and test identifier
  const featurePath = getFeaturePathFromSpecId(specId)
  const parts = specId.split('-')
  const testIdentifier = parts[parts.length - 1] || ''

  // Check if this is a regression test
  const isRegressionOnly = testIdentifier.toUpperCase() === 'REGRESSION'
  const secondToLastPart = parts.length >= 2 ? parts[parts.length - 2] : undefined
  const isRegressionWithNumber =
    secondToLastPart !== undefined &&
    secondToLastPart.toUpperCase() === 'REGRESSION' &&
    /^\d+$/.test(testIdentifier)
  const isRegression = isRegressionOnly || isRegressionWithNumber

  // Calculate alphabetical priority for feature path
  // Convert path segments to numeric value for consistent ordering
  const pathParts = featurePath.split('/')
  let featurePriority = 0

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i] || ''
    const partValue = getAlphabeticalIndexForSubFeature(part)
    // Each level gets exponentially less weight (1000, 100, 10, 1)
    featurePriority += partValue * Math.pow(10, 3 - i)
  }

  // Round to nearest 1000 to create groups
  const baseGroup = Math.floor(featurePriority / 1000) * 1000

  // Add offset within the group
  if (isRegression) {
    return baseGroup + 900
  } else {
    const testNumber = parseInt(testIdentifier, 10) || 1
    return baseGroup + testNumber
  }
}

/**
 * Calculate priority for spec IDs with grouped schema processing
 * This is the main export for TDD automation queue ordering
 *
 * Handles three domains:
 * - APP: Uses JSON Schema hierarchy (app.schema.json)
 * - API: Uses simple alphabetical ordering (OpenAPI structure)
 * - ADMIN: Uses simple alphabetical ordering
 *
 * @param specId Full spec ID (e.g., "APP-VERSION-001", "API-PATHS-HEALTH-001", "ADMIN-TABLES-001")
 * @param rootSchemaPath Path to the root app.schema.json file
 * @returns Priority number (lower = higher priority)
 */
export function calculateSpecPriority(specId: string, rootSchemaPath: string): number {
  // Detect domain from spec ID
  const domain = getSpecDomain(specId)
  const domainBasePriority = DOMAIN_BASE_PRIORITIES[domain]

  // For APP domain, use existing schema-based logic
  if (domain === 'app') {
    const hierarchy = loadSchemaHierarchy(rootSchemaPath)
    const schemaPriority = calculateSchemaBasedPriority(specId, hierarchy)
    return domainBasePriority + schemaPriority
  }

  // For API and ADMIN domains, use simple alphabetical ordering
  // (can be enhanced later to parse OpenAPI/other schemas if needed)
  const simplePriority = calculateSimplePriority(specId)
  return domainBasePriority + simplePriority
}
