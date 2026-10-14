/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/design-system/specimen-graph` — the
 * catalogue's platform fixture GRAPH.
 *
 * ─── WHY A SIBLING OF THE SPECIMEN ROWS, NOT A SHAPE OF THEM ───────────────
 *
 * `graph` and `matrix` read a GRAPH — two collections that address each other
 * by id — through a read endpoint (`dataSource.system`, `nodesKey` /
 * `edgesKey`). The specimen rows are one flat collection, so neither type could
 * be drawn on its console page. A `?shape=` switch on the rows endpoint would
 * have made one path answer two unrelated bodies, which an OpenAPI document
 * can only describe as a union nobody can tell apart from the request; a
 * sibling path keeps each body one closed schema.
 *
 * ─── PLATFORM FIXTURE CONTENT, LIKE THE ROWS ──────────────────────────────
 *
 * The graph is built from the people of the specimen rows: it names no table,
 * reads no database, and is identical on every instance, so a drawing of it
 * documents the component rather than the operator's configuration (the same
 * bound the rows answer to). Three node kinds and three edge kinds, so a
 * column, a band, a shape per kind and a glyph per cell all have something
 * distinct to draw:
 *
 *  - `person`  — a specimen person; `team` — one of the three specimen
 *    categories; `project` — a piece of work a team owns.
 *  - `member`  — a person stands in a team; `owns` — a team owns a project;
 *    `access` — a person may act on a project, with the letters of `ops`.
 *
 * The referential invariant — every `edges[].from` and `edges[].to` names a
 * `nodes[].id` — cannot be expressed by a schema and is asserted by the E2E
 * spec that reads the endpoint.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/** A node or edge identifier: non-empty, unique within its collection. */
const specimenGraphId = (description: string) =>
  Schema.String.annotate({ description }).pipe(Schema.check(Schema.isMinLength(1)))

/** What a fixture node is. Closed: the fixture draws exactly these three. */
const specimenGraphNodeKindSchema = Schema.Literals(['person', 'team', 'project']).annotate({
  description:
    'What the node is: a `person` of the specimen rows, a `team` (one of the three specimen categories) or a `project` a team owns.',
})

/** What a fixture edge means. Closed, like the node kinds. */
const specimenGraphEdgeKindSchema = Schema.Literals(['member', 'owns', 'access']).annotate({
  description:
    'What the edge means: a person is a `member` of a team, a team `owns` a project, a person has `access` to a project.',
})

/** One fixture node. */
const specimenGraphNodeSchema = Schema.Struct({
  id: specimenGraphId(
    'Stable identifier of the node, unique within `nodes`. Every `edges[].from` and `edges[].to` names one of these.'
  ),
  kind: specimenGraphNodeKindSchema,
  label: Schema.String.annotate({
    description: 'The name the drawing writes on the node — a person, a team or a project.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  family: optionalField(
    Schema.String.annotate({
      description:
        'The specimen category the node belongs to (`Discovery`, `Delivery` or `Support`), so a column or an axis can be banded by it.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  level: optionalField(
    Schema.Int.annotate({
      description:
        'A rank on `team` nodes, higher first, so a column or an axis can be ordered by it. Absent on every other kind.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
  ),
  state: optionalField(
    Schema.Literals(['active', 'paused', 'disabled']).annotate({
      description:
        'The operational state the drawing weighs a node by — all three appear, so each weight is drawn.',
    })
  ),
  detail: optionalField(
    Schema.String.annotate({
      description: 'One short line under the label, such as a person’s role.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'SpecimenGraphNode',
})

/** One fixture edge. */
const specimenGraphEdgeSchema = Schema.Struct({
  id: specimenGraphId('Stable identifier of the edge, unique within `edges`.'),
  from: specimenGraphId('The `nodes[].id` the edge starts at.'),
  to: specimenGraphId('The `nodes[].id` the edge ends at.'),
  kind: specimenGraphEdgeKindSchema,
  ops: optionalField(
    Schema.String.annotate({
      description:
        'What an `access` edge permits, as letters of the closed alphabet `RCUDWAI` (`R` read, `C` create, `U` update, `D` delete, `W` write, `AI` an AI-access grant), so a matrix cell has letters to draw. Present on `access` edges only.',
    }).pipe(
      Schema.check(
        Schema.makeFilter((value: string) =>
          /^[RCUDWAI]+$/.test(value) ? undefined : 'one or more letters of the alphabet RCUDWAI'
        )
      )
    )
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'SpecimenGraphEdge',
})

/**
 * Response schema for `GET /api/admin/design-system/specimen-graph`.
 */
export const specimenGraphResponseSchema = Schema.Struct({
  nodes: Schema.Array(specimenGraphNodeSchema).annotate({
    description: 'Every node of the fixture graph — people, teams and projects.',
  }),
  edges: Schema.Array(specimenGraphEdgeSchema).annotate({
    description: 'Every edge of the fixture graph; each one names two of the `nodes`.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'SpecimenGraphResponse',
})

/** @public */
export type SpecimenGraphResponse = typeof specimenGraphResponseSchema.Type
