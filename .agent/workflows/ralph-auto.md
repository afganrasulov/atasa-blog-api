---
description: Ralph Wiggum autonomous mode — create detailed TASKS.md and start immediately without approval
---

// turbo-all

# Ralph Wiggum Autonomous Mode (No Approval)

Same as `/ralph` but **starts immediately without asking the user**. Ideal for tasks left to run overnight.

## Steps

1. Read the Ralph Wiggum template (`view_file`): `.agent/skills/autonomous-loop/SKILL.md`

1. Read the Task Router (`view_file`): `.agent/skills/task-router/SKILL.md`

1. Check existing tasks (`view_file`): `TASKS.md`

1. Analyze the user's request and determine the template type:
   - New feature → 🔵 Feature Implementation
   - Test-driven → 🧪 TDD Development
   - Bug fix → 🔴 Bug Fixing
   - Refactoring → 🟣 Refactoring

1. Write a detailed task to `TASKS.md` (phases, success criteria, failure plan, completion promise included).

1. **DO NOT ASK FOR APPROVAL — START IMMEDIATELY.**

1. Add a start note to `progress.txt` and implement the task.

1. Check quality gates after each phase:

```bash
npm run build
```

```bash
npm run lint
```

1. Run post-feature checks: read `.agent/workflows/after-feature.md` and apply.

2. Move completed task to `completed-tasks.md`.

3. If there's a next task, go back to step 3. Otherwise, write the completion signal.
