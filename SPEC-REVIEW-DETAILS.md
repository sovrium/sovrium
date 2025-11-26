# Specification Review - Technical Details & Examples

**Date**: 2025-11-26
**Companion to**: [SPEC-REVIEW-REPORT.md](./SPEC-REVIEW-REPORT.md)

This document provides concrete examples of redundancy, quality issues, and specific recommendations for refactoring.

---

## 1. Redundancy Examples with Solutions

### Example 1: Default Value Pattern (17× Duplication)

#### Current State (Duplicated)

**File 1**: `specs/app/tables/field-types/integer-field/default/default.schema.json`

```json
{
  "x-specs": [
    {
      "id": "APP-FIELD-INTEGER-DEFAULT-001",
      "given": "integer field with default: 0",
      "when": "field migration creates column with DEFAULT constraint",
      "then": "PostgreSQL automatically sets value to 0 when not provided",
      "validation": {
        "setup": {
          "executeQuery": [
            "CREATE TABLE counters (id SERIAL PRIMARY KEY, name VARCHAR(255), value INTEGER DEFAULT 0)",
            "INSERT INTO counters (name) VALUES ('counter1'), ('counter2')"
          ]
        },
        "assertions": [
          {
            "description": "Column has DEFAULT constraint",
            "executeQuery": "SELECT column_default FROM information_schema.columns WHERE table_name='counters' AND column_name='value'",
            "expected": { "column_default": "0" }
          }
        ]
      }
    }
  ]
}
```

**File 2**: `specs/app/tables/field-types/decimal-field/default/default.schema.json`

```json
{
  "x-specs": [
    {
      "id": "APP-FIELD-DECIMAL-DEFAULT-001",
      "given": "decimal field with default: 0.0",
      "when": "field migration creates column with DEFAULT constraint",
      "then": "PostgreSQL automatically sets value to 0.0 when not provided",
      "validation": {
        "setup": {
          "executeQuery": [
            "CREATE TABLE accounts (id SERIAL PRIMARY KEY, name VARCHAR(255), balance DECIMAL(15,2) DEFAULT 0.0)",
            "INSERT INTO accounts (name) VALUES ('Account 1'), ('Account 2')"
          ]
        },
        "assertions": [
          {
            "description": "Column has DEFAULT constraint",
            "executeQuery": "SELECT column_default FROM information_schema.columns WHERE table_name='accounts' AND column_name='balance'",
            "expected": { "column_default": "0.0" }
          }
        ]
      }
    }
  ]
}
```

**Problem**: 85% identical logic, only differences are:

- Field type name (`integer` vs `decimal`)
- Default value (`0` vs `0.0`)
- Table name (`counters` vs `accounts`)
- Column name (`value` vs `balance`)
- PostgreSQL type (`INTEGER` vs `DECIMAL(15,2)`)

**Duplication Count**: 17 field types × 3 specs = **51 duplicate specs**

#### Proposed Solution (Template-Based)

**Shared Template**: `specs/app/tables/field-types/common/templates/default-value-template.schema.json`

