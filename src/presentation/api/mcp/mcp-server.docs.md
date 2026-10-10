# Server Mode

> The six surfaces that become tools once the server is running, how an entity declares itself eligible, and the risk hints a client reads before deciding whether to ask its user first.

Nothing is exposed by default. An entity appears only when its schema declares `aiAccess`, and a credential is shown only the tools its role may call.

## The six surfaces that become tools

| Surface            | Tool name                         | What it does                                                                               |
| ------------------ | --------------------------------- | ------------------------------------------------------------------------------------------ |
| User tables        | `{app}_{table}_{op}`              | Read, list, create, update and delete records                                              |
| Manual automations | `{app}_automation_{name}`         | Invoke an automation that has a manual trigger                                             |
| Action templates   | `{app}_action_{name}`             | Execute one action template                                                                |
| Admin internals    | `{app}_auth_*` / `{app}_system_*` | Read-only views of auth and system tables, newest first and filterable, admin role only    |
| Configuration      | `{app}_config_*`                  | Read-only views of the config, its findings, its schema and its run state, admin role only |
| Admin reads        | `{app}_admin_*`                   | The admin API's own reads — automation run history first — admin role only, audited        |

A table name keeps its capitals and hyphens in its tool names, and any other character — a space, most often — becomes `_`, because MCP clients refuse a tool name with a space in it: `Open Deals` in an app named `crm` gives `crm_Open_Deals_list`. The tool list is filtered per connection, so a viewer credential is never even told that a delete tool exists. Only manual-trigger automations qualify: a cron or record-change automation has no caller to expose.

A create, update or delete tool runs the same write the records API runs, so the table's webhooks and the automations triggered by that record event fire for it exactly as they do for a `POST`, `PATCH` or `DELETE` — an assistant's change is not a quieter one.

### The configuration tools

The configuration row is one of two you do not declare. `{app}_config_read`, `{app}_config_validate`, `{app}_config_schema` and `{app}_config_status` are compiled from your app's name alone, so every instance has exactly these four and no configuration can add, remove or rename one. They are **admin-only** here, filtered out of the tool list for every other role, and all four are reads — none of them can change what the instance runs. **Your Config over MCP** describes what each one returns, and the local `sovrium mcp` path where the process boundary replaces the role check.

`{app}_config_read` redacts declared secrets, and `{app}_config_validate` reports what is wrong with a config without quoting the value it objected to — a rejected value travels only where it is a name checked against a closed list, such as an unknown component `type`. Neither tool hands a credential to the assistant that asked.

**A table named `config` is refused at boot.** It would compile to `{app}_config_read` — the name the configuration tool already answers to — and two tools cannot share one name without one of them silently becoming unreachable. Rather than pick a loser, the server refuses to start and names the table:

```text
MCP tool-name collision: the table 'config' compiles to 'crm_config_read', which is the name of
this instance's configuration read tool. Rename the table — 'config' is reserved on the MCP
surface for the same reason 'auth_*' and 'system_*' are.
```

The refusal fires when the route actually mounts — `MCP_ENABLED=true` on the default transport. A table called `config` is fine on an app that does not serve MCP over HTTP.

**Only the exact name is reserved.** `auth_*` and `system_*` are refused as table-name _prefixes_ — judged on the name the table is stored under, so `System Activity Logs` is refused as `system_activity_logs` would be — and no table of yours can produce those names at all; the configuration family is not comparable, because it is four exact names. A table called `config_backup` is an ordinary table of yours, its tools are ordinary data tools, and every role that may call them sees them.

### The admin read tools

The last row is the other one you do not declare. Each admin read tool runs the same read as an admin endpoint, with the same filters, and answers the same JSON body, so an assistant can investigate an incident the way the operator console does — without a database client, and without a second, weaker copy of the read. They are compiled from your app's name alone, offered only to an admin-tier credential, and refused by name to every other role.

