---
description: Comprehensive testing — unit tests, edge cases, coverage analysis
---

// turbo-all

## Comprehensive Test Run

Read the `deep-test` skill and follow its instructions:

1. Read the skill file (`view_file`): `.agent/skills/deep-test/SKILL.md`

1. Run existing tests and get a coverage report:

```bash
npm run test:unit:coverage
```

1. Analyze the coverage report — identify missing scenarios.

2. Write missing test scenarios (edge cases, error conditions, boundary tests).

3. Run the new tests and verify all pass:

```bash
npm run test:unit:run
```

1. Final coverage report:

```bash
npm run test:unit:coverage
```

1. Summarize results — previous and current coverage percentages, number of tests added.
