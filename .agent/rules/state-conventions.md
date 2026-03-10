---
description: State management conventions — automatically activated for hook and store files
globs: ["**/hooks/use*.ts", "**/hooks/use*.tsx", "**/stores/*.ts", "**/composables/*.ts"]
---

# State Management Rules

## Naming

- File name must match the exported function name
- Prefix with framework convention (`use` for React/Vue, service for Angular)
- Name should describe what data/behavior it provides, not implementation details

## Return Type

- Always define an explicit return type interface
- Return an object (easier to destructure selectively)
- Include loading, error, and data states when fetching

```typescript
interface UseCustomerReturn {
  customer: Customer | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}
```

## Error Handling

- Catch errors internally — never let them propagate unhandled
- Store error state and expose it to the consumer
- Log errors with context (function name, params)

## Dependencies

- Keep dependency tracking explicit — no lint suppression
- Extract stable references to avoid unnecessary re-computations
- Never call state hooks conditionally

## Structure

- One state function per file
- Co-locate in the feature's `hooks/` or `stores/` directory
- Shared state goes in `src/shared/hooks/` or `src/shared/stores/`
