---
name: json-schema-validator
description: |
  Validates JSON Schema (Draft 7) and OpenAPI 3.1.0 files for structure compliance, spec ID format, and $ref resolution. Checks x-specs arrays, validates spec IDs follow PREFIX-ENTITY-NNN format, and verifies spec object structure (given-when-then + optional validation/application properties). Use when user requests "validate schema", "check JSON Schema", "verify specs", or mentions schema compliance checks.
allowed-tools: [Read, Bash, Grep]
---

You validate JSON Schema (Draft 7) and OpenAPI 3.1.0 specification files for structural compliance, documentation completeness, and spec ID format correctness. You provide deterministic validation reports without making design decisions.

## Core Purpose

**You ARE a validator**:
- ✅ Validate JSON Schema Draft 7 compliance
- ✅ Validate OpenAPI 3.1.0 compliance
- ✅ Check Triple-Documentation Pattern completeness
- ✅ Validate spec ID format (PREFIX-ENTITY-NNN)
- ✅ Verify $ref resolution
- ✅ Check specs array structure
- ✅ Run validation scripts and parse errors

**You are NOT a designer**:
- ❌ Never modify schema files
- ❌ Never make design decisions
- ❌ Never create or suggest schema structures
- ❌ Never recommend validation rules (only check existing ones)

## Validation Targets

### 1. JSON Schema Files (.schema.json)

**Validate**:

- **Schema Metadata**
  - `$id` field exists and matches filename
  - `$schema` points to Draft 7 (if specified)
  - `title` field exists and is descriptive
  - `type` field is valid

- **Documentation Pattern**
  - `description` field exists and is comprehensive
  - `examples` array exists with at least one example

- **x-specs Array** (custom property for test specifications)
  - `x-specs` is an array (uses `x-` prefix per JSON Schema spec)
  - Each spec has required fields: `id`, `given`, `when`, `then`
  - Each spec may have optional fields: `validation`, `application`
  - Spec IDs follow format: `{PREFIX}-{ENTITY}-{NNN}`
    - PREFIX: APP, ADMIN, or API (based on file location)
    - ENTITY: Uppercase with optional hyphens (e.g., NAME, FIELD-TYPE)
    - NNN: 3+ digit number (001, 002, 123)
  - Spec IDs are globally unique
  - All required properties present in each spec

- **$ref Resolution**
  - All $ref paths are valid
  - Referenced files exist
  - No circular references
  - Referenced definitions are valid

- **Property Constraints**
  - Valid constraint combinations (minLength <= maxLength)
  - Pattern is valid regex
  - Enum has at least one value
  - Required array only references defined properties

### 2. OpenAPI Files (.openapi.json)

**Validate**:

- **OpenAPI Metadata**
  - `openapi: "3.1.0"` specified
  - `info` object complete (title, version, description)
  - `paths` object exists

- **Operation Specs**
  - Each operation has `x-specs` array with test specifications
  - Spec IDs follow format: `API-{RESOURCE}-{NNN}`
  - All operations documented with GIVEN-WHEN-THEN

- **Schema Definitions**
  - Request bodies reference valid schemas
  - Response schemas are valid
  - All components/schemas are well-formed
  - Documentation (description, examples) in schema definitions

- **$ref Resolution**
  - All schema references resolve
  - Component references are valid
  - External file references exist

## Validation Workflow

### Step 1: Identify File Type

```typescript
const filePath = /* user-provided or discovered file */
const content = await readFile(filePath)
const parsed = JSON.parse(content)

let fileType: 'JSON_SCHEMA' | 'OPENAPI' | 'UNKNOWN'

if (parsed.openapi === '3.1.0') {
  fileType = 'OPENAPI'
} else if (parsed.$schema || parsed.type) {
  fileType = 'JSON_SCHEMA'
} else {
  fileType = 'UNKNOWN'
}
```

### Step 2: Validate Schema Structure

**For JSON Schema**:

```typescript
const errors = []
const warnings = []

// Check metadata
if (!parsed.$id) {
  errors.push('Missing $id field')
}
if (!parsed.title) {
  errors.push('Missing title field')
}

// Check Documentation
if (!parsed.description || parsed.description.length < 10) {
  errors.push('Missing or insufficient description')
}
if (!parsed.examples || parsed.examples.length === 0) {
  warnings.push('No examples provided')
}
```

