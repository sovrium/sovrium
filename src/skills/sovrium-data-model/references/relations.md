# Relations

## Contents

- Say it as a sentence first
- The four cardinalities
- Which side holds the link
- Reading through a link: lookup, rollup, count
- Delete and update behaviour
- Worked example
- Checks

Manual: `sovrium docs tables/table-relationships` and `sovrium docs fields/relational-fields`. Every option: `sovrium docs config tables[].fields[].relationType` and its siblings.

## Say it as a sentence first

Write each relation as two sentences, one from each side, before touching the config:

- "A company **has many** contacts. A contact **works at one** company."
- "A deal **includes many** products. A product **appears in many** deals."

If either sentence sounds wrong, the cardinality is wrong. If you cannot write the second sentence, you may not need a relation at all.

## The four cardinalities

| Sentence pair                       | `relationType`              | Typical example                         |
| ----------------------------------- | --------------------------- | --------------------------------------- |
| Many of these point at one of those | `many-to-one` (the default) | Order → customer                        |
| One of these has many of those      | `one-to-many`               | Customer → orders, read from the parent |
| Many to many                        | `many-to-many`              | Deal ↔ product, article ↔ tag           |
| Exactly one each way                | `one-to-one`                | User ↔ profile                          |

A many-to-many that needs data about the pairing itself (quantity, unit price, role on a project) is a table of its own — `deal_lines` with a link to the deal and a link to the product — not a many-to-many field.

## Which side holds the link

- For many-to-one, declare the `relationship` field on the "many" side: `orders.customer`. The foreign key lives on the child.
- A `one-to-many` field on the parent names the child's link in `foreignKey`; it reads the children rather than storing anything new.
- `reciprocalField` names the field on the other table when you want the relation visible from both sides.
- `displayField` names the field people recognise the related record by (`name`, `title`, `email`). Pick a short, unique one.
- `allowMultiple` and `maxLinked` bound how many records one field may link to.

## Reading through a link: lookup, rollup, count

Never copy a value across a link. Read it.

| You want                             | Field type                       | Reads                                         |
| ------------------------------------ | -------------------------------- | --------------------------------------------- |
| The customer's city on the order     | `lookup`                         | One field of the related record, at read time |
| The order total from its lines       | `rollup` with `aggregation: sum` | Many related records, aggregated              |
| How many open tickets a customer has | `count`                          | The number of related records                 |

A lookup and a rollup are read-only by construction: the value lives on the other table. Soft-deleted related rows do not count toward a rollup.

What an empty set yields differs: `avg`, `min`, `max` give null; `sum` and `count` give `0`. A page showing several rollups side by side should not treat a blank as zero.

**One hop.** Derive from a direct relation. When you need a value two tables away (the country of the company of the contact on a deal), put a lookup on the middle table (contact → company country), then look that up from the deal. Each step stays inspectable.

## Delete and update behaviour

`onDelete` and `onUpdate` decide what happens to linking rows when the related record changes. Decide explicitly:

| Choice     | Use when                                                                            |
| ---------- | ----------------------------------------------------------------------------------- |
| `cascade`  | The child means nothing without the parent (order lines of an order)                |
| `set-null` | The child survives and the link becomes empty (a task whose assignee left)          |
| `restrict` | Deleting the parent must be refused while children exist (a customer with invoices) |

Remember that ordinary deletes in Sovrium are soft: a trashed parent can be restored. A `restrict` policy blocking a delete answers `400`.

## Worked example

"A company has many contacts. A contact works at one company. A contact owns many deals. A deal includes many products, each with a quantity."

```yaml
tables:
  - id: 1
    name: companies
    fields:
      - { id: 1, name: name, label: Name, type: single-line-text, required: true, unique: true }
      - { id: 2, name: city, label: City, type: single-line-text }
  - id: 2
    name: contacts
    fields:
      - { id: 1, name: full_name, label: Name, type: single-line-text, required: true }
      - { id: 2, name: email, label: Email, type: email, unique: true }
      - {
          id: 3,
          name: company,
          label: Company,
          type: relationship,
          relatedTable: companies,
          relationType: many-to-one,
          displayField: name,
          onDelete: set-null,
        }
      - {
          id: 4,
          name: company_city,
          label: City,
          type: lookup,
          relationshipField: company,
          relatedField: city,
        }
  - id: 3
    name: deals
    fields:
      - { id: 1, name: title, label: Deal, type: single-line-text, required: true }
      - {
          id: 2,
          name: owner,
          label: Owner,
          type: relationship,
          relatedTable: contacts,
          displayField: full_name,
        }
  - id: 4
    name: deal_lines
    fields:
      - {
          id: 1,
          name: deal,
          label: Deal,
          type: relationship,
          relatedTable: deals,
          displayField: title,
          onDelete: cascade,
        }
      - {
          id: 2,
          name: product,
          label: Product,
          type: relationship,
          relatedTable: products,
          displayField: name,
          onDelete: restrict,
        }
      - { id: 3, name: quantity, label: Quantity, type: integer, required: true }
```

Check every option against `sovrium docs config <path>` before you rely on it; the manual shipped in the binary is the authority.

## Checks

```
- [ ] Each relation has its two sentences written down
- [ ] No copied values across a link (lookup, rollup or count instead)
- [ ] Pairings that carry data are their own table
- [ ] onDelete chosen for every relationship
- [ ] displayField is short and recognisable
- [ ] sovrium validate passes; the related record's name shows on a record page in the browser
```
