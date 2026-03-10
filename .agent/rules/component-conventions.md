---
description: UI component conventions — automatically activated for component files
globs: ["**/*.tsx", "**/*.vue", "**/*.svelte"]
---

# UI Component Rules

## Structure

- Separate client-side and server-side components based on framework conventions
- Define Props interface/type at the top of the component file
- Prefer named export over default export

## Naming

- Component files: PascalCase (`CustomerTable.tsx`, `UserCard.vue`)
- Utility files: camelCase (`formatDate.ts`)
- Type files: feature-scoped (`types/index.ts`)

## Performance

- Memoize expensive computations
- Optimize event handlers to prevent unnecessary re-renders
- Lazy-load heavy components when possible

## Accessibility

- Add `aria-label` or meaningful text to all interactive elements
- Use proper label-input associations on form elements
- Specify button types (`type="button"` or `type="submit"`)

## State Management

- Co-locate state as close to usage as possible
- Lift state up only when sharing between siblings
- Use framework-appropriate state management patterns
