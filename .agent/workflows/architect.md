---
description: Software Architect — code structure audit, refactoring, modularity analysis
---

// turbo-all

## Architecture Audit

Read the `software-architect` skill and follow its instructions:

1. Read the skill file (`view_file`): `.agent/skills/software-architect/SKILL.md`

1. Analyze project structure:

```bash
find src -type d -maxdepth 3 | head -60
```

1. Detect large files (500+ lines):

```bash
find src -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20
```

1. Detect duplicated code.

2. Check SOLID principles:
   - Single Responsibility
   - Open/Closed
   - Liskov Substitution
   - Interface Segregation
   - Dependency Inversion

3. Apply necessary refactoring.

4. Lint and type-check:

```bash
npm run lint
```

1. Summarize results — which files were refactored, what changed.