| Tool                                      | Same read as                                               | Arguments                                                                        |
| ----------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `{app}_admin_automation_runs_list`        | `GET /api/admin/automations/runs`                          | `status`, `automationName`, `automationId`, `from`, `to`, `q`, `limit`, `cursor` |
| `{app}_admin_automation_run_read`         | `GET /api/admin/automations/runs/:runId`                   | `runId`                                                                          |
| `{app}_admin_automations_overview`        | `GET /api/admin/automations/overview`                      | `period` — `24h` (default), `7d` or `30d`                                        |
| `{app}_admin_automations_catalog`         | `GET /api/admin/automations`                               | none                                                                             |
| `{app}_admin_releases_list`               | `GET /api/admin/releases`                                  | none                                                                             |
| `{app}_admin_release_read`                | `GET /api/admin/releases/:hash`                            | `hash` — a config hash or a boot id                                              |
| `{app}_admin_decisions_list`              | `GET /api/admin/decisions`                                 | none                                                                             |
| `{app}_admin_config_schema`               | `GET /api/admin/config/schema`                             | none                                                                             |
| `{app}_admin_env_list`                    | `GET /api/admin/env`                                       | none                                                                             |
| `{app}_admin_config_version`              | `GET /api/admin/config/version`                            | none                                                                             |
| `{app}_admin_instance_read`               | `GET /api/admin/instance`                                  | `limit`                                                                          |
| `{app}_admin_mcp_tools_list`              | `GET /api/admin/mcp/tools`                                 | `category` — `table`, `action`, `automation` or `admin`                          |
| `{app}_admin_config_reflection`           | `GET /api/admin/config/reflection`                         | none                                                                             |
| `{app}_admin_config_declarations_list`    | `GET /api/admin/config/declarations`                       | `family`                                                                         |
| `{app}_admin_overview_read`               | `GET /api/admin/overview`                                  | none                                                                             |
| `{app}_admin_attention_read`              | `GET /api/admin/attention`                                 | none                                                                             |
| `{app}_admin_search`                      | `GET /api/admin/search`                                    | `q`                                                                              |
| `{app}_admin_footprint_overview`          | `GET /api/admin/footprint/overview`                        | none                                                                             |
| `{app}_admin_storage_status`              | `GET /api/admin/storage/status`                            | none                                                                             |
| `{app}_admin_tables_overview`             | `GET /api/admin/tables/overview`                           | `period` — `24h` (default), `7d` or `30d`                                        |
| `{app}_admin_design_system_json`          | `GET /api/admin/design-system.json`                        | `flat` — `true` for the tokens as rows                                           |
| `{app}_admin_design_system_markdown`      | `GET /api/admin/design-system.md`                          | none — answers the markdown text                                                 |
| `{app}_admin_design_system_specimen_rows` | `GET /api/admin/design-system/specimen-rows`               | `rows` — `0` for the empty state, `page`, `limit`                                |
| `{app}_admin_design_system_shares_list`   | `GET /api/admin/design-system/shares`                      | none — never the share link                                                      |
| `{app}_admin_design_system_tokens`        | `GET /api/admin/design-system/tokens`                      | `group`                                                                          |
| `{app}_admin_design_system_guidance`      | `GET /api/admin/design-system/guidance`                    | `kind`, `label`                                                                  |
| `{app}_admin_design_system_coverage`      | `GET /api/admin/design-system/coverage`                    | `key`                                                                            |
| `{app}_admin_design_system_exports`       | `GET /api/admin/design-system/exports`                     | none                                                                             |
| `{app}_admin_design_system_usage`         | `GET /api/admin/design-system/usage`                       | `subject`, `name`                                                                |
| `{app}_admin_design_system_brand`         | `GET /api/admin/design-system/brand`                       | none                                                                             |
| `{app}_admin_design_system_zones`         | `GET /api/admin/design-system/zones`                       | none                                                                             |
| `{app}_admin_design_system_type_ladder`   | `GET /api/admin/design-system/type-ladder`                 | none                                                                             |
| `{app}_admin_design_system_provenance`    | `GET /api/admin/design-system/provenance`                  | `type`, `part`                                                                   |
| `{app}_admin_component_types_list`        | `GET /api/admin/schema/component-types`                    | none                                                                             |
| `{app}_admin_component_type_read`         | `GET /api/admin/schema/component-types/:type`              | `type`, `routesLimit`                                                            |
| `{app}_admin_component_type_options`      | `GET /api/admin/schema/component-types/:type/options`      | `type`, `group`                                                                  |
| `{app}_admin_field_types_list`            | `GET /api/admin/schema/field-types`                        | none                                                                             |
| `{app}_admin_links_list`                  | `GET /api/admin/links`                                     | `q`, `tag`, `source`, `state`, `include_archived`, `limit`, `cursor`             |
| `{app}_admin_link_read`                   | `GET /api/admin/links/:slug`                               | `slug`                                                                           |
| `{app}_admin_connections_list`            | `GET /api/admin/connections`                               | none                                                                             |
| `{app}_admin_connection_read`             | `GET /api/admin/connections/:id`                           | `id`                                                                             |
| `{app}_admin_buckets_list`                | `GET /api/admin/buckets`                                   | `provider`, `limit`, `cursor`                                                    |
| `{app}_admin_buckets_overview`            | `GET /api/admin/buckets/overview`                          | `period` — `24h` (default), `7d` or `30d`                                        |
| `{app}_admin_bucket_files_list`           | `GET /api/admin/buckets/:bucketName/files`                 | `bucketName`, `sort`, `order`, `type`, `q`, `limit`, `cursor`                    |
| `{app}_admin_agents_list`                 | `GET /api/admin/agents`                                    | `limit`, `cursor`                                                                |
| `{app}_admin_agent_conversations_list`    | `GET /api/admin/agents/:name/conversations`                | `name`, `from`, `to`, `q`, `limit`, `cursor`                                     |
| `{app}_admin_agent_conversation_read`     | `GET /api/admin/agents/:name/conversations/:id`            | `name`, `id`                                                                     |
| `{app}_admin_forms_list`                  | `GET /api/admin/forms`                                     | `search`, `limit`, `cursor`                                                      |
| `{app}_admin_form_read`                   | `GET /api/admin/forms/:formName`                           | `formName`                                                                       |
| `{app}_admin_form_submissions_list`       | `GET /api/admin/forms/:formName/submissions`               | `formName`, `status`, `from`, `to`, `q`, `include_deleted`, `limit`, `cursor`    |
| `{app}_admin_form_submission_read`        | `GET /api/admin/forms/:formName/submissions/:submissionId` | `formName`, `submissionId`, `reveal`                                             |
| `{app}_admin_form_submissions_export`     | `GET /api/admin/forms/:formName/submissions/export`        | `formName`                                                                       |
| `{app}_admin_form_analytics`              | `GET /api/admin/forms/:formName/analytics`                 | `formName`, `window` — `24h`, `7d` or `30d` (default)                            |
| `{app}_admin_users_overview`              | `GET /api/admin/users/overview`                            | `period` — `24h` (default), `7d` or `30d`                                        |
| `{app}_admin_users_list`                  | `GET /api/admin/users` (JSON)                              | `q`, `sort`, `order`, `page`, `limit`                                            |
| `{app}_admin_invitations_list`            | `GET /api/admin/invitations`                               | none                                                                             |
| `{app}_admin_roles_list`                  | `GET /api/admin/roles`                                     | none                                                                             |
| `{app}_admin_groups_list`                 | `GET /api/admin/groups`                                    | none                                                                             |
| `{app}_admin_organisation_graph`          | `GET /api/admin/organisation/graph`                        | `node`                                                                           |
| `{app}_admin_audit_log_list`              | `GET /api/admin/audit-log`                                 | `actorId`, `action`, `transport`, `resourceType`                                 |

