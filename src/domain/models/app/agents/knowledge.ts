/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


const KnowledgeTableFilterSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).pipe(
  Schema.annotations({
    identifier: 'KnowledgeTableFilter',
    title: 'Knowledge Table Filter',
    description: 'Key-value filter conditions for knowledge table rows',
  })
)


const KnowledgeTableSchema = Schema.Struct({
  table: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Table name to embed for knowledge retrieval',
    })
  ),

  fields: Schema.Array(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Field name to include in embedding' })
    )
  ).pipe(
    Schema.minItems(1),
    Schema.annotations({
      description: 'Fields to embed from this table',
    })
  ),

  filter: Schema.optional(KnowledgeTableFilterSchema),
}).pipe(
  Schema.annotations({
    identifier: 'KnowledgeTable',
    title: 'Knowledge Table',
    description: 'Table data source configuration for agent knowledge embedding',
  })
)

export type KnowledgeTable = Schema.Schema.Type<typeof KnowledgeTableSchema>


const KnowledgeDocumentSchema = Schema.Struct({
  path: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Path to the document file for knowledge embedding',
    })
  ),

  label: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({
        description: 'Human-readable label for the knowledge document',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'KnowledgeDocument',
    title: 'Knowledge Document',
    description: 'Document file data source for agent knowledge embedding',
  })
)

export type KnowledgeDocument = Schema.Schema.Type<typeof KnowledgeDocumentSchema>


export const AgentKnowledgeSchema = Schema.Struct({
  tables: Schema.optional(
    Schema.Array(KnowledgeTableSchema).pipe(
      Schema.annotations({
        description: 'Table data sources for knowledge embedding',
      })
    )
  ),

  documents: Schema.optional(
    Schema.Array(KnowledgeDocumentSchema).pipe(
      Schema.annotations({
        description: 'Document file sources for knowledge embedding',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'AgentKnowledge',
    title: 'Agent Knowledge',
    description:
      'Knowledge configuration defining what data sources to embed for RAG-based retrieval.',
  })
)

export type AgentKnowledge = Schema.Schema.Type<typeof AgentKnowledgeSchema>