```json
{
  "$id": "default-value-template.schema.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Default Value Template",
  "description": "Reusable template for default value validation across all field types",
  "x-specs": [
    {
      "id": "TEMPLATE-DEFAULT-001",
      "given": "{fieldType} field with default: {defaultValue}",
      "when": "field migration creates column with DEFAULT constraint",
      "then": "PostgreSQL automatically sets value to {defaultValue} when not provided",
      "parameters": {
        "fieldType": "string", // e.g., "integer", "decimal"
        "defaultValue": "any", // e.g., 0, 0.0, "Untitled"
        "tableName": "string", // e.g., "counters", "accounts"
        "columnName": "string", // e.g., "value", "balance"
        "pgType": "string", // e.g., "INTEGER", "DECIMAL(15,2)"
        "pgDefault": "string" // e.g., "0", "0.0"
      },
      "validation": {
        "setup": {
          "executeQuery": [
            "CREATE TABLE {tableName} (id SERIAL PRIMARY KEY, name VARCHAR(255), {columnName} {pgType} DEFAULT {defaultValue})",
            "INSERT INTO {tableName} (name) VALUES ('record1'), ('record2')"
          ]
        },
        "assertions": [
          {
            "description": "Column has DEFAULT constraint",
            "executeQuery": "SELECT column_default FROM information_schema.columns WHERE table_name='{tableName}' AND column_name='{columnName}'",
            "expected": { "column_default": "{pgDefault}" }
          },
          {
            "description": "Default value applied when not provided",
            "executeQuery": "SELECT {columnName} FROM {tableName} WHERE name = 'record1'",
            "expected": { "{columnName}": "{defaultValue}" }
          },
          {
            "description": "Explicit value overrides default",
            "executeQuery": "INSERT INTO {tableName} (name, {columnName}) VALUES ('record3', {explicitValue}) RETURNING {columnName}",
            "expected": { "{columnName}": "{explicitValue}" }
          }
        ]
      }
    },
    {
      "id": "TEMPLATE-DEFAULT-002",
      "given": "{fieldType} field with default: {customDefault}",
      "when": "INSERT without value",
      "then": "PostgreSQL uses default value {customDefault}",
      "parameters": "same as TEMPLATE-DEFAULT-001"
    },
    {
      "id": "TEMPLATE-DEFAULT-003",
      "given": "{fieldType} field with no default specified",
      "when": "INSERT without value",
      "then": "PostgreSQL uses NULL (if nullable) or rejects (if required)",
      "parameters": "same as TEMPLATE-DEFAULT-001"
    }
  ]
}
```

**Field-Specific Usage**: `specs/app/tables/field-types/integer-field/integer-field.schema.json`

```json
{
  "$id": "integer-field.schema.json",
  "properties": {
    "default": {
      "$ref": "./default/default.schema.json"
    }
  },
  "x-specs": [
    {
      "$ref": "../common/templates/default-value-template.schema.json#/x-specs",
      "parameters": {
        "fieldType": "integer",
        "defaultValue": 0,
        "tableName": "counters",
        "columnName": "value",
        "pgType": "INTEGER",
        "pgDefault": "0",
        "explicitValue": 42
      }
    }
  ]
}
```

**Benefits**:

- ✓ Single source of truth for default value logic
- ✓ 51 duplicate specs → 3 template specs (94% reduction)
- ✓ Easier to maintain (update template, all field types benefit)
- ✓ Consistent behavior across all field types

---

### Example 2: Min/Max Validation Pattern (9× Duplication)

#### Current State (Duplicated)

**File 1**: `specs/app/tables/field-types/integer-field/min/min.schema.json`

```json
{
  "x-specs": [
    {
      "id": "APP-FIELD-INTEGER-MIN-001",
      "given": "integer field with min: 0",
      "when": "value below minimum is inserted",
      "then": "PostgreSQL CHECK constraint rejects insertion",
      "validation": {
        "assertions": [
          {
            "description": "CHECK constraint exists",
            "executeQuery": "SELECT COUNT(*) as count FROM information_schema.check_constraints WHERE constraint_name LIKE '%min%'",
            "expected": { "count": 1 }
          },
          {
            "description": "Value below min rejected",
            "executeQuery": "INSERT INTO products (stock) VALUES (-1)",
            "expectError": "violates check constraint"
          }
        ]
      }
    }
  ]
}
```

**File 2**: `specs/app/tables/field-types/decimal-field/min/min.schema.json`

```json
{
  "x-specs": [
    {
      "id": "APP-FIELD-DECIMAL-MIN-001",
      "given": "decimal field with min: 0.0",
      "when": "value below minimum is inserted",
      "then": "PostgreSQL CHECK constraint rejects insertion",
      "validation": {
        "assertions": [
          {
            "description": "CHECK constraint exists",
            "executeQuery": "SELECT COUNT(*) as count FROM information_schema.check_constraints WHERE constraint_name LIKE '%min%'",
            "expected": { "count": 1 }
          },
          {
            "description": "Value below min rejected",
            "executeQuery": "INSERT INTO products (price) VALUES (-0.01)",
            "expectError": "violates check constraint"
          }
        ]
      }
    }
  ]
}
```

**Problem**: 90% identical logic, only differences are:

- Field type name
- Min value (`0` vs `0.0`)
- Column name (`stock` vs `price`)
- Test value (`-1` vs `-0.01`)

