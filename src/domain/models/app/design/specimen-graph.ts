/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The specimen fixture as a GRAPH: its people, the three teams they belong to
 * and the projects those teams own, with the edges between them.
 *
 * ─── WHY A GRAPH BESIDE THE ROWS ───────────────────────────────────────────
 *
 * `graph` and `matrix` read two collections that address each other by id, so
 * a flat list of rows gives them nothing to lay out. This is the same platform
 * content as {@link specimenRows} — it names no table and reads no database —
 * re-read as nodes and edges, so a drawing of it documents the component and
 * never the operator's configuration.
 *
 * ─── EVERY KIND, EVERY STATE, EVERY CELL READING ───────────────────────────
 *
 * Three node kinds and three edge kinds, so a column, a band and a shape per
 * kind each have something distinct to draw. A person's state follows its row
 * status (`active` or `paused`), and one project is `disabled`, so all three
 * weights a node can carry appear. Each person reaches one project of their
 * team, every fourth person a second one, and the `access` letters cycle, so a
 * matrix crossing people with projects holds populated cells, empty cells and
 * several distinct glyphs.
 */

import type { SpecimenRow } from './specimen-fixture'

/** One node of the fixture graph. */
export interface SpecimenGraphNode {
  readonly id: string
  readonly kind: 'person' | 'team' | 'project'
  readonly label: string
  readonly family?: string
  readonly level?: number
  readonly state?: 'active' | 'paused' | 'disabled'
  readonly detail?: string
}

/** One edge of the fixture graph. */
export interface SpecimenGraphEdge {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly kind: 'member' | 'owns' | 'access'
  readonly ops?: string
}

/** The fixture graph, as the endpoint serves it. */
export interface SpecimenGraph {
  readonly nodes: readonly SpecimenGraphNode[]
  readonly edges: readonly SpecimenGraphEdge[]
}

/** The three teams, one per specimen `category`, highest rank first. */
const TEAMS = [
  { family: 'Discovery', level: 3 },
  { family: 'Delivery', level: 2 },
  { family: 'Support', level: 1 },
] as const

/** Two projects per team, in team order. One is disabled, one paused. */
const PROJECTS: readonly {
  readonly label: string
  readonly family: string
  readonly state: 'active' | 'paused' | 'disabled'
}[] = [
  { label: 'Intake funnel', family: 'Discovery', state: 'active' },
  { label: 'Search index', family: 'Discovery', state: 'paused' },
  { label: 'Billing exports', family: 'Delivery', state: 'active' },
  { label: 'Build graph', family: 'Delivery', state: 'active' },
  { label: 'Routing tables', family: 'Support', state: 'active' },
  { label: 'Event log', family: 'Support', state: 'disabled' },
]

/** The letters an `access` edge carries, cycled over the people. */
const OPS = ['R', 'RU', 'RCU', 'RCUD', 'RW', 'RAI'] as const

const slug = (label: string): string => label.toLowerCase().replaceAll(' ', '-')
const teamId = (family: string): string => `team-${slug(family)}`
const projectId = (label: string): string => `project-${slug(label)}`

/** The projects a team owns, in authored order. */
const projectsOf = (family: string) => PROJECTS.filter((project) => project.family === family)

/**
 * Build the fixture graph from the fixture rows.
 *
 * Reads only the rows' identity, name, role, category and status, none of
 * which depend on the date the rows were built for, so the graph is the same
 * on every read.
 */
export function specimenGraph(rows: readonly SpecimenRow[]): SpecimenGraph {
  const people = rows.map((row) => ({
    id: String(row['id']),
    label: String(row['name']),
    family: String(row['category']),
    detail: String(row['role']),
    state: row['status'] === 'Paused' ? ('paused' as const) : ('active' as const),
  }))

  const personNodes = people.map((person): SpecimenGraphNode => ({ ...person, kind: 'person' }))
  const teamNodes = TEAMS.map((team): SpecimenGraphNode => ({
    id: teamId(team.family),
    kind: 'team',
    label: team.family,
    family: team.family,
    level: team.level,
    state: 'active',
  }))
  const projectNodes = PROJECTS.map((project): SpecimenGraphNode => ({
    id: projectId(project.label),
    kind: 'project',
    label: project.label,
    family: project.family,
    state: project.state,
  }))

  const memberEdges = people.map((person): SpecimenGraphEdge => ({
    id: `member-${person.id}`,
    from: person.id,
    to: teamId(person.family),
    kind: 'member',
  }))
  const ownsEdges = PROJECTS.map((project): SpecimenGraphEdge => ({
    id: `owns-${slug(project.label)}`,
    from: teamId(project.family),
    to: projectId(project.label),
    kind: 'owns',
  }))
  const accessEdges = people.flatMap((person, index): readonly SpecimenGraphEdge[] => {
    const owned = projectsOf(person.family)
    const reached = index % 4 === 0 ? owned : owned.slice(index % 2, (index % 2) + 1)
    return reached.map((project, offset) => ({
      id: `access-${person.id}-${slug(project.label)}`,
      from: person.id,
      to: projectId(project.label),
      kind: 'access',
      ops: OPS[(index + offset) % OPS.length] ?? 'R',
    }))
  })

  return {
    nodes: [...personNodes, ...teamNodes, ...projectNodes],
    edges: [...memberEdges, ...ownsEdges, ...accessEdges],
  }
}
