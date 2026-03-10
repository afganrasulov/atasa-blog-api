---
description: Automatic quality control chain after a feature is completed — lint, test, docs, swagger, qa
---

// turbo-all

## Post-Feature Automatic Check (Full Chain)

This workflow runs when a feature is completed. The entire team kicks in automatically and sequentially.

### Step 1: Lint and Build Check

```bash
npm run lint
npm run build
```

If there are errors, STOP and fix them first.

### Step 2: QA Sentinel — Live App Check

Read the `qa-sentinel` skill (`view_file`): `.agent/skills/qa-sentinel/SKILL.md`

- Audit 1: Console error scan
- Audit 2: Dead button / dead click scan
- Audit 5: Network error scan
- If issues found → fix and re-scan

### Step 3: Deep Test — Comprehensive Testing

Read the `deep-test` skill (`view_file`): `.agent/skills/deep-test/SKILL.md`

- Analyze current test coverage
- Write missing scenarios (edge cases, stress)
- Bring test coverage to 100%

### Step 4: Software Architect — Structure Audit

Read the `software-architect` skill (`view_file`): `.agent/skills/software-architect/SKILL.md`

- Check largest files (1000+ lines = refactoring candidate)
- Modularity check
- Refactor if needed

### Step 5: API Documentation (Conditional)

Check `package.json` scripts and run if available:

```bash
grep -q '"swagger"' package.json && npm run swagger
grep -q '"docs"' package.json && npm run docs
```

### Step 6: Doc Writer — Full Documentation

Read the `doc-writer` skill (`view_file`): `.agent/skills/doc-writer/SKILL.md`

- **Update feature README** → Scan the changed feature folder, create README.md if missing, update if exists
- Update CHANGELOG.md
- Update API docs if new API exists
- Update user guide

### Step 7: Final QA — Verification

Final check after all changes:

```bash
npm run lint
npm run build
```

Run a quick `qa-sentinel` scan (Console + Network).

**✅ If all steps pass, the feature is complete!**
