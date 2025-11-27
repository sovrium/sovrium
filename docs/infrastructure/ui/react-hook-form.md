# React Hook Form

## Overview

**Version**: ^7.65.0 (minimum 7.65.0, allows patch/minor updates)
**Purpose**: Performant, flexible form management library for React with built-in validation support
**Scope**: Client-side only (Presentation layer)

## Why React Hook Form for Sovrium

- **Performance**: Minimizes re-renders using uncontrolled components
- **Developer Experience**: Simple API with minimal boilerplate
- **TypeScript Support**: Full type safety with inferred form types
- **Validation Integration**: Works seamlessly with Zod for client-side validation
- **shadcn/ui Integration**: Official form component from shadcn/ui uses React Hook Form
- **Small Bundle Size**: ~9KB minified + gzipped

## Core Concepts

### Uncontrolled Components

React Hook Form uses uncontrolled components (native form inputs) to avoid unnecessary re-renders:

```typescript
// ❌ CONTROLLED (causes re-render on every keystroke)
const [email, setEmail] = useState('')
<input value={email} onChange={(e) => setEmail(e.target.value)} />

// ✅ UNCONTROLLED with React Hook Form (no re-renders during typing)
const { register } = useForm()
<input {...register('email')} />
```

### Form State Management

React Hook Form manages form state internally and only triggers re-renders when necessary (e.g., validation errors, submission).

## Integration with Zod

**Critical**: In Sovrium, client-side validation uses Zod, NOT Effect Schema.

- **Client-side**: React Hook Form + Zod (browser validation)
- **Server-side**: Effect Schema (API validation)

### Why This Split?

1. **Zod** is lightweight and optimized for browser environments (9KB minified + gzipped)
2. **Effect Schema** is part of the Effect.ts ecosystem used on the server
3. Avoids bundling Effect.ts in client code (keeps bundle size small)
4. Each tool optimized for its environment
5. Zod integrates seamlessly with React Hook Form via `@hookform/resolvers`

### Architectural Decision: Where Zod is Allowed

**ESLint Enforcement** (eslint.config.ts lines 1096-1147):

Zod is **restricted** in most of `src/` to prevent architectural inconsistency. It's **only allowed** in:

| Location                                    | Purpose                   | Why Zod is Allowed            |
| ------------------------------------------- | ------------------------- | ----------------------------- |
| `src/presentation/api/schemas/*-schemas.ts` | OpenAPI API contracts     | OpenAPI tooling compatibility |
| `src/presentation/**/*.{ts,tsx}`            | Client forms + API routes | React Hook Form + Hono        |

**Key Points**:

- **Entire presentation layer** (`src/presentation/`) can use Zod
- This includes: components, hooks, API routes, OpenAPI schema
- **Everywhere else in `src/`**: Use Effect Schema (project standard)
- Domain (`src/domain/`), Application (`src/application/`), Infrastructure (`src/infrastructure/`) → Effect Schema

See `@docs/infrastructure/api/zod-hono-openapi.md` for complete Zod usage guidelines and ESLint enforcement details.

## Installation (Already Installed)

```bash
# Already in package.json
bun add react-hook-form  # ^7.65.0
bun add @hookform/resolvers  # Zod integration
bun add zod  # ^4.1.12
```

## Basic Usage with shadcn/ui Form Component

### 1. Define Zod Schema

```typescript
// src/presentation/components/LoginForm.tsx
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginFormValues = z.infer<typeof loginSchema>
```

