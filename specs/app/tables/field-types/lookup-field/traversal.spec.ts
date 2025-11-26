/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@playwright/test'

test.fixme(
  'APP-LOOKUP-TRAV-001: should lookup values through relationship chain',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: three related tables (projects → customers → regions)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_regions',
          name: 'regions',
          fields: [
            { id: 'fld_region_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_tax_rate', name: 'tax_rate', type: 'percentage' },
          ],
        },
        {
          id: 'tbl_customers',
          name: 'customers',
          fields: [
            { id: 'fld_customer_name', name: 'name', type: 'single-line-text' },
            {
              id: 'fld_region',
              name: 'region',
              type: 'relationship',
              config: { linkedTableId: 'tbl_regions' },
            },
            {
              id: 'fld_region_name_lookup',
              name: 'region_name',
              type: 'lookup',
              config: {
                relationshipField: 'fld_region',
                lookupField: 'fld_region_name',
              },
            },
          ],
        },
        {
          id: 'tbl_projects',
          name: 'projects',
          fields: [
            { id: 'fld_project_name', name: 'name', type: 'single-line-text' },
            {
              id: 'fld_customer',
              name: 'customer',
              type: 'relationship',
              config: { linkedTableId: 'tbl_customers' },
            },
            {
              id: 'fld_customer_region',
              name: 'customer_region',
              type: 'lookup',
              config: {
                relationshipField: 'fld_customer',
                lookupField: 'fld_region_name_lookup',
              },
            },
          ],
        },
      ],
    })

    const regionResult = await executeQuery(
      `INSERT INTO regions (name, tax_rate) VALUES ('Europe', 0.20) RETURNING id`
    )
    const regionId = regionResult.id

    const customerResult = await executeQuery(
      `INSERT INTO customers (name, region_id) VALUES ('Acme Corp', $1) RETURNING id`,
      [regionId]
    )
    const customerId = customerResult.id

    await executeQuery(`INSERT INTO projects (name, customer_id) VALUES ('Website Redesign', $1)`, [
      customerId,
    ])

    // WHEN: querying project with chained lookup
    const project = await executeQuery(`SELECT name, customer_region FROM projects`)

    // THEN: lookup traverses relationships correctly
    expect(project.name).toBe('Website Redesign')
    expect(project.customer_region).toBe('Europe')
  }
)

test.fixme(
  'APP-LOOKUP-TRAV-002: should handle NULL in lookup chain gracefully',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: lookup chain with NULL relationship
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_departments',
          name: 'departments',
          fields: [{ id: 'fld_dept_name', name: 'name', type: 'single-line-text' }],
        },
        {
          id: 'tbl_employees',
          name: 'employees',
          fields: [
            { id: 'fld_emp_name', name: 'name', type: 'single-line-text' },
            {
              id: 'fld_department',
              name: 'department',
              type: 'relationship',
              config: { linkedTableId: 'tbl_departments', required: false },
            },
            {
              id: 'fld_dept_lookup',
              name: 'department_name',
              type: 'lookup',
              config: {
                relationshipField: 'fld_department',
                lookupField: 'fld_dept_name',
              },
            },
          ],
        },
      ],
    })

    await executeQuery(
      `INSERT INTO employees (name, department_id) VALUES ('John Doe', NULL), ('Jane Smith', NULL)`
    )

    // WHEN: querying employees with NULL department
    const employees = await executeQuery(`SELECT name, department_name FROM employees`)

    // THEN: lookup returns NULL gracefully
    expect(employees).toHaveLength(2)
    expect(employees.every((e) => e.department_name === null)).toBe(true)
  }
)

test.fixme(
  'APP-LOOKUP-REGRESSION: lookup fields work correctly',
  { tag: '@regression' },
  async ({ startServerWithSchema, executeQuery }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_categories',
          name: 'categories',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
        {
          id: 'tbl_products',
          name: 'products',
          fields: [
            { id: 'fld_product_name', name: 'name', type: 'single-line-text' },
            {
              id: 'fld_category',
              name: 'category',
              type: 'relationship',
              config: { linkedTableId: 'tbl_categories' },
            },
            {
              id: 'fld_category_name',
              name: 'category_name',
              type: 'lookup',
              config: {
                relationshipField: 'fld_category',
                lookupField: 'fld_name',
              },
            },
          ],
        },
      ],
    })

    const categoryResult = await executeQuery(
      `INSERT INTO categories (name) VALUES ('Electronics') RETURNING id`
    )
    await executeQuery(`INSERT INTO products (name, category_id) VALUES ('Laptop', $1)`, [
      categoryResult.id,
    ])

    const product = await executeQuery(`SELECT category_name FROM products`)
    expect(product.category_name).toBe('Electronics')
  }
)
