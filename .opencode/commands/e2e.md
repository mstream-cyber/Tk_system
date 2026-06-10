---
description: Generate and run E2E tests with Playwright
agent: e2e-runner
subtask: true
---

# E2E Command

Generate and run end-to-end tests using Playwright: $ARGUMENTS

## Your Task

1. **Analyze user flow** to test
2. **Create test journey** with Playwright
3. **Run tests** and capture artifacts
4. **Report results** with screenshots/videos

## Test Structure

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature: [Name]', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Navigate, authenticate
  })

  test('should [expected behavior]', async ({ page }) => {
    // Act: Perform user actions
    // Assert: Verify results
  })
})
```

## Best Practices
- Prefer `data-testid` attributes for selectors
- Use Playwright's auto-waiting
- Avoid `page.waitForTimeout()`
- Tests should be independent
- Screenshot on failure

## Artifacts to Capture
- Screenshots on failure
- Videos for debugging
- Trace files for detailed analysis

## Report Format
```
E2E Test Results
================
PASS: Passed: X
FAIL: Failed: Y
Artifacts: screenshots/, videos/
```

---

**TIP**: Run with `--headed` flag: `npx playwright test --headed`