### 2. Create Form with React Hook Form

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function LoginForm() {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: LoginFormValues) => {
    // Data is already validated by Zod at this point
    console.log('Valid data:', data)

    // Call server-side API (which will validate again with Effect Schema)
    const response = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Logging in...' : 'Log in'}
        </Button>
      </form>
    </Form>
  )
}
```

## Key React Hook Form Hooks

### useForm()

Main hook for creating form instance:

```typescript
const form = useForm<FormValues>({
  resolver: zodResolver(schema), // Zod validation
  defaultValues: {}, // Initial values
  mode: 'onSubmit', // When to validate
  reValidateMode: 'onChange', // When to revalidate after error
})
```

### Form State Access

```typescript
const {
  formState: {
    errors, // Validation errors
    isSubmitting, // True during async submit
    isDirty, // True if any field changed
    isValid, // True if no errors
    touchedFields, // Which fields were interacted with
  },
} = form
```

## Validation Modes

| Mode        | When Validation Runs      | Use Case                                           |
| ----------- | ------------------------- | -------------------------------------------------- |
| `onSubmit`  | On form submission only   | Default, best UX (no errors while typing)          |
| `onBlur`    | When field loses focus    | Show errors after user leaves field                |
| `onChange`  | On every keystroke        | Real-time validation (can be annoying)             |
| `onTouched` | After blur, then onChange | Best of both: no errors until blur, then real-time |

```typescript
// Recommended for Sovrium
const form = useForm({
  mode: 'onSubmit', // Don't show errors while typing
  reValidateMode: 'onChange', // After first submit, show errors in real-time
})
```

## Advanced Patterns

### Nested Objects

```typescript
const schema = z.object({
  user: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
  }),
  address: z.object({
    street: z.string(),
    city: z.string(),
  }),
})

// Access nested fields
<FormField
  name="user.firstName"
  control={form.control}
  render={({ field }) => <Input {...field} />}
/>
```

### Arrays (Dynamic Fields)

```typescript
import { useFieldArray } from 'react-hook-form'

const schema = z.object({
  tags: z.array(z.string().min(1)).min(1, 'At least one tag required'),
})

function TagsForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tags: [''] },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'tags',
  })

  return (
    <form>
      {fields.map((field, index) => (
        <div key={field.id}>
          <Input {...form.register(`tags.${index}`)} />
          <Button type="button" onClick={() => remove(index)}>
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" onClick={() => append('')}>
        Add Tag
      </Button>
    </form>
  )
}
```

### Dependent Fields

```typescript
import { useWatch } from 'react-hook-form'

function ShippingForm() {
  const form = useForm()

  // Watch a field to trigger conditional logic
  const sameAsBilling = useWatch({
    control: form.control,
    name: 'sameAsBilling',
  })

  return (
    <form>
      <FormField
        name="sameAsBilling"
        control={form.control}
        render={({ field }) => (
          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
        )}
      />

      {!sameAsBilling && (
        <FormField
          name="shippingAddress"
          control={form.control}
          render={({ field }) => <Input {...field} />}
        />
      )}
    </form>
  )
}
```

### Custom Validation

```typescript
const schema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'], // Show error on confirmPassword field
  })
```

## Error Handling

### Display Field Errors

```typescript
// Automatic via shadcn/ui FormMessage
<FormField
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage /> {/* Shows errors automatically */}
    </FormItem>
  )}
/>

// Manual error access
const emailError = form.formState.errors.email
{emailError && <span>{emailError.message}</span>}
```

### Server Errors

```typescript
const onSubmit = async (data: FormValues) => {
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()

      // Set server error on specific field
      form.setError('email', {
        type: 'server',
        message: error.message || 'Email already exists',
      })
      return
    }

    // Success
    toast.success('Account created!')
  } catch (error) {
    // Set general form error
    form.setError('root', {
      type: 'server',
      message: 'Something went wrong. Please try again.',
    })
  }
}

// Display root error
{form.formState.errors.root && (
  <div className="error">{form.formState.errors.root.message}</div>
)}
```

## Performance Tips

### Avoid Unnecessary Re-renders

```typescript
// ❌ BAD: Causes re-render on every keystroke
const { watch } = useForm()
const email = watch('email') // Re-renders component

// ✅ GOOD: Only re-render specific part
import { useWatch } from 'react-hook-form'
const email = useWatch({ name: 'email', control: form.control })

