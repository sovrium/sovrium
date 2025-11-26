/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@playwright/test'

test.fixme(
  'APP-ROLLUP-AGG-001: should calculate SUM rollup across related records',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_projects',
          name: 'projects',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            {
              id: 'fld_total_hours',
              name: 'total_hours',
              type: 'rollup',
              config: {
                relationshipField: 'fld_tasks',
                rollupField: 'fld_hours',
                aggregation: 'SUM',
              },
            },
          ],
        },
        {
          id: 'tbl_tasks',
          name: 'tasks',
          fields: [
            {
              id: 'fld_project',
              name: 'project',
              type: 'relationship',
              config: { linkedTableId: 'tbl_projects' },
            },
            { id: 'fld_hours', name: 'hours', type: 'decimal' },
          ],
        },
      ],
    })

    const projectResult = await executeQuery(`
      INSERT INTO projects (name) VALUES ('Website Redesign') RETURNING id
    `)
    const projectId = projectResult.id

    await executeQuery(
      `
      INSERT INTO tasks (project_id, hours) VALUES
      ($1, 8.5),
      ($1, 6.0),
      ($1, 12.25)
    `,
      [projectId]
    )

    const project = await executeQuery(`SELECT total_hours FROM projects WHERE id = $1`, [
      projectId,
    ])
    expect(project.total_hours).toBe('26.75')
  }
)

test.fixme(
  'APP-ROLLUP-AGG-002: should calculate COUNT rollup with filter condition',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_customers',
          name: 'customers',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            {
              id: 'fld_completed_orders',
              name: 'completed_orders',
              type: 'rollup',
              config: {
                relationshipField: 'fld_orders',
                rollupField: 'fld_id',
                aggregation: 'COUNT',
                filter: {
                  field: 'fld_status',
                  operator: 'is',
                  value: 'completed',
                },
              },
            },
          ],
        },
        {
          id: 'tbl_orders',
          name: 'orders',
          fields: [
            {
              id: 'fld_customer',
              name: 'customer',
              type: 'relationship',
              config: { linkedTableId: 'tbl_customers' },
            },
            {
              id: 'fld_status',
              name: 'status',
              type: 'single-select',
              config: {
                options: ['pending', 'completed', 'cancelled'],
              },
            },
          ],
        },
      ],
    })

    const customerResult = await executeQuery(`
      INSERT INTO customers (name) VALUES ('John Doe') RETURNING id
    `)
    const customerId = customerResult.id

    await executeQuery(
      `
      INSERT INTO orders (customer_id, status) VALUES
      ($1, 'completed'),
      ($1, 'pending'),
      ($1, 'completed'),
      ($1, 'cancelled')
    `,
      [customerId]
    )

    const customer = await executeQuery(`SELECT completed_orders FROM customers WHERE id = $1`, [
      customerId,
    ])
    expect(customer.completed_orders).toBe(2)
  }
)

test.fixme(
  'APP-ROLLUP-AGG-003: should calculate AVG rollup with decimal precision',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_courses',
          name: 'courses',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            {
              id: 'fld_avg_grade',
              name: 'average_grade',
              type: 'rollup',
              config: {
                relationshipField: 'fld_enrollments',
                rollupField: 'fld_grade',
                aggregation: 'AVG',
                precision: 2,
              },
            },
          ],
        },
        {
          id: 'tbl_enrollments',
          name: 'enrollments',
          fields: [
            {
              id: 'fld_course',
              name: 'course',
              type: 'relationship',
              config: { linkedTableId: 'tbl_courses' },
            },
            { id: 'fld_grade', name: 'grade', type: 'decimal' },
          ],
        },
      ],
    })

    const courseResult = await executeQuery(`
      INSERT INTO courses (name) VALUES ('Mathematics 101') RETURNING id
    `)
    const courseId = courseResult.id

    await executeQuery(
      `
      INSERT INTO enrollments (course_id, grade) VALUES
      ($1, 85.5),
      ($1, 92.0),
      ($1, 78.25)
    `,
      [courseId]
    )

    const course = await executeQuery(`SELECT average_grade FROM courses WHERE id = $1`, [courseId])
    expect(course.average_grade).toBe('85.25')
  }
)

test.fixme(
  'APP-ROLLUP-REGRESSION: rollup fields work correctly',
  { tag: '@regression' },
  async ({ startServerWithSchema, executeQuery }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_parents',
          name: 'parents',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            {
              id: 'fld_child_count',
              name: 'child_count',
              type: 'rollup',
              config: {
                relationshipField: 'fld_children',
                rollupField: 'fld_id',
                aggregation: 'COUNT',
              },
            },
          ],
        },
        {
          id: 'tbl_children',
          name: 'children',
          fields: [
            {
              id: 'fld_parent',
              name: 'parent',
              type: 'relationship',
              config: { linkedTableId: 'tbl_parents' },
            },
          ],
        },
      ],
    })

    const parentResult = await executeQuery(
      `INSERT INTO parents (name) VALUES ('Test Parent') RETURNING id`
    )
    await executeQuery(`INSERT INTO children (parent_id) VALUES ($1), ($1), ($1)`, [
      parentResult.id,
    ])

    const parent = await executeQuery(`SELECT child_count FROM parents`)
    expect(parent.child_count).toBe(3)
  }
)
