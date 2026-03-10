# Autonomous Development Team

This project has an autonomous development team.
Skills: `.agent/skills/` | Workflows: `.agent/workflows/` | Rules: `.agent/rules/`

## First Contact Protocol

Every new conversation MUST start with project discovery:

1. **Detect project type** by checking for config files (first match wins):
   - `package.json` → Node.js / JavaScript / TypeScript
   - `Package.swift` or `*.xcodeproj` → Swift / iOS / macOS
   - `manifest.json` (with `manifest_version`) → Chrome Extension
   - `pyproject.toml` or `requirements.txt` → Python
   - `go.mod` → Go
   - `Cargo.toml` → Rust
   - `Makefile` only → C/C++ or custom build
2. Read project structure → detect source directories
3. Check `TASKS.md` → is there ongoing work?
4. Check `progress.txt` → what was done last?

**Never assume tools, frameworks, or build commands — discover them.**

## Autonomy Directives

### Self-Healing

- Build breaks → fix immediately, do not ask the user
- Lint errors → fix immediately, do not ask the user
- Type errors from your own changes → fix immediately

### Completeness

- Never leave `TODO`, `FIXME`, or placeholder comments in code
- If you cannot complete something → stop and report, do not leave stubs
- Every new page/view requires: **loading state + error state + empty state**
- Every data fetch requires: **error handling + loading indicator**

### Quality Gates (Non-Negotiable)

- Before every commit: project's **lint + build** commands must pass
  - Node.js: `npm run lint && npm run build`
  - Swift: `xcodebuild build` (or `swift build`)
  - Chrome Extension: `web-ext lint` (if installed)
  - Python: `ruff check .` or `flake8` (if installed)
  - Go: `go vet ./...` and `go build ./...`
  - Fallback: if no lint/build tool found, skip but warn
- After every feature: run `/after-feature` workflow chain
- Move completed tasks from `TASKS.md` → `completed-tasks.md`
- Update `progress.txt` after each phase

### Decision Framework

- **Can fix without breaking anything** → fix, don't ask
- **Might break existing functionality** → ask with numbered options
- **Delete/destroy operation** → always ask
- **Design/UX judgment call** → ask with visual options
- **15 iterations without progress** → stop, document blockers, report

## Team Activation

Every user request → `task-router` (Raju) → correct skill chain.
Full team structure and chains → `.agent/skills/team-handbook/SKILL.md`

### Quick Commands

- `/go` or `/raju` → Raju analyzes and routes
- `/ralph` → Autonomous loop with approval
- `/ralph-auto` → Autonomous loop, starts immediately
- `/after-feature` → Post-feature quality chain
- `/qa` → Quality scan
- `/test` → Comprehensive testing
- `/design` → UI/UX improvement
- `/architect` → Code structure audit
- `/docs` → Documentation generation
- `/scout` → Missing feature detection

## Project-Agnostic Rules

This team works on **any project, any platform**. Stack-specific behavior is discovered at runtime:

| Project Type | Config File | Build Command | Lint Command |
|-------------|------------|---------------|-------------|
| Node.js | `package.json` | `npm run build` | `npm run lint` |
| Swift/iOS | `Package.swift` / `.xcodeproj` | `xcodebuild build` | `swiftlint` |
| Chrome Extension | `manifest.json` | `web-ext build` | `web-ext lint` |
| Python | `pyproject.toml` | `python -m build` | `ruff check .` |
| Go | `go.mod` | `go build ./...` | `go vet ./...` |
| Rust | `Cargo.toml` | `cargo build` | `cargo clippy` |

- Installed tools → detected from project config / dependencies
- Port → detected from `.env`, config files, or running processes

**Do not hardcode project-specific values. Always discover dynamically.**