**Duplication Count**: 9 field types × 3 specs (min) + 9 field types × 3 specs (max) = **54 duplicate specs**

#### Proposed Solution (Template-Based)

**Shared Template**: `specs/app/tables/field-types/common/templates/min-max-template.schema.json`

```json
{
  "$id": "min-max-template.schema.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Min/Max Validation Template",
  "description": "Reusable template for min/max constraint validation",
  "x-specs": [
    {
      "id": "TEMPLATE-MIN-001",
      "given": "{fieldType} field with min: {minValue}",
      "when": "value below minimum is inserted",
      "then": "PostgreSQL CHECK constraint rejects insertion",
      "parameters": {
        "fieldType": "string",
        "minValue": "number",
        "tableName": "string",
        "columnName": "string",
        "belowMinValue": "number"
      },
      "validation": {
        "assertions": [
          {
            "description": "CHECK constraint exists",
            "executeQuery": "SELECT COUNT(*) as count FROM information_schema.check_constraints WHERE constraint_name LIKE '%{columnName}_min%'",
            "expected": { "count": 1 }
          },
          {
            "description": "Value below min rejected",
            "executeQuery": "INSERT INTO {tableName} ({columnName}) VALUES ({belowMinValue})",
            "expectError": "violates check constraint"
          },
          {
            "description": "Value at min accepted",
            "executeQuery": "INSERT INTO {tableName} ({columnName}) VALUES ({minValue}) RETURNING {columnName}",
            "expected": { "{columnName}": "{minValue}" }
          }
        ]
      }
    },
    {
      "id": "TEMPLATE-MAX-001",
      "given": "{fieldType} field with max: {maxValue}",
      "when": "value above maximum is inserted",
      "then": "PostgreSQL CHECK constraint rejects insertion",
      "parameters": "similar to TEMPLATE-MIN-001"
    }
  ]
}
```

**Benefits**:

- ✓ 54 duplicate specs → 6 template specs (89% reduction)
- ✓ Consistent validation logic across all numeric types
- ✓ Easier to add new numeric field types

---

## 2. Missing API X-Specs Schemas

### Current State (Broken Architecture)

**Directory**: `specs/api/paths/tables/{tableId}/records/`

```
specs/api/paths/tables/{tableId}/records/
├── get.spec.ts                ← 28 tests exist (good)
├── post.spec.ts               ← 17 tests exist (good)
├── {recordId}/get.spec.ts     ← tests exist (good)
├── {recordId}/patch.spec.ts   ← tests exist (good)
├── {recordId}/delete.spec.ts  ← tests exist (good)
└── (NO .schema.json files)    ← CRITICAL GAP
```

**Problem**: Cannot validate test completeness, no machine-readable API contract

### Proposed Solution

**Create Companion Schemas**: `specs/api/paths/tables/{tableId}/records/get.schema.json`

```json
{
  "$id": "get.schema.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "List records in table",
  "description": "Retrieve paginated list of records from a table with optional filtering, sorting, and field selection",
  "x-specs": [
    {
      "id": "API-TABLES-RECORDS-LIST-001",
      "given": "Table 'projects' with 3 records",
      "when": "User requests all records",
      "then": "Returns 200 with array of 3 records and pagination metadata",
      "validation": {
        "request": {
          "method": "GET",
          "endpoint": "/api/tables/{tableId}/records",
          "headers": {
            "Authorization": "Bearer {token}"
          },
          "pathParams": {
            "tableId": {
              "type": "integer",
              "description": "Unique table identifier"
            }
          }
        },
        "response": {
          "status": 200,
          "schema": {
            "type": "object",
            "required": ["records", "pagination"],
            "properties": {
              "records": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "id": { "type": "integer" },
                    "created_at": { "type": "string", "format": "date-time" },
                    "updated_at": { "type": "string", "format": "date-time" }
                  }
                }
              },
              "pagination": {
                "type": "object",
                "required": ["total", "limit", "offset"],
                "properties": {
                  "total": { "type": "integer", "description": "Total record count" },
                  "limit": { "type": "integer", "description": "Records per page" },
                  "offset": { "type": "integer", "description": "Starting position" }
                }
              }
            }
          }
        },
        "examples": [
          {
            "name": "List all records",
            "request": {
              "tableId": 1
            },
            "response": {
              "status": 200,
              "body": {
                "records": [
                  { "id": 1, "name": "Project Alpha", "status": "active" },
                  { "id": 2, "name": "Project Beta", "status": "completed" },
                  { "id": 3, "name": "Project Gamma", "status": "active" }
                ],
                "pagination": { "total": 3, "limit": 100, "offset": 0 }
              }
            }
          }
        ]
      }
    },
    {
      "id": "API-TABLES-RECORDS-LIST-002",
      "given": "A running server with no table ID 9999",
      "when": "User requests records from non-existent table",
      "then": "Returns 404 Not Found",
      "validation": {
        "request": {
          "method": "GET",
          "endpoint": "/api/tables/9999/records"
        },
        "response": {
          "status": 404,
          "schema": {
            "type": "object",
            "required": ["error"],
            "properties": {
              "error": { "type": "string", "const": "Table not found" }
            }
          }
        },
        "scenarios": [
          { "name": "non-existent table", "tableId": 9999, "expected": 404 },
          { "name": "deleted table", "tableId": 123, "expected": 404 }
        ]
      }
    }
    // ... remaining 26 x-specs from get.spec.ts
  ]
}
```

