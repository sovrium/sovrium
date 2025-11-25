# API Specs Completion Guide

## Summary of Completed Work

I've successfully updated the following API endpoint specifications with proper PostgreSQL-based validation blocks:

### ✅ Completed Files (6 files, 23 specs total)

1. **GET /api/tables** (3 specs: 2 success + 1 auth error)
   - List all tables with data
   - Empty table list
   - Unauthorized access (401)

2. **GET /api/tables/{tableId}** (3 specs: 1 success + 2 errors)
   - Get table by ID with full configuration
   - Table not found (404)
   - Unauthorized access (401)

3. **GET /api/tables/{tableId}/views** (4 specs: 2 success + 2 errors)
   - List all views for table
   - Empty views list
   - Table not found (404)
   - Unauthorized access (401)

4. **GET /api/tables/{tableId}/views/{viewId}** (5 specs: 2 success + 3 errors)
   - Get view configuration (grid view)
   - View not found (404)
   - Table not found (404)
   - View with filters/sorts/groupBy (kanban)
   - Calendar view with fields configuration

5. **GET /api/tables/{tableId}/permissions** (6 specs: 3 success + 3 errors)
   - Admin user with full permissions
   - Member user with restricted permissions
   - Unauthenticated access (401)
   - Table not found (404)
   - Field-level restrictions (sensitive salary field)
   - Viewer with read-only access

6. **POST /api/tables/{tableId}/records** (5 specs: 1 success + 4 errors)
   - Create record with valid data (201)
   - Table not found (404)
   - Missing required field (400)
   - Unique constraint violation (409)
   - Unauthorized access (401)

---

## Validation Block Structure

All updated specs now follow this consistent structure:

```json
{
  "id": "API-FEATURE-ENDPOINT-NNN",
  "given": "Preconditions describing database and user state",
  "when": "API action being tested",
  "then": "Expected outcome",
  "validation": {
    "setup": {
      "executeQuery": [
        "CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL)",
        "INSERT INTO users (email) VALUES ('test@example.com')"
      ],
      "authUser": {
        "id": 1,
        "role": "admin",
        "permissions": ["tables:read"]
      },
      "tableConfig": {
        "id": 1,
        "name": "users",
        "views": [],
        "permissions": {}
      },
      "apiRequest": {
        "method": "GET",
        "endpoint": "/api/tables/1",
        "headers": {
          "Authorization": "Bearer test_token",
          "Content-Type": "application/json"
        },
        "pathParams": { "tableId": 1 },
        "queryParams": { "limit": 10 },
        "body": { "email": "new@example.com" }
      }
    },
    "assertions": [
      {
        "description": "Returns 200 with table data",
        "expectedStatus": 200,
        "expectedSchema": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "name": { "type": "string" }
          },
          "required": ["id", "name"]
        },
        "validateResponseData": {
          "id": 1,
          "name": "users"
        }
      },
      {
        "description": "Database state verification",
        "executeQuery": "SELECT COUNT(*) as count FROM users",
        "expected": { "count": 1 }
      }
    ]
  }
}
```

### Key Fields Explained

**Setup Block:**
- `executeQuery`: SQL statements to prepare database (CREATE TABLE, INSERT, etc.)
- `authUser`: Authenticated user context (id, role, permissions)
- `tableConfig`: Table configuration for view/permission setup
- `apiRequest`: HTTP request details (method, endpoint, headers, params, body)

**Assertions Block:**
- `description`: What is being validated
- `expectedStatus`: HTTP status code (200, 201, 400, 401, 404, 409, 500)
- `expectedSchema`: JSON Schema for response validation
- `validateResponseData`: Specific field values to check
- `executeQuery`: Optional database query to verify state
- `expected`: Expected query result
- `expectError`: For error scenarios, expected error message pattern

---

## Error Scenarios to Add

For each endpoint, ensure you cover these HTTP status codes:

| Code | When to Use | Example Scenario |
|------|-------------|------------------|
| **200 OK** | Successful GET | Retrieve existing record |
| **201 Created** | Successful POST | Create new record |
| **204 No Content** | Successful DELETE | Delete existing record |
| **400 Bad Request** | Invalid input data | Missing required field, invalid format |
| **401 Unauthorized** | No/invalid auth token | Missing Authorization header |
| **403 Forbidden** | Insufficient permissions | User role lacks permission |
| **404 Not Found** | Resource doesn't exist | Non-existent table/record ID |
| **409 Conflict** | Constraint violation | Duplicate unique field value |
| **500 Internal Server Error** | Database errors | SQL syntax error, connection failure |

---

## Remaining Files to Update (8 files, ~40+ specs)

### 1. GET /api/tables/{tableId}/records/get.json (12 specs)

**Current:** 12 placeholder specs
**Pattern:** List records with filtering, sorting, pagination

