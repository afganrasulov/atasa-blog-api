---
description: Ralph Wiggum detailed mode — analyze the user's request, create detailed TASKS.md, start the Ralph loop
---

// turbo-all

# Ralph Wiggum Detailed Mode

This workflow converts the user's request into a **detailed Ralph Wiggum template**.

## Steps

1. Read the Ralph Wiggum template (`view_file`): `.agent/skills/autonomous-loop/SKILL.md`

1. Read the Task Router (`view_file`): `.agent/skills/task-router/SKILL.md`

1. Check existing tasks (`view_file`): `TASKS.md`

1. Analyze the user's request and determine the template type:
   - New feature → 🔵 Feature Implementation template
   - Test-driven → 🧪 TDD Development template
   - Bug fix → 🔴 Bug Fixing template
   - Refactoring → 🟣 Refactoring template

1. Write a **detailed task** to `TASKS.md`. Each task should include:

```markdown
# TASKS.md — [Task Title]

## Task Info
- **Created:** [date]
- **Request:** [user's request]
- **Template:** [🔵/🧪/🔴/🟣] [template name]
- **Max Iterations:** [30/50/20/25]
- **Completion Promise:** <promise>COMPLETE</promise>

## Tasks

### Phase 1: [Data Layer / Preparation]
- [ ] [sub-task 1]
- [ ] [sub-task 2]

### Phase 2: [UI / Application]
- [ ] [sub-task 1]
- [ ] [sub-task 2]

### Phase 3: [Integration]
- [ ] [sub-task 1]

### Phase 4: [Quality]
- [ ] Write tests (coverage > 80%)
- [ ] Clean lint
- [ ] Build check

## Success Criteria
- [ ] [clear, measurable criterion 1]
- [ ] [clear, measurable criterion 2]
- [ ] Tests pass
- [ ] No lint errors
- [ ] Build successful

## Failure Plan
- If not resolved after 15 iterations:
  - Document blocking issues
  - List attempted approaches
  - Suggest alternatives
```

1. Show the created TASKS.md to the user and get approval.

2. If approved, start the Ralph loop:
   - Add a start note to `progress.txt`
   - Implement the task
   - Check quality gates after each phase (build, lint, test)
   - Run post-feature checks: read `.agent/workflows/after-feature.md` and apply
   - Move completed task to `completed-tasks.md`
   - If there's a next task, repeat
