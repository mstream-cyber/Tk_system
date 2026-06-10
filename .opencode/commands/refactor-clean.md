---
description: Remove dead code and consolidate duplicates
agent: refactor-cleaner
subtask: true
---

# Refactor Clean Command

Analyze and clean up the codebase: $ARGUMENTS

## Your Task

1. **Detect dead code** using analysis tools
2. **Identify duplicates** and consolidation opportunities
3. **Safely remove** unused code
4. **Verify** no functionality broken

## Detection Phase

### Run Analysis Tools
```bash
# Find unused exports (server)
cd server && npx ts-prune

# Find unused exports (client)
cd client && npx knip

# Check unused deps
cd client && npx depcheck
cd server && npx depcheck
```

### Manual Checks
- Unused functions (no callers)
- Unused variables/imports
- Commented-out code
- Unreachable code

## Removal Phase

### Before Removing
1. Search for usage - grep, find references
2. Check exports - might be used externally
3. Verify tests - no test depends on it

### Safe Removal Order
1. Remove unused imports first
2. Remove unused private functions
3. Remove unused exported functions
4. Remove unused types/interfaces
5. Remove unused files

## Verification
After cleanup:
1. `npx tsc --noEmit` - type check passes
2. `npm run build` - builds successfully
3. `npm test` - all tests pass

## Report Format
```
Dead Code Analysis
==================
Removed:
- file.ts: functionName (unused export)
- utils.ts: unused import

Consolidated:
- formatDate() and formatDateTime() → dateUtils.format()
```

---

**CAUTION**: Always verify before removing. When in doubt, ask.