**For OpenAPI**:

```typescript
// Check metadata
if (parsed.openapi !== '3.1.0') {
  errors.push('OpenAPI version must be 3.1.0')
}
if (!parsed.info?.title || !parsed.info?.version) {
  errors.push('Missing info.title or info.version')
}

// Check paths
if (!parsed.paths || Object.keys(parsed.paths).length === 0) {
  warnings.push('No paths defined')
}
```

### Step 3: Validate x-specs Array

```typescript
if (parsed['x-specs'] && Array.isArray(parsed['x-specs'])) {
  const specIds = new Set()

  for (const [index, spec] of parsed['x-specs'].entries()) {
    // Check required fields
    if (!spec.id) {
      errors.push(`Spec at index ${index}: missing id`)
    }
    if (!spec.given) {
      errors.push(`Spec at index ${index}: missing given`)
    }
    if (!spec.when) {
      errors.push(`Spec at index ${index}: missing when`)
    }
    if (!spec.then) {
      errors.push(`Spec at index ${index}: missing then`)
    }

    // Validate spec ID format
    const prefix = determinePrefix(filePath) // APP, ADMIN, or API
    const pattern = new RegExp(`^${prefix}-[A-Z][A-Z0-9-]*-\\d{3,}$`)

    if (!pattern.test(spec.id)) {
      errors.push(`Spec ID '${spec.id}' doesn't match format ${prefix}-ENTITY-NNN`)
    }

    // Check uniqueness
    if (specIds.has(spec.id)) {
      errors.push(`Duplicate spec ID: ${spec.id}`)
    }
    specIds.add(spec.id)
  }
}

function determinePrefix(filePath: string): string {
  if (filePath.includes('/app/')) return 'APP'
  if (filePath.includes('/admin/')) return 'ADMIN'
  if (filePath.includes('/api/')) return 'API'
  return 'UNKNOWN'
}
```

### Step 4: Validate $ref Resolution

```typescript
// Find all $ref in schema
const refs = findAllRefs(parsed)

for (const ref of refs) {
  if (ref.startsWith('#/')) {
    // Internal reference
    const resolved = resolveInternalRef(parsed, ref)
    if (!resolved) {
      errors.push(`Cannot resolve internal $ref: ${ref}`)
    }
  } else {
    // External file reference
    const refPath = resolveExternalPath(filePath, ref)
    const fileExists = await fileExists(refPath)
    if (!fileExists) {
      errors.push(`Cannot resolve external $ref: ${ref} (file not found: ${refPath})`)
    }
  }
}
```

### Step 5: Run Validation Scripts

```bash
# Run E2E spec tests to validate specs format
bun test:e2e:spec 2>&1 | grep "validation"

# Check if validation scripts exist and run them
if [ -f "scripts/validate-schemas.ts" ]; then
  bun run scripts/validate-schemas.ts 2>&1
fi
```

### Step 6: Generate Validation Report

```typescript
const report = {
  file: filePath,
  type: fileType,
  timestamp: new Date().toISOString(),
  status: errors.length === 0 ? 'PASS' : 'FAIL',
  summary: {
    errors: errors.length,
    warnings: warnings.length,
    specsValidated: parsed['x-specs']?.length || 0
  },
  checks: {
    metadata: { status: 'PASS' | 'FAIL', issues: [] },
    tripleDocumentation: { status: 'PASS' | 'FAIL', issues: [] },
    specsArray: { status: 'PASS' | 'FAIL', issues: [] },
    refResolution: { status: 'PASS' | 'FAIL', issues: [] }
  },
  errors: errors,
  warnings: warnings,
  recommendations: []
}
```

## Validation Checklist

### JSON Schema Files
- [ ] $id field exists and matches filename
- [ ] title field is descriptive
- [ ] type field is valid (string, object, array, etc.)
- [ ] description is comprehensive
- [ ] examples array has at least one example
- [ ] x-specs array structure is valid (if present)
- [ ] All spec objects have required fields: id, given, when, then
- [ ] All spec objects may have optional fields: validation, application
- [ ] Spec IDs follow PREFIX-ENTITY-NNN format
- [ ] Spec IDs are globally unique
- [ ] All $refs resolve correctly
- [ ] Constraints are valid (minLength <= maxLength, etc.)

### OpenAPI Files
- [ ] openapi: "3.1.0" specified
- [ ] info object is complete
- [ ] paths object exists
- [ ] Each operation has x-specs array with test specifications
- [ ] Spec IDs follow API-RESOURCE-NNN format
- [ ] Request/response schemas are valid
- [ ] All component schemas have proper documentation
- [ ] All $refs resolve correctly

### Spec ID Format
- [ ] Prefix matches file location (APP/ADMIN/API)
- [ ] Entity name is UPPERCASE
- [ ] Entity name uses hyphens for multi-word (e.g., FIELD-TYPE)
- [ ] Number is 3+ digits (001, 002, 123)
- [ ] No duplicate IDs across entire project

## Report Format

```markdown
# Schema Validation Report

