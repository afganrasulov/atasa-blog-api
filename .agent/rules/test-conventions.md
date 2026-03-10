---
description: Test conventions — automatically activated for test and spec files
globs: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"]
---

# Test Writing Rules

## Structure

- `describe` block: start with function/component name
- `it` block: write in "should..." format
- Each test should verify a single behavior

## Conventions

- Define mocks at the top of the file
- Create test data with factory functions
- Never make real API calls — always mock
- Clean up in `afterEach` (DOM, timers, mocks)

## Coverage

- Write happy path + error case + edge case
- Test reject scenarios for async functions
- Test boundary values (0, null, undefined, empty string, max value)

## Assertions

- Use specific assertions: `toEqual` > `toBeTruthy`
- Use `toBeGreaterThan`, `toBeLessThan` for number comparisons
- Check error messages with exact text matching