**Required scenarios:**
- [ ] Basic record listing (200)
- [ ] Empty table (200 with empty array)
- [ ] Pagination with limit/offset (200)
- [ ] Filtering with single condition (200)
- [ ] Filtering with multiple AND conditions (200)
- [ ] Filtering with OR conditions (200)
- [ ] Sorting ascending (200)
- [ ] Sorting descending (200)
- [ ] Field selection (projection) (200)
- [ ] View-based filtering (200)
- [ ] Table not found (404)
- [ ] Unauthorized access (401)

**Example spec:**
```json
{
  "id": "API-TABLES-RECORDS-LIST-001",
  "given": "Table 'users' with 3 records",
  "when": "User requests all records",
  "then": "Returns 200 with array of 3 records",
  "validation": {
    "setup": {
      "executeQuery": [
        "CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255), created_at TIMESTAMP DEFAULT NOW())",
        "INSERT INTO users (email) VALUES ('user1@example.com'), ('user2@example.com'), ('user3@example.com')"
      ],
      "apiRequest": {
        "method": "GET",
        "endpoint": "/api/tables/1/records",
        "headers": { "Authorization": "Bearer test_token" },
        "pathParams": { "tableId": 1 }
      }
    },
    "assertions": [
      {
        "description": "Returns 200 with all records",
        "expectedStatus": 200,
        "expectedSchema": {
          "type": "object",
          "properties": {
            "data": {
              "type": "array",
              "minItems": 3,
              "maxItems": 3
            },
            "total": { "type": "integer" },
            "offset": { "type": "integer" },
            "limit": { "type": "integer" }
          },
          "required": ["data", "total"]
        },
        "validateResponseData": {
          "total": 3,
          "data.length": 3
        }
      }
    ]
  }
}
```

### 2. GET /api/tables/{tableId}/records/{recordId}/get.json (2 specs)

**Required scenarios:**
- [ ] Get existing record by ID (200)
- [ ] Record not found (404)
- [ ] Table not found (404)
- [ ] Unauthorized access (401)

**Example:**
```json
{
  "id": "API-TABLES-RECORDS-GET-001",
  "given": "Table 'users' with record ID=1",
  "when": "User requests record by ID",
  "then": "Returns 200 with record data",
  "validation": {
    "setup": {
      "executeQuery": [
        "CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL, name VARCHAR(255))",
        "INSERT INTO users (email, name) VALUES ('john@example.com', 'John Doe') RETURNING id"
      ],
      "apiRequest": {
        "method": "GET",
        "endpoint": "/api/tables/1/records/1",
        "headers": { "Authorization": "Bearer test_token" },
        "pathParams": { "tableId": 1, "recordId": 1 }
      }
    },
    "assertions": [
      {
        "description": "Returns record with all fields",
        "expectedStatus": 200,
        "expectedSchema": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "email": { "type": "string" },
            "name": { "type": "string" }
          },
          "required": ["id", "email"]
        },
        "validateResponseData": {
          "id": 1,
          "email": "john@example.com",
          "name": "John Doe"
        }
      }
    ]
  }
}
```

### 3. PATCH /api/tables/{tableId}/records/{recordId}/patch.json (2 specs)

**Required scenarios:**
- [ ] Update existing record successfully (200)
- [ ] Record not found (404)
- [ ] Validation error (400)
- [ ] Unique constraint violation (409)
- [ ] Unauthorized access (401)

**Example:**
```json
{
  "id": "API-TABLES-RECORDS-UPDATE-001",
  "given": "Table 'users' with record ID=1",
  "when": "User updates record with valid data",
  "then": "Returns 200 with updated record",
  "validation": {
    "setup": {
      "executeQuery": [
        "CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(255))",
        "INSERT INTO users (id, email, name) VALUES (1, 'old@example.com', 'Old Name')"
      ],
      "apiRequest": {
        "method": "PATCH",
        "endpoint": "/api/tables/1/records/1",
        "headers": {
          "Authorization": "Bearer test_token",
          "Content-Type": "application/json"
        },
        "pathParams": { "tableId": 1, "recordId": 1 },
        "body": {
          "email": "new@example.com",
          "name": "New Name"
        }
      }
    },
    "assertions": [
      {
        "description": "Returns updated record",
        "expectedStatus": 200,
        "validateResponseData": {
          "id": 1,
          "email": "new@example.com",
          "name": "New Name"
        }
      },
      {
        "description": "Database reflects updated values",
        "executeQuery": "SELECT email, name FROM users WHERE id=1",
        "expected": {
          "email": "new@example.com",
          "name": "New Name"
        }
      }
    ]
  }
}
```

### 4. DELETE /api/tables/{tableId}/records/{recordId}/delete.json (2 specs)

**Required scenarios:**
- [ ] Delete existing record (204)
- [ ] Record not found (404)
- [ ] Table not found (404)
- [ ] Unauthorized access (401)