The configuration, console and design-system tools answer exactly what their endpoints answer, redaction included: the configuration reads never carry a credential the config holds, and the environment read says whether a variable is set and where from, never its value. The markdown tool answers the export's text byte for byte rather than JSON. The share list names each live public share of the design system by its id and creation time and never its link: the link is the token, handed out once when the share is minted.

"Which runs failed in the last hour?" is one call: `status: "failed"` with `from` an hour ago. The list is newest first, a page holds only matches, `limit` runs from 1 to 200 (50 by default) and `nextCursor` is `null` on the last page. `q` searches the automation name and the failure message — the text that says _why_ a run failed, which no column shows. A `from` later than `to` is refused as invalid arguments. Reading one run answers its steps in order, each with what it wrote to `context.log`; an unknown run id and a malformed one get the same not-found error, so the shape of an id reveals nothing.

A tool answers exactly what its endpoint answers, so it withholds what the endpoint withholds: a connection read names each token's user, expiry and status, never the token, the refresh token or the stored credentials, and a submission read leaves out the submitted body. `reveal: true` returns the body only where the endpoint would — the instance sets `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true` and the caller is an admin — and writes the same critical audit event; anywhere else the call is refused with `body-capture-disabled` in the error. The submissions export answers the same CSV text the endpoint downloads, every field your role may not read left blank. The OAuth callback beside the connection reads is not a tool — it exchanges a code and stores a token, which makes it an action.

