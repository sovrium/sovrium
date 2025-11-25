# API Schema Roadmap

> **Last Generated**: 2025-11-24
> **Back to**: [Main Roadmap](../../ROADMAP.md)

## 2. API Schema Progress

📋 **Goal**: `specs/api/app.openapi.json` (19 endpoints)
📦 **Current**: `schemas/0.0.1/app.openapi.json` (28 endpoints)
📊 **Completion**: 58% (11/19 implemented)

### Missing Endpoints (8)

| Method   | Path                                       |
| -------- | ------------------------------------------ |
| `POST`   | `/api/auth/forget-password`                |
| `GET`    | `/api/tables`                              |
| `GET`    | `/api/tables/{tableId}`                    |
| `GET`    | `/api/tables/{tableId}/records`            |
| `POST`   | `/api/tables/{tableId}/records`            |
| `DELETE` | `/api/tables/{tableId}/records/{recordId}` |
| `GET`    | `/api/tables/{tableId}/records/{recordId}` |
| `PATCH`  | `/api/tables/{tableId}/records/{recordId}` |

---

## API Specifications (43 total)

### Status Legend

- ✅ **DONE**: Test implemented and passing
- 🚧 **WIP**: Test exists but marked with .fixme()
- ⏳ **TODO**: No test file exists

### All Specifications