// ✅ BETTER: Get value only on submit (no re-renders)
const onSubmit = (data: FormValues) => {
  console.log(data.email) // Access email only when needed
}
```

### Optimize Large Forms

```typescript
// Use shouldUnregister for conditional fields
const form = useForm({
  shouldUnregister: true, // Remove field data when unmounted
})

// Use defaultValues to avoid undefined fields
const form = useForm({
  defaultValues: {
    email: '',
    password: '',
  },
})
```

## Integration with Server Actions (React 19)

```typescript
import { useActionState } from 'react'

function CreateUserForm() {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
  })

  const onSubmit = async (data: UserFormValues) => {
    // Client-side validation passed (Zod)

    // Call server action
    const result = await createUserAction(data)

    if (result.error) {
      // Server validation failed (Effect Schema)
      form.setError('root', {
        message: result.error.message,
      })
    } else {
      // Success
      form.reset()
      toast.success('User created!')
    }
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>
}
```

## Common Patterns in Sovrium

### Login Form

```typescript
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})
```

### Registration Form

```typescript
const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  })
```

### Settings Form

```typescript
const settingsSchema = z.object({
  displayName: z.string().min(2).max(50),
  bio: z.string().max(500).optional(),
  emailNotifications: z.boolean(),
  theme: z.enum(['light', 'dark', 'system']),
})
```

## Testing Forms

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginForm } from './LoginForm'

describe('LoginForm', () => {
  test('shows validation errors', async () => {
    render(<LoginForm />)

    const submitButton = screen.getByRole('button', { name: /log in/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument()
    })
  })

  test('submits valid data', async () => {
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    })

    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })
  })
})
```

## Debugging

```typescript
// Log form state
console.log('Form state:', form.formState)
console.log('Form values:', form.getValues())
console.log('Form errors:', form.formState.errors)

// Use React DevTools to inspect form state
<Form {...form}>
  <pre>{JSON.stringify(form.getValues(), null, 2)}</pre>
  <pre>{JSON.stringify(form.formState.errors, null, 2)}</pre>
</Form>
```

## Best Practices

1. **Always use Zod resolver** for validation (never manual validation)
2. **Set default values** to avoid undefined fields
3. **Use TypeScript** with `z.infer<typeof schema>` for type safety
4. **Use shadcn/ui Form components** for consistent UI
5. **Mode: onSubmit** for best UX (validate on submit, then onChange)
6. **Handle server errors** with `setError()` for field-specific errors
7. **Reset form** after successful submission with `form.reset()`
8. **Test forms** with React Testing Library

## Common Mistakes

### ❌ Not using defaultValues

```typescript
// BAD: Fields are undefined initially
const form = useForm<FormValues>({
  resolver: zodResolver(schema),
})

// GOOD: Fields have initial values
const form = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues: {
    email: '',
    password: '',
  },
})
```

### ❌ Watching all fields unnecessarily

```typescript
// BAD: Re-renders on every field change
const values = form.watch()

// GOOD: Only watch specific field
const email = useWatch({ name: 'email', control: form.control })
```

### ❌ Mixing controlled and uncontrolled

```typescript
// BAD: Don't use useState with React Hook Form
const [email, setEmail] = useState('')
<Input value={email} {...register('email')} /> // Conflict!

// GOOD: Let React Hook Form manage state
<Input {...register('email')} />
```

## Related Documentation

- `@docs/infrastructure/api/zod-hono-openapi.md` - Zod usage for server API models and OpenAPI
- `@docs/infrastructure/framework/effect.md` - Effect Schema for server-side validation
- `@docs/infrastructure/ui/shadcn.md` - shadcn/ui components (Form component)
- `@docs/architecture/layer-based-architecture.md` - Layer separation and where to use Zod

## References

- React Hook Form docs: https://react-hook-form.com/
- Zod documentation: https://zod.dev/
- shadcn/ui Form component: https://ui.shadcn.com/docs/components/form
- @hookform/resolvers: https://github.com/react-hook-form/resolvers