**Example:**
```json
{
  "id": "API-TABLES-RECORDS-DELETE-001",
  "given": "Table 'users' with record ID=1",
  "when": "User deletes record",
  "then": "Returns 204 and removes record from database",
  "validation": {
    "setup": {
      "executeQuery": [
        "CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255))",
        "INSERT INTO users (id, email) VALUES (1, 'test@example.com')"
      ],
      "apiRequest": {
        "method": "DELETE",
        "endpoint": "/api/tables/1/records/1",
        "headers": { "Authorization": "Bearer test_token" },
        "pathParams": { "tableId": 1, "recordId": 1 }
      }
    },
    "assertions": [
      {
        "description": "Returns 204 No Content",
        "expectedStatus": 204
      },
      {
        "description": "Record no longer exists in database",
        "executeQuery": "SELECT COUNT(*) as count FROM users WHERE id=1",
        "expected": { "count": 0 }
      }
    ]
  }
}
```

### 5. POST /api/tables/{tableId}/records/upsert/post.json (3 specs)

**Required scenarios:**
- [ ] Insert new record when not exists (201)
- [ ] Update existing record when exists (200)
- [ ] Validation error (400)
- [ ] Table not found (404)
- [ ] Unauthorized access (401)

**Example:**
```json
{
  "id": "API-TABLES-RECORDS-UPSERT-001",
  "given": "Table 'users' with unique email constraint, no existing record",
  "when": "User upserts record with new email",
  "then": "Returns 201 and creates new record",
  "validation": {
    "setup": {
      "executeQuery": [
        "CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(255))"
      ],
      "apiRequest": {
        "method": "POST",
        "endpoint": "/api/tables/1/records/upsert",
        "headers": {
          "Authorization": "Bearer test_token",
          "Content-Type": "application/json"
        },
        "pathParams": { "tableId": 1 },
        "body": {
          "email": "new@example.com",
          "name": "New User"
        }
      }
    },
    "assertions": [
      {
        "description": "Returns 201 with created record",
        "expectedStatus": 201,
        "validateResponseData": {
          "email": "new@example.com",
          "name": "New User"
        }
      },
      {
        "description": "Record exists in database",
        "executeQuery": "SELECT COUNT(*) as count FROM users WHERE email='new@example.com'",
        "expected": { "count": 1 }
      }
    ]
  }
}
```

### 6. POST /api/tables/{tableId}/records/batch/post.json (4 specs)

**Required scenarios:**
- [ ] Batch create multiple records successfully (201)
- [ ] Empty array returns empty result (200)
- [ ] Partial failure with validation errors (400)
- [ ] Table not found (404)
- [ ] Unauthorized access (401)

### 7. PATCH /api/tables/{tableId}/records/batch/patch.json (4 specs)

**Required scenarios:**
- [ ] Batch update multiple records successfully (200)
- [ ] Empty array returns empty result (200)
- [ ] Partial failure (some records not found) (207 Multi-Status)
- [ ] Table not found (404)
- [ ] Unauthorized access (401)

### 8. DELETE /api/tables/{tableId}/records/batch/delete.json (3 specs)

**Required scenarios:**
- [ ] Batch delete multiple records successfully (204)
- [ ] Empty array returns success (204)
- [ ] Table not found (404)
- [ ] Unauthorized access (401)

---

## Quality Checklist

Before considering a file complete, verify:

- [ ] All placeholder `fieldConfig` validation blocks removed
- [ ] PostgreSQL `executeQuery` setup for database state
- [ ] `apiRequest` with method, endpoint, headers, params, body
- [ ] `expectedStatus` matches HTTP semantics
- [ ] `expectedSchema` uses JSON Schema format
- [ ] Error scenarios include 401, 404, 400, 409 as appropriate
- [ ] Database state verification with additional `executeQuery` in assertions
- [ ] Consistent naming: `API-{FEATURE}-{ACTION}-{NNN}`
- [ ] Given-When-Then descriptions are clear and testable

---

## Next Steps

1. **Choose a file** from the remaining 8 files above
2. **Read the existing specs** to understand current placeholders
3. **Replace placeholder validation** with proper structure following examples above
4. **Add missing error scenarios** (401, 404, 400, 409 as needed)
5. **Test validation structure** by reviewing against checklist
6. **Repeat** for next file

---

## File Priority Order (Recommended)

1. ✅ GET /api/tables/{tableId}/records (most complex, 12 specs - foundational for understanding record listing)
2. ✅ GET /api/tables/{tableId}/records/{recordId}/get.json (simple, 2 specs)
3. ✅ PATCH /api/tables/{tableId}/records/{recordId}/patch.json (2 specs)
4. ✅ DELETE /api/tables/{tableId}/records/{recordId}/delete.json (2 specs)
5. ✅ POST /api/tables/{tableId}/records/upsert/post.json (3 specs)
6. ✅ POST /api/tables/{tableId}/records/batch/post.json (4 specs)
7. ✅ PATCH /api/tables/{tableId}/records/batch/patch.json (4 specs)
8. ✅ DELETE /api/tables/{tableId}/records/batch/delete.json (3 specs)

---

## Summary

**Completed:** 6 files, 23 specs (with error scenarios: ~35 total test cases)
**Remaining:** 8 files, ~40+ specs

**Pattern established:** PostgreSQL-based validation with comprehensive error coverage
**Next action:** Apply pattern to remaining record endpoint files following examples above