| Status | ID                                   | Specification                                                                                          | Source File                                                       | Test File                                                   |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| ✅     | API-AUTH-CHANGE-EMAIL-002            | **Given** A running server, **When** Unauthenticated user requests email change, **Then** Respons...   | `specs/api/paths/auth/change-email/post.json`                     | `specs/api/paths/auth/change-email/post.spec.ts`            |
| ✅     | API-AUTH-CHANGE-EMAIL-003            | **Given** A running server, **When** User submits invalid email format, **Then** Response should ...   | `specs/api/paths/auth/change-email/post.json`                     | `specs/api/paths/auth/change-email/post.spec.ts`            |
| ✅     | API-AUTH-CHANGE-PASSWORD-002         | **Given** A running server, **When** Unauthenticated user requests password change, **Then** Resp...   | `specs/api/paths/auth/change-password/post.json`                  | `specs/api/paths/auth/change-password/post.spec.ts`         |
| ✅     | API-AUTH-CHANGE-PASSWORD-003         | **Given** A running server, **When** User submits wrong current password, **Then** Response shoul...   | `specs/api/paths/auth/change-password/post.json`                  | `specs/api/paths/auth/change-password/post.spec.ts`         |
| ✅     | API-AUTH-FORGET-PASSWORD-002         | **Given** A running server, **When** User requests password reset with invalid email, **Then** Re...   | `specs/api/paths/auth/forget-password/post.json`                  | `specs/api/paths/auth/forget-password/post.spec.ts`         |
| ✅     | API-AUTH-GET-SESSION-002             | **Given** A running server, **When** User requests current session, **Then** Response should be 2...   | `specs/api/paths/auth/get-session/get.json`                       | `specs/api/paths/auth/get-session/get.spec.ts`              |
| ✅     | API-AUTH-RESET-PASSWORD-002          | **Given** A running server, **When** User submits reset with invalid token, **Then** Response sho...   | `specs/api/paths/auth/reset-password/post.json`                   | `specs/api/paths/auth/reset-password/post.spec.ts`          |
| ✅     | API-AUTH-SEND-VERIFICATION-EMAIL-002 | **Given** A running server, **When** User requests verification email, **Then** Response should b...   | `specs/api/paths/auth/send-verification-email/post.json`          | `specs/api/paths/auth/send-verification-email/post.spec.ts` |
| ✅     | API-AUTH-SIGN-IN-EMAIL-002           | **Given** A running server, **When** User attempts sign-in with wrong password, **Then** Response...   | `specs/api/paths/auth/sign-in/email/post.json`                    | `specs/api/paths/auth/sign-in/email/post.spec.ts`           |
| ✅     | API-AUTH-SIGN-IN-EMAIL-003           | **Given** A running server, **When** User attempts sign-in with non-existent email, **Then** Resp...   | `specs/api/paths/auth/sign-in/email/post.json`                    | `specs/api/paths/auth/sign-in/email/post.spec.ts`           |
| ✅     | API-AUTH-SIGN-IN-SOCIAL-002          | **Given** A running server, **When** User requests social sign-in without provider, **Then** Resp...   | `specs/api/paths/auth/sign-in/social/post.json`                   | `specs/api/paths/auth/sign-in/social/post.spec.ts`          |
| ✅     | API-AUTH-SIGN-UP-EMAIL-002           | **Given** A running server, **When** Another user attempts sign-up with same email, **Then** Resp...   | `specs/api/paths/auth/sign-up/email/post.json`                    | `specs/api/paths/auth/sign-up/email/post.spec.ts`           |
| ✅     | API-AUTH-SIGN-UP-EMAIL-003           | **Given** A running server, **When** User attempts sign-up without email, **Then** Request should...   | `specs/api/paths/auth/sign-up/email/post.json`                    | `specs/api/paths/auth/sign-up/email/post.spec.ts`           |
| ✅     | API-AUTH-VERIFY-EMAIL-002            | **Given** A running server, **When** User submits invalid token, **Then** Response should be unau...   | `specs/api/paths/auth/verify-email/get.json`                      | `specs/api/paths/auth/verify-email/get.spec.ts`             |
| ✅     | API-HEALTH-002                       | **Given** A server with specific app name, **When** User requests health endpoint, **Then** JSON ...   | `specs/api/paths/health/get.json`                                 | `specs/api/paths/health/get.spec.ts`                        |
| ✅     | API-HEALTH-003                       | **Given** A running server, **When** User requests health endpoint, **Then** Timestamp should be ...   | `specs/api/paths/health/get.json`                                 | `specs/api/paths/health/get.spec.ts`                        |
| ✅     | API-HEALTH-004                       | **Given** A server with scoped package name, **When** User requests health endpoint, **Then** App...   | `specs/api/paths/health/get.json`                                 | `specs/api/paths/health/get.spec.ts`                        |
| ⏳     | API-AUTH-CHANGE-EMAIL-001            | **Given** A running server, **When** User requests email change without newEmail, **Then** Respon...   | `specs/api/paths/auth/change-email/post.json`                     | `specs/api/paths/auth/change-email/post.spec.ts`            |
| ⏳     | API-AUTH-CHANGE-PASSWORD-001         | **Given** A running server, **When** User requests password change without newPassword, **Then** ...   | `specs/api/paths/auth/change-password/post.json`                  | `specs/api/paths/auth/change-password/post.spec.ts`         |
| ⏳     | API-AUTH-FORGET-PASSWORD-001         | **Given** A running server, **When** User requests password reset, **Then** Response should be 20...   | `specs/api/paths/auth/forget-password/post.json`                  | `specs/api/paths/auth/forget-password/post.spec.ts`         |
| ⏳     | API-AUTH-GET-SESSION-001             | **Given** A running server, **When** User requests current session, **Then** Response should be 2...   | `specs/api/paths/auth/get-session/get.json`                       | `specs/api/paths/auth/get-session/get.spec.ts`              |
| ⏳     | API-AUTH-RESET-PASSWORD-001          | **Given** A running server, **When** User submits reset without new password, **Then** Response s...   | `specs/api/paths/auth/reset-password/post.json`                   | `specs/api/paths/auth/reset-password/post.spec.ts`          |
| ⏳     | API-AUTH-SEND-VERIFICATION-EMAIL-001 | **Given** A running server, **When** User requests verification without email, **Then** Response ...   | `specs/api/paths/auth/send-verification-email/post.json`          | `specs/api/paths/auth/send-verification-email/post.spec.ts` |
| ⏳     | API-AUTH-SIGN-IN-EMAIL-001           | **Given** A running server, **When** User signs in with correct credentials, **Then** Response sh...   | `specs/api/paths/auth/sign-in/email/post.json`                    | `specs/api/paths/auth/sign-in/email/post.spec.ts`           |
| ⏳     | API-AUTH-SIGN-IN-SOCIAL-001          | **Given** A running server, **When** User requests social sign-in with Google provider, **Then** ...   | `specs/api/paths/auth/sign-in/social/post.json`                   | `specs/api/paths/auth/sign-in/social/post.spec.ts`          |
| ⏳     | API-AUTH-SIGN-OUT-001                | **Given** A running server, **When** User signs out, **Then** Sign-out should succeed                  | `specs/api/paths/auth/sign-out/post.json`                         | `specs/api/paths/auth/sign-out/post.spec.ts`                |
| ⏳     | API-AUTH-SIGN-UP-EMAIL-001           | **Given** A running server, **When** User signs up with valid credentials, **Then** Response shou...   | `specs/api/paths/auth/sign-up/email/post.json`                    | `specs/api/paths/auth/sign-up/email/post.spec.ts`           |
| ⏳     | API-AUTH-VERIFY-EMAIL-001            | **Given** A running server, **When** User requests verification without token, **Then** Response ...   | `specs/api/paths/auth/verify-email/get.json`                      | `specs/api/paths/auth/verify-email/get.spec.ts`             |
| ⏳     | API-HEALTH-001                       | **Given** A running server, **When** User requests health endpoint, **Then** Response should be 2...   | `specs/api/paths/health/get.json`                                 | `specs/api/paths/health/get.spec.ts`                        |
| ⏳     | API-TABLES-GET-001                   | **Given** A running server with existing table, **When** User requests table by ID, **Then** Resp...   | `specs/api/paths/tables/{tableId}/get.json`                       | -                                                           |
| ⏳     | API-TABLES-GET-002                   | **Given** A running server, **When** User requests non-existent table, **Then** Response should b...   | `specs/api/paths/tables/{tableId}/get.json`                       | -                                                           |
| ⏳     | API-TABLES-LIST-001                  | **Given** A running server with tables configured, **When** User requests list of all tables, \*\*T... | `specs/api/paths/tables/get.json`                                 | -                                                           |
| ⏳     | API-TABLES-LIST-002                  | **Given** A running server with no tables, **When** User requests list of all tables, **Then** Re...   | `specs/api/paths/tables/get.json`                                 | -                                                           |
| ⏳     | API-TABLES-RECORDS-CREATE-001        | **Given** A running server with valid table, **When** User creates record with valid data, \*\*Then... | `specs/api/paths/tables/{tableId}/records/post.json`              | -                                                           |
| ⏳     | API-TABLES-RECORDS-CREATE-002        | **Given** A running server, **When** User attempts to create record in non-existent table, \*\*Then... | `specs/api/paths/tables/{tableId}/records/post.json`              | -                                                           |
| ⏳     | API-TABLES-RECORDS-DELETE-001        | **Given** A running server with existing record, **When** User deletes record by ID, **Then** Res...   | `specs/api/paths/tables/{tableId}/records/{recordId}/delete.json` | -                                                           |
| ⏳     | API-TABLES-RECORDS-DELETE-002        | **Given** A running server, **When** User attempts to delete non-existent record, **Then** Respon...   | `specs/api/paths/tables/{tableId}/records/{recordId}/delete.json` | -                                                           |
| ⏳     | API-TABLES-RECORDS-GET-001           | **Given** A running server with existing record, **When** User requests record by ID, **Then** Re...   | `specs/api/paths/tables/{tableId}/records/{recordId}/get.json`    | -                                                           |
| ⏳     | API-TABLES-RECORDS-GET-002           | **Given** A running server, **When** User requests non-existent record, **Then** Response should ...   | `specs/api/paths/tables/{tableId}/records/{recordId}/get.json`    | -                                                           |
| ⏳     | API-TABLES-RECORDS-LIST-001          | **Given** A running server with existing records, **When** User requests list of records, \*_Then_...  | `specs/api/paths/tables/{tableId}/records/get.json`               | -                                                           |
| ⏳     | API-TABLES-RECORDS-LIST-002          | **Given** A running server, **When** User requests records from non-existent table, **Then** Resp...   | `specs/api/paths/tables/{tableId}/records/get.json`               | -                                                           |
| ⏳     | API-TABLES-RECORDS-UPDATE-001        | **Given** A running server with existing record, **When** User updates record with valid data, \*\*... | `specs/api/paths/tables/{tableId}/records/{recordId}/patch.json`  | -                                                           |
| ⏳     | API-TABLES-RECORDS-UPDATE-002        | **Given** A running server, **When** User attempts to update non-existent record, **Then** Respon...   | `specs/api/paths/tables/{tableId}/records/{recordId}/patch.json`  | -                                                           |

### Summary

| Total | ✅ DONE | 🚧 WIP | ⏳ TODO |
| ----- | ------- | ------ | ------- |
| 43    | 17      | 0      | 26      |