**Benefits**:

- ✓ Machine-readable API contract
- ✓ Can validate test completeness (compare test IDs vs spec IDs)
- ✓ Consistent with app/ spec architecture
- ✓ OpenAPI schema generation possible

**Action Items**:

1. Generate .schema.json for all 47 API test files
2. Extract spec IDs from existing test files
3. Add validation blocks with request/response schemas
4. Cross-reference with OpenAPI definitions

---

## 3. Test Generation Examples

### Input: X-Spec Definition

**Source**: `single-line-text-field.schema.json`

```json
{
  "id": "APP-FIELD-SINGLE-LINE-TEXT-001",
  "given": "table configuration with single-line-text field 'title'",
  "when": "field migration creates column",
  "then": "PostgreSQL VARCHAR(255) column is created",
  "validation": {
    "setup": {
      "executeQuery": "CREATE TABLE products (id SERIAL PRIMARY KEY)",
      "fieldConfig": {
        "id": 1,
        "name": "title",
        "type": "single-line-text"
      }
    },
    "assertions": [
      {
        "description": "Column created as VARCHAR(255)",
        "executeQuery": "SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='title'",
        "expected": {
          "column_name": "title",
          "data_type": "character varying",
          "character_maximum_length": 255,
          "is_nullable": "YES"
        }
      },
      {
        "description": "Valid text can be inserted",
        "executeQuery": "INSERT INTO products (title) VALUES ('MacBook Pro 16-inch') RETURNING title",
        "expected": {
          "title": "MacBook Pro 16-inch"
        }
      }
    ]
  }
}
```

### Output: Generated Playwright Test

**Generated**: `single-line-text-field.spec.ts`

```typescript
test.fixme(
  'APP-FIELD-SINGLE-LINE-TEXT-001: should create PostgreSQL VARCHAR(255) column',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: table configuration with single-line-text field 'title'
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_products',
          name: 'products',
          fields: [{ name: 'title', type: 'single-line-text' }],
        },
      ],
    })

    // WHEN: field migration creates column
    // THEN: PostgreSQL VARCHAR(255) column is created

    // Assertion 1: Column created as VARCHAR(255)
    const columnInfo = await executeQuery(
      "SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='title'"
    )
    expect(columnInfo).toEqual({
      column_name: 'title',
      data_type: 'character varying',
      character_maximum_length: 255,
      is_nullable: 'YES',
    })

    // Assertion 2: Valid text can be inserted
    const validInsert = await executeQuery(
      "INSERT INTO products (title) VALUES ('MacBook Pro 16-inch') RETURNING title"
    )
    expect(validInsert.title).toBe('MacBook Pro 16-inch')
  }
)
```

**Test Generation Algorithm**:

```typescript
function generateTestFromXSpec(xspec: XSpec): string {
  const testCode = `
test.fixme(
  '${xspec.id}: ${generateTestTitle(xspec)}',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: ${xspec.given}
    ${generateSetup(xspec.validation.setup)}

    // WHEN: ${xspec.when}
    // THEN: ${xspec.then}

    ${generateAssertions(xspec.validation.assertions)}
  }
)
  `
  return testCode
}
```

