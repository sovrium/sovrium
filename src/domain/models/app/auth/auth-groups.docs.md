# Groups

> A many-to-many layer over roles — a user has one role, and belongs to any number of groups.

Permissions reference a group with a `group:` prefix, which makes groups the right tool for team-scoped and field-level access.

```yaml
auth:
  strategies:
    - type: emailAndPassword
  groups:
    - name: marketing
    - name: finance
      description: Finance team with access to financial data
    - name: project-alpha
      description: Cross-functional team
      maxMembers: 50
```

Teams are configured through groups: define one per team and reference it in permissions.

## Defining a group

<!-- sovrium:options GroupSchema -->

`name` is required, lowercase, alphanumeric with hyphens, and must start with a letter — the same convention role names follow. `maxMembers` is unlimited when omitted.

### Roles and groups share one namespace

A group named `admin` is refused because it collides with the built-in role. Keep group names distinct from every built-in and custom role name; validation also refuses a duplicate group name.

The shared namespace is what makes a permission entry unambiguous: `marketing` in a permission array is a role, and `group:marketing` is a group, but a name that could be either would make the prefix a suggestion rather than a rule.

## Membership is runtime, not configuration

The schema declares which groups **exist**, not who belongs to them. Membership is assigned at runtime, by an admin or by an automation. Where `maxMembers` is set, an attempt to add somebody past the cap is refused.

## Group-based permissions

```yaml
tables:
  - id: 1
    name: Campaigns
    fields:
      - { id: 1, name: title, type: single-line-text, required: true }
      - { id: 2, name: budget, type: number }
    permissions:
      read: [member, 'group:marketing']
      update: ['group:marketing']
      fields:
        - { field: budget, read: ['group:finance'] }
```

| Entry             | Grants to                             |
| ----------------- | ------------------------------------- |
| `member`          | Everyone holding the `member` role    |
| `group:marketing` | Every member of the `marketing` group |
| `admin`           | The `admin` role                      |

Resolution is **most permissive wins**: the effective permissions are the union of what the role grants and what every group the user belongs to grants.

This also holds on a table that declares `rowLevelPermissions`. A group grant admits the member to the table exactly as a role grant does, and the row-level rule then narrows which rows they reach: a member of `ops` granted `read: ['group:ops']` on a table whose rule shows only northern rows reads the northern rows, and a southern one answers `404` as a missing record does.

Every door onto a table admits exactly the callers its records admit, through one set of roles: the account role, a `group:` entry per group, and — on a table with row-level rules, and only there — every role an assignment gives. That holds for the records themselves, the table's permission map, an upsert, the comment thread and a new comment, the MCP tools, a restore and a batch restore, the delete form and a record button. Groups and assignments are read on every request, so a membership or an assignment you withdraw stops counting on the caller's next request.

Groups earn their place at the field level — exposing a salary or budget column to a finance group while the rest of the table stays broadly readable. A role could express that only by creating a role per intersection, which is how a permission model becomes unmaintainable.

A field `read` grant naming a group opens the column to that group's members wherever records are read: the list, a single record, `filter`, `sort`, `groupBy` and `aggregate`, the `?q=` search, the record history, the record a write hands back, the table definition and its permission map. A caller in no group, or in another one, reads none of it, and a query naming the column answers `404` as for a column that does not exist.

A field's `write` audience is matched against the caller's role only. Name roles there: a `group:` entry in a field's `write` admits nobody but an admin, and the permission map reports that field as not writable.
