---
description: Fix build and TypeScript errors with minimal changes
agent: build-error-resolver
subtask: true
---

# Build Fix Command

Fix build and TypeScript errors with minimal changes: $ARGUMENTS

## Your Task

1. **Run type check**: `npx tsc --noEmit --pretty` in affected directory
2. **Collect all errors**
3. **Fix errors one by one** with minimal changes
4. **Verify each fix** doesn't introduce new errors
5. **Run final check** to confirm all errors resolved

## Approach

### DO:
- Fix type errors with correct types
- Add missing imports
- Fix syntax errors
- Make minimal changes
- Preserve existing behavior
- Run `tsc --noEmit` after each change

### DON'T:
- Refactor code
- Add new features
- Change architecture
- Use `any` type (unless absolutely necessary)
- Add `@ts-ignore` comments
- Change business logic

## Verification Steps

After fixes:
1. `npx tsc --noEmit` - should show 0 errors
2. `npm run build` - should succeed
3. `npm test` - tests should still pass

---

**IMPORTANT**: Focus on fixing errors only. No refactoring, no improvements. Get the build green with minimal diff.
