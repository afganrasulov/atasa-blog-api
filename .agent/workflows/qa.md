---
description: QA Sentinel — application quality control, console errors, dead buttons, missing implementations
---

// turbo-all

## QA Sentinel Audit

Read the `qa-sentinel` skill and follow its instructions:

1. Read the skill file (`view_file`): `.agent/skills/qa-sentinel/SKILL.md`

1. Start the dev server:

```bash
npm run dev
```

1. Visit all pages in the browser, check for console errors, detect dead buttons, find functions without database connections.

2. List all issues found and fix them where possible.

3. After fixes, run lint and type-check:

```bash
npm run lint
```

1. Summarize results — how many pages scanned, how many issues found, how many fixed.