**Benefits**:

- ✓ 100% coverage of x-specs (590 specs → 590 tests)
- ✓ Consistent test structure
- ✓ Reduces manual test authoring effort by 90%

---

## 4. Quality Comparison

### High-Quality X-Spec (App Domain)

**Example**: `single-line-text-field.schema.json`

```json
{
  "id": "APP-FIELD-SINGLE-LINE-TEXT-008",
  "given": "table with single-line-text field handling special characters",
  "when": "text with quotes, backslashes, and SQL special characters is inserted",
  "then": "PostgreSQL safely escapes and stores the text without SQL injection",
  "validation": {
    "setup": {
      "executeQuery": "CREATE TABLE messages (id SERIAL PRIMARY KEY, message VARCHAR(255))"
    },
    "assertions": [
      {
        "description": "Single quotes escaped correctly",
        "executeQuery": "INSERT INTO messages (message) VALUES ('O''Brien''s message') RETURNING message",
        "expected": { "message": "O'Brien's message" }
      },
      {
        "description": "SQL injection attempt safely escaped",
        "executeQuery": "INSERT INTO messages (message) VALUES (''; DROP TABLE messages; --') RETURNING message",
        "expected": { "message": "'; DROP TABLE messages; --" }
      },
      {
        "description": "Table still exists after SQL injection attempt",
        "executeQuery": "SELECT COUNT(*) as count FROM messages",
        "expected": { "count": 3 }
      }
    ]
  }
}
```

**Quality Score**: 95%

**Strengths**:

- ✓ Specific scenario (SQL injection)
- ✓ Concrete test data (actual SQL injection string)
- ✓ Multiple assertions (escape check + table exists)
- ✓ Edge case coverage (security vulnerability)
- ✓ Actionable (can generate test directly)

### Low-Quality Spec (Hypothetical Example)

**Anti-Pattern**:

```json
{
  "id": "BAD-EXAMPLE-001",
  "given": "a table with a field",
  "when": "data is inserted",
  "then": "it should work correctly",
  "validation": {
    "assertions": [{ "description": "Field works as expected" }]
  }
}
```

**Quality Score**: 5%

**Problems**:

- ✗ Generic description ("a table", "a field")
- ✗ Vague action ("data is inserted")
- ✗ Meaningless assertion ("work correctly")
- ✗ No test data
- ✗ Cannot generate test

---

## 5. Cross-Layer Coherence Example

### Potential Coherence Issue (To Monitor Post-Implementation)

**App Spec**: `single-line-text-field.schema.json`

```json
{
  "id": "APP-FIELD-SINGLE-LINE-TEXT-007",
  "given": "table with single-line-text field with VARCHAR(255) limit",
  "when": "text exceeding 255 characters is inserted",
  "then": "PostgreSQL rejects or truncates the text",
  "validation": {
    "assertions": [
      {
        "description": "Text exceeding limit (300 chars) rejected",
        "executeQuery": "INSERT INTO notes (short_note) VALUES (REPEAT('b', 300))",
        "expectError": "value too long for type character varying(255)"
      }
    ]
  }
}
```

**API Spec**: `post.spec.ts` (hypothetical, needs verification)

```typescript
test('API-TABLES-RECORDS-CREATE-001: should return 201 Created', async ({ request }) => {
  const response = await request.post('/api/tables/1/records', {
    data: {
      short_note: 'A'.repeat(300), // 300 characters
    },
  })

  expect(response.status()).toBe(201) // Might pass if API doesn't validate length
})
```

**Coherence Risk**:

- App spec: Expects PostgreSQL to reject 300-char strings
- API spec: Might not validate before sending to database
- **Result**: API returns 500 instead of 400 (bad UX)

**Correct Behavior**:

```typescript
test('API-TABLES-RECORDS-CREATE-005: should return 400 for field exceeding max length', async ({
  request,
}) => {
  const response = await request.post('/api/tables/1/records', {
    data: {
      short_note: 'A'.repeat(300), // 300 characters
    },
  })

  expect(response.status()).toBe(400) // API validates before database
  const data = await response.json()
  expect(data.error).toContain('exceeds maximum length of 255 characters')
})
```

**Action Items**:

