# Sources

Each entry: title — author or organisation — URL — date — licence (where known). "Lifted" is a paraphrase; nothing is copied verbatim. URLs were fetched or returned by search on 2026-09-24.

1. **Structuring your Airtable bases effectively** — Airtable — https://support.airtable.com/docs/structuring-your-airtable-bases-effectively — date not recorded — proprietary documentation.
   Lifted: one table per real-world thing; merge look-alike tables into one table with views.
2. **6 common Airtable design decisions** — Airtable — https://www.airtable.com/guides/build/airtable-design-decisions — date not recorded — proprietary documentation.
   Lifted: when a select should become a linked table; per-period tables as an anti-pattern.
3. **Connect your data with linked records** — Airtable — https://www.airtable.com/guides/build/connect-data-with-linked-records — date not recorded.
   Lifted: say the relation as a sentence from both sides; lookups instead of copied values.
4. **Field type overview** — Airtable — https://support.airtable.com/articles/2361876459-field-type-overview — date not recorded. _Unverified by fetch._
   Lifted: converting a populated field's type can clear cells, so plan type changes.
5. **Database relations & rollups** — Notion — https://www.notion.com/help/relations-and-rollups — date not recorded.
   Lifted: derive aggregates through the relation instead of storing them.
6. **Role-based access control and field-level permissions** — Baserow — https://baserow.io/user-docs/role-based-access-control-rbac and https://baserow.io/user-docs/field-level-permissions — date not recorded.
   Lifted: roles by function; field permissions as a narrowing layer.
7. **Link to another record** — NocoDB — https://nocodb.com/docs/product/tables/fields/field-types/links-based/link-to-another-record — date not recorded.
   Lifted: many-to-many with a junction when the pairing carries data.
8. **User groups and permissions** — Softr — https://docs.softr.io/core-concepts-overview/user-groups--permissions — date not recorded.
   Lifted: row scoping belongs to the data layer, not to what a page happens to filter.
9. **Database normalization for beginners: a no-code perspective** — Knack — https://www.knack.com/blog/database-normalization-no-code/ — 2025-08-25.
   Lifted: 1NF–3NF explained as plain-language smells (numbered fields, copied details).
10. **The SQL table naming dilemma** — Bytebase — https://www.bytebase.com/blog/sql-table-naming-dilemma-singular-vs-plural/ — 2025-10-01.
    Lifted: pick one naming convention and keep it everywhere.
11. **ParallelChange** — Danilo Sato, on Martin Fowler's bliki — https://martinfowler.com/bliki/ParallelChange.html — 2014-05-13.
    Lifted: expand → migrate → contract for any change to the shape of existing data.
12. **API1:2023 Broken Object Level Authorization** — OWASP API Security Top 10 — https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization — 2023.
    Lifted: object-level checks on every record access; test the denied path, not only the allowed one.
13. **Role Based Access Control** — NIST — https://csrc.nist.gov/projects/role-based-access-control — date not recorded — licence not recorded.
    Lifted: roles as job functions; least privilege; separation of duties.
14. **SQL Antipatterns, Volume 1** — Bill Karwin — Pragmatic Bookshelf — https://pragprog.com/titles/bksap1/sql-antipatterns-volume-1/ — 2022 — book (paraphrased only).
    Lifted: the names of the anti-patterns (comma-separated lists, entity-attribute-value, multi-column attributes, metadata tribbles).
15. **Database testing with fixtures and seeding** — Neon — https://neon.com/blog/database-testing-with-fixtures-and-seeding — 2024-07-02.
    Lifted: reference data versus sample data; seeds that are idempotent and resettable.
16. **database-schema-designer skill** — borghei, `Claude-Skills` — https://github.com/borghei/Claude-Skills/blob/main/engineering/database-schema-designer/SKILL.md — date not recorded — MIT with Commons Clause.
    Lifted: the ask-first pre-flight and the output bundle (table list, field table, diagram).
17. **database-design skill** — davila7, `claude-code-templates` — https://github.com/davila7/claude-code-templates/blob/main/cli-tool/components/skills/development/database-design/SKILL.md — date not recorded.
    Lifted: a decision table for choosing a field type.
18. **postgres-best-practices skill** — Supabase, `agent-skills` — https://github.com/supabase/agent-skills — date not recorded.
    Lifted: grading findings by impact.

Sovrium's own behaviour (field ids as rename anchors, the permission defaults, the 404 rule, migration and seed behaviour) comes from the manual shipped in the binary, `sovrium docs`, not from these sources.
