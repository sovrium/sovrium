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

Groups earn their place at the field level — exposing a salary or budget column to a finance group while the rest of the table stays broadly readable. A role could express that only by creating a role per intersection, which is how a permission model becomes unmaintainable.