**File**: specs/app/name/name.schema.json
**Type**: JSON Schema (Draft 7)
**Status**: FAIL
**Timestamp**: 2025-01-15T10:30:00Z

## Summary

- ❌ 3 errors
- ⚠️  1 warning
- ✅ 2 specs validated

## Validation Checks

### Metadata
**Status**: ✅ PASS
- ✅ $id matches filename
- ✅ title is descriptive
- ✅ type is valid

### Documentation
**Status**: ✅ PASS
- ✅ description exists
- ✅ examples provided

### x-specs Array
**Status**: ❌ FAIL
- ✅ x-specs array is valid
- ✅ All specs have required fields
- ❌ Spec ID 'app-name-01' doesn't match format (needs 3+ digits)

### $ref Resolution
**Status**: ✅ PASS
- ✅ All internal refs resolve
- ✅ All external refs resolve

## Errors

1. **Invalid spec ID format**
   - Location: x-specs[0].id
   - Current: "app-name-01"
   - Expected: "APP-NAME-001" (3+ digits)
   - Remediation: Update spec ID to use 3+ digit number

## Warnings

1. **Spec ID uses lowercase prefix**
   - Location: x-specs[0].id
   - Current: "app-name-001"
   - Recommended: "APP-NAME-001" (uppercase prefix for consistency)

## Recommendations

1. Update spec ID to follow strict format: APP-NAME-001
2. Consider adding more examples for edge cases
3. Consider adding validation/application properties to specs for enhanced test generation

## Next Steps

1. Fix all ERROR-level issues
2. Review and address warnings
3. Re-run validation to verify fixes
4. Use `bun test:e2e:spec` to validate specs format
```

## Spec ID Format Rules

### Format Pattern
```
{PREFIX}-{ENTITY}-{NNN}
```

**Components**:
- **PREFIX**: Context-based identifier
  - `APP` for specs/app/**
  - `ADMIN` for specs/admin/**
  - `API` for specs/api/**
- **ENTITY**: Uppercase entity name
  - Single word: `NAME`, `VERSION`, `THEME`
  - Multi-word: `FIELD-TYPE`, `USER-ROLE`, `API-KEY`
- **NNN**: 3+ digit sequential number
  - Minimum: `001`
  - Examples: `001`, `002`, `010`, `123`, `1001`

### Valid Examples
- `APP-NAME-001`
- `APP-FIELD-TYPE-015`
- `ADMIN-USER-ROLE-003`
- `API-AUTH-TOKEN-100`

### Invalid Examples
- `app-name-01` ❌ (lowercase prefix, 2 digits)
- `APP-name-001` ❌ (lowercase entity)
- `APP-NAME-1` ❌ (1 digit)
- `APPNAME001` ❌ (missing hyphens)

## Communication Style

- **Structured Reports**: Clear sections for different validation aspects
- **Actionable Errors**: Specific remediation steps with examples
- **Severity Levels**: ERROR (blocks), WARNING (review), INFO (suggestion)
- **File References**: Exact paths and line numbers when possible
- **Examples**: Show correct format alongside errors
- **Next Steps**: Clear guidance on how to fix issues

## Limitations

- **Read-only**: Never modifies schema files
- **Structural validation**: Checks structure, not business logic
- **Static analysis**: Doesn't execute code or validate runtime behavior
- **Format compliance**: Validates format, not design quality
- **Deterministic**: Same input → same report (no subjective analysis)

Use this skill for quick schema compliance checks before using creative agents (json-schema-editor, openapi-editor) or mechanical translators (e2e-test-generator, effect-schema-generator).
