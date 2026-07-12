/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const ADMIN_SEARCH_CONTENT_TABLE = 'system__admin_search_index'

export const ADMIN_SEARCH_FTS_TABLE = 'system__admin_search_fts'

export const adminSearchFtsBootStatements = (): readonly string[] => [
  `CREATE VIRTUAL TABLE IF NOT EXISTS ${ADMIN_SEARCH_FTS_TABLE} USING fts5(
     title,
     body,
     content='${ADMIN_SEARCH_CONTENT_TABLE}',
     content_rowid='id'
   )`,
  `CREATE TRIGGER IF NOT EXISTS ${ADMIN_SEARCH_CONTENT_TABLE}_ai
     AFTER INSERT ON ${ADMIN_SEARCH_CONTENT_TABLE} BEGIN
       INSERT INTO ${ADMIN_SEARCH_FTS_TABLE}(rowid, title, body)
       VALUES (new.id, new.title, new.body);
     END`,
  `CREATE TRIGGER IF NOT EXISTS ${ADMIN_SEARCH_CONTENT_TABLE}_ad
     AFTER DELETE ON ${ADMIN_SEARCH_CONTENT_TABLE} BEGIN
       INSERT INTO ${ADMIN_SEARCH_FTS_TABLE}(${ADMIN_SEARCH_FTS_TABLE}, rowid, title, body)
       VALUES ('delete', old.id, old.title, old.body);
     END`,
  `CREATE TRIGGER IF NOT EXISTS ${ADMIN_SEARCH_CONTENT_TABLE}_au
     AFTER UPDATE ON ${ADMIN_SEARCH_CONTENT_TABLE} BEGIN
       INSERT INTO ${ADMIN_SEARCH_FTS_TABLE}(${ADMIN_SEARCH_FTS_TABLE}, rowid, title, body)
       VALUES ('delete', old.id, old.title, old.body);
       INSERT INTO ${ADMIN_SEARCH_FTS_TABLE}(rowid, title, body)
       VALUES (new.id, new.title, new.body);
     END`,
]
