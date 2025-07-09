---
description: "Conventional Commit"
allowed-tools: ["Bash(git:add,commit)"]
---

# Conventional Commit Helper

This command creates git commits following the Conventional Commits specification.

## Process

1. Organize current changes
2. Stage appropriate files  
3. Create git commit in Conventional Commit format

### Commit Types:
- **feat** - New feature addition
- **fix** - Bug fix
- **docs** - Documentation only changes
- **style** - Changes that don't affect code behavior (whitespace, formatting, etc.)
- **refactor** - Code changes that neither fix bugs nor add features
- **test** - Adding tests or fixing existing tests
- **chore** - Changes to build process, tools, or libraries
- **build** - Changes affecting build system or external dependencies
- **ci** - Changes to CI configuration files or scripts
- **perf** - Performance improvements

### Format:
```
<type>: <description>

Ask: [Content requested by user]

Response: [Details of work actually performed]

Comment: [optional thoughts or supplementary information about the work]

[optional footer]
```
※ Scope is not required for this project

Please write the description in English.

For breaking changes, add `!` after the type or include `BREAKING CHANGE:` in the footer.

Do not add Claude co-author footer to commits.

```commit
feat: add phone call cancel button

Ask: I want to add a cancel button to the phone feature

Response:
Implemented cancel button in ../../packages/mobile/app/call.tsx.
Also adjusted margins accordingly
```
