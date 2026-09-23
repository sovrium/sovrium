# Relationships & Foreign Keys

> Linking tables — the `relationship` field and its cardinalities, referential actions, reciprocal links, and the composite `foreignKeys` declaration for keys spanning several columns.

Tables connect through the `relationship` field, which creates a foreign-key link to another table. Once a relationship exists, `lookup`, `rollup` and `count` fields derive data through it without duplicating any values.

## Defining a relationship

```yaml
- id: 1
  name: customer
  type: relationship
  relatedTable: Customers
  relationType: many-to-one
  displayField: full_name
  onDelete: set-null
  onUpdate: cascade
  reciprocalField: orders
```

<!-- sovrium:options RelationshipFieldSchema -->

## Cardinalities

`relationType` sets the shape of the link and defaults to `many-to-one`.

| Cardinality    | Meaning                                                                       |
| -------------- | ----------------------------------------------------------------------------- |
| `one-to-one`   | Each record links to exactly one record, and the reverse holds                |
| `many-to-one`  | Many records here link to one record in the related table — the default       |
| `one-to-many`  | One record here links to many in the related table, using `foreignKey`        |
| `many-to-many` | Both sides link to many on the other; `allowMultiple` then defaults to `true` |

## Referential actions

`onDelete` and `onUpdate` say what happens to dependent rows when the related row is deleted or its key changes.

| Action      | Effect                                       |
| ----------- | -------------------------------------------- |
| `cascade`   | Propagate the delete or update to dependents |
| `set-null`  | Set the foreign key to NULL on dependents    |
| `restrict`  | Refuse the operation while dependents exist  |
| `no-action` | Defer the check and take no automatic action |

`restrict` is the conservative choice for a link whose loss would silently orphan money or history; `set-null` suits a link that is genuinely optional.

## Creating and capping links from the picker

A `relationship` column is a record picker wherever it is bound: a grid cell, a form, the grid's trailing add-row. Two properties shape what that picker may do.

`allowCreate` covers the case where the record you want to link does not exist yet. With it on, a search that matches nothing offers to create the record from exactly what was typed and link it in one step. The value is posted to the related table's `displayField` through the ordinary records endpoint, so every rule that table declares still applies; if the related table requires another column the picker cannot know, the create is refused and the blocking column is named.

The create affordance follows the same permission rule as the grid's own create button: a role that may not create records in the related table does not see a disabled option, it sees no option at all.

Inline create is offered in the grid today, in a cell and in the trailing add-row. A picker on a form links existing records and honours `maxLinked`, but does not yet offer to create one.

`maxLinked` caps a multi-valued picker. Once the cap is reached the search closes rather than offering candidates it would refuse, and the count reads how many of how many are linked. It is a rule and not a courtesy: a write arriving past the cap is refused by the API too, naming the field.

```yaml
- id: 2
  name: company
  type: relationship
  relatedTable: companies
  displayField: name
  allowCreate: true
- id: 3
  name: tags
  type: relationship
  relatedTable: tags
  relationType: many-to-many
  reciprocalField: posts
  displayField: name
  allowMultiple: true
  maxLinked: 5
```

## Composite foreign keys

A single-column foreign key is created for you from every `relationship` field. `foreignKeys` exists for the other case: a reference spanning **several columns at once**, pointing at a composite primary key in another table.

<!-- sovrium:options ForeignKeySchema -->

```yaml
foreignKeys:
  - name: fk_permissions_tenant_user
    fields: [tenant_id, user_id]
    referencedTable: tenant_users
    referencedFields: [tenant_id, user_id]
    onDelete: cascade
    onUpdate: cascade
```

## A worked example

An `Orders` table linked to `Customers`, exposing the customer's email through a lookup and a per-customer total through a rollup:

```yaml
tables:
  - id: 1
    name: Customers
    fields:
      - { id: 1, name: full_name, type: single-line-text, required: true }
      - { id: 2, name: email, type: email, unique: true }
  - id: 2
    name: Orders
    fields:
      - { id: 1, name: amount, type: currency, currency: USD, required: true }
      - id: 2
        name: customer
        type: relationship
        relatedTable: Customers
        relationType: many-to-one
        displayField: full_name
        onDelete: restrict
        reciprocalField: orders
      - {
          id: 3,
          name: customer_email,
          type: lookup,
          relationshipField: customer,
          relatedField: email,
        }
```

And on the `Customers` side, a rollup of order amounts through the reciprocal `orders` link:

```yaml
- {
    id: 3,
    name: lifetime_value,
    type: rollup,
    relationshipField: orders,
    relatedField: amount,
    aggregation: SUM,
    format: currency,
  }
```

`lookup`, `rollup` and `count` are checked when the configuration is decoded: the `relationshipField` each names must be an actual `relationship` field in the same table. A typo, or a reference to a field of another type, fails the decode with the path that is wrong.
