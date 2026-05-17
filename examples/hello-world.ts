/**
 * Example: TypeScript configuration file for Sovrium
 *
 * Usage:
 *   sovrium start examples/hello-world.ts
 *   sovrium validate examples/hello-world.ts
 *
 * For IDE autocompletion, install @sovrium/types:
 *   bun add -d @sovrium/types
 *
 * Then use defineConfig:
 *   import { defineConfig } from '@sovrium/types'
 *   export default defineConfig({ ... })
 */

const config = {
  name: 'task-tracker',
  version: '1.0.0',
  description: 'A simple task tracker built with Sovrium TypeScript config',

  auth: {
    strategies: [{ type: 'emailAndPassword' as const, minPasswordLength: 8 }],
  },

  tables: [
    {
      id: 1,
      name: 'projects',
      fields: [
        { id: 1, name: 'name', type: 'single-line-text' as const, required: true },
        { id: 2, name: 'description', type: 'long-text' as const },
        {
          id: 3,
          name: 'status',
          type: 'single-select' as const,
          options: ['Planning', 'Active', 'Completed', 'Archived'],
        },
        { id: 4, name: 'created_at', type: 'created-at' as const },
      ],
    },
    {
      id: 2,
      name: 'tasks',
      fields: [
        { id: 1, name: 'title', type: 'single-line-text' as const, required: true },
        {
          id: 2,
          name: 'priority',
          type: 'single-select' as const,
          options: ['Low', 'Medium', 'High', 'Urgent'],
        },
        {
          id: 3,
          name: 'project',
          type: 'relationship' as const,
          relatedTable: 'projects',
          relationType: 'many-to-one' as const,
        },
        { id: 4, name: 'assignee', type: 'user' as const },
        { id: 5, name: 'due_date', type: 'date' as const },
        { id: 6, name: 'done', type: 'checkbox' as const },
      ],
    },
  ],

  theme: {
    colors: {
      primary: '#6366f1',
      background: '#ffffff',
      text: '#1e293b',
    },
  },
}

export default config