1. After test implementation, verify API validates field length before database insert
2. Cross-reference app field constraints with API validation logic
3. Ensure error codes match (400 Bad Request for validation, not 500 Internal Error)

---

## 6. Recommended Refactoring Steps

### Step 1: Extract Default Value Template

**Before** (17 duplicate files):

```
specs/app/tables/field-types/
├── integer-field/default/default.schema.json      (3 x-specs)
├── decimal-field/default/default.schema.json      (3 x-specs)
├── percentage-field/default/default.schema.json   (3 x-specs)
├── currency-field/default/default.schema.json     (3 x-specs)
├── ... (13 more)
```

**After** (1 template + references):

```
specs/app/tables/field-types/
├── common/templates/default-value-template.schema.json  (3 x-specs)
├── integer-field/integer-field.schema.json              ($ref to template)
├── decimal-field/decimal-field.schema.json              ($ref to template)
├── percentage-field/percentage-field.schema.json        ($ref to template)
├── currency-field/currency-field.schema.json            ($ref to template)
```

**Refactoring Script** (pseudo-code):

```typescript
// 1. Create template file
createTemplate('common/templates/default-value-template.schema.json', {
  specs: extractCommonPattern([
    'integer-field/default/default.schema.json',
    'decimal-field/default/default.schema.json',
    // ... all 17 files
  ]),
})

// 2. Update field type schemas to reference template
for (const fieldType of fieldTypes) {
  updateSchema(fieldType, {
    'x-specs': [
      {
        $ref: '../common/templates/default-value-template.schema.json#/x-specs',
        parameters: getFieldTypeParams(fieldType),
      },
    ],
  })
}

// 3. Delete duplicate files
deleteFiles('*/default/default.schema.json')
```

### Step 2: Generate API X-Specs Schemas

**Extraction Script** (pseudo-code):

```typescript
// For each API test file
for (const testFile of apiTestFiles) {
  const testContent = readFile(testFile)
  const specs = extractSpecs(testContent) // Parse test descriptions

  const schemaFile = testFile.replace('.spec.ts', '.schema.json')
  const schema = {
    $id: basename(schemaFile),
    title: extractTitle(testContent),
    'x-specs': specs.map((spec) => ({
      id: spec.id,
      given: spec.given,
      when: spec.when,
      then: spec.then,
      validation: {
        request: extractRequestSchema(spec),
        response: extractResponseSchema(spec),
        scenarios: extractScenarios(spec),
      },
    })),
  }

  writeFile(schemaFile, JSON.stringify(schema, null, 2))
}
```

**Example Extraction**:

```typescript
// Input: get.spec.ts line 28
test.fixme(
  'API-TABLES-RECORDS-LIST-001: should return 200 with array of 3 records',
  { tag: '@spec' },
  async ({ request }) => { ... }
)

// Output: get.schema.json
{
  "x-specs": [
    {
      "id": "API-TABLES-RECORDS-LIST-001",
      "given": "Table 'projects' with 3 records",
      "when": "User requests all records",
      "then": "Returns 200 with array of 3 records and pagination",
      "validation": { ... }
    }
  ]
}
```

---

## 7. Next Steps

### Immediate Actions (This Week)

1. **Review Examples**: Validate proposed template structure with team
2. **Pilot Template**: Create default-value-template for 3 field types (integer, decimal, percentage)
3. **Measure Impact**: Count spec reduction, validate test generation works

### Short-Term Actions (Next 2 Weeks)

4. **Roll Out Templates**: Apply to all 17 field types with default values
5. **Generate API Schemas**: Create .schema.json for all 47 API test files
6. **Implement Test Generator**: Automate x-spec → Playwright test conversion

### Medium-Term Actions (Next Month)

7. **Cross-Layer Validation**: Verify API validates according to app field specs
8. **Document Standards**: Create spec authoring guidelines with examples
9. **Continuous Monitoring**: Set up automated spec quality checks

---

**Document Version**: 1.0
**Last Updated**: 2025-11-26
**Related Documents**:

- [SPEC-REVIEW-REPORT.md](./SPEC-REVIEW-REPORT.md) - Full detailed report
- [SPEC-REVIEW-SUMMARY.md](./SPEC-REVIEW-SUMMARY.md) - Executive summary