Every tool here is a read: each is marked `readOnlyHint`, not destructive and idempotent, and none of them can retry, pause, resume, approve or reject anything. Each call is recorded in the tool-call log — its argument names, any number or true/false value, and the size of its answer, never the answer or any other value — and a tool whose endpoint writes an admin audit event writes the same one, marked as coming through MCP — see **Auth, RBAC and Rate Limiting**.

**Only the exact names are reserved.** A table of yours whose tool would answer to one of these names — a table called `admin_automation_runs` that opts into `list` — is refused when the route mounts, naming the table, for the same reason a table called `config` is. A table called `admin_notes` is an ordinary table: its tools are ordinary data tools, and every role that may call them sees them.

## Declaring eligibility

`aiAccess` is the schema author's declaration of intent, deliberately separate from the operator's switch. Writing it exposes nothing on its own, and the switch exposes nothing you did not write — two hands on the lever rather than one.

```yaml
tables:
  - name: contacts
    aiAccess: true
```

The boolean is the common case. The object form takes over when the defaults are not right, and **supplying any object is itself the enable signal** — there is no `enabled` field to set.

```yaml
tables:
  - name: contacts
    aiAccess:
      description: Customer contacts. Use this when the user asks about people.
      operations: [read, list, create, update]
      fieldExposure: permissioned
      annotations:
        readOnly: false
        destructive: false
```

<!-- sovrium:options AiAccessConfigSchema -->

Automations and action templates accept the same block but ignore `operations`: each exposes a single invocation tool.

**`description` is the highest-leverage field here.** The model chooses tools by reading them, so "Customer contacts. Use this when the user asks about people" produces materially better behaviour than an auto-generated "Read from contacts" — it says _when_ to reach for the tool rather than only what it touches. Spend the effort here before tuning anything else.

## How much of a table the tool schema names

| Mode           | Fields in the tool schema                                    |
| -------------- | ------------------------------------------------------------ |
| `permissioned` | No field list — an opaque `data` object. The default         |
| `all`          | Every field, still subject to field-level rules at call time |
| `whitelist`    | Only the names in `whitelistFields`                          |

Every caller is shown the same tool schema. The catalogue is compiled once from the config, so the per-connection step decides _which_ tools a role sees, not what shape each one has.

That is why `permissioned` names no fields and why it is the default: it is the one mode that reveals nothing about your columns to a role that could not use them. Enforcement lands at call time instead — a read omits fields the caller may not read, and a write to a field it may not write is refused. Reach for `all` or `whitelist` when a real argument hint is worth more than the reticence, and for `whitelist` in particular when a table holds columns a role may read but that are simply not the model's business.

With `whitelist`, each record's `fields` carries exactly the whitelisted fields; its timestamps appear at the record's top level as `createdAt` and `updatedAt`.

## Risk hints

Annotations compile into the tool definition so a client can decide whether to run a call silently or ask its user first. They map one-to-one onto the protocol's own hints.

<!-- sovrium:options ToolAnnotationsSchema -->

Left unset, sensible values are derived from the operation type, and `MCP_CONFIRM_DESTRUCTIVE` — on by default — additionally marks delete tools and non-idempotent automations as destructive.

The case worth setting by hand is the automation that is technically idempotent but practically irreversible: sending an email, charging a card. Calling it twice writes no duplicate row, so nothing derives a warning from its shape, and `requireConfirmation: true` is how you say so anyway.
