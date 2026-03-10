---
description: Feature Scout — detect missing features and suggest improvements
---

// turbo-all

## Feature Scout Analysis

Read the `feature-scout` skill and follow its instructions:

1. Read the skill file (`view_file`): `.agent/skills/feature-scout/SKILL.md`

1. Analyze project structure:

```bash
find src/features -type d -maxdepth 1 | sort
```

1. List existing pages:

```bash
find src/app -name "page.tsx" | sort
```

1. List API routes:

```bash
find src/app/api -name "route.ts" | sort
```

1. Visit all pages in the browser to analyze user flows.

2. Create a missing feature list by comparing with competitor apps.

3. For each missing feature:
   - Priority level (P0-P3)
   - Estimated effort
   - Dependencies
   - Short description

4. Summarize results and add to TASKS.md.
