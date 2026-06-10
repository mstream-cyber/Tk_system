---
description: Enforce TDD workflow with 80%+ coverage
agent: tdd-guide
subtask: true
---

# TDD Command

Implement the following using strict test-driven development: $ARGUMENTS

## TDD Cycle (MANDATORY)

```
RED → GREEN → REFACTOR → REPEAT
```

1. **RED**: Write a failing test FIRST
2. **GREEN**: Write minimal code to pass the test
3. **REFACTOR**: Improve code while keeping tests green
4. **REPEAT**: Continue until feature complete

## Your Task

### Step 1: Define Interfaces (SCAFFOLD)
- Define TypeScript interfaces for inputs/outputs
- Create function signature with `throw new Error('Not implemented')`

### Step 2: Write Failing Tests (RED)
- Write tests that exercise the interface
- Include happy path, edge cases, and error conditions
- Run tests - verify they FAIL

### Step 3: Implement Minimal Code (GREEN)
- Write just enough code to make tests pass
- No premature optimization
- Run tests - verify they PASS

### Step 4: Refactor (IMPROVE)
- Extract constants, improve naming
- Remove duplication
- Run tests - verify they still PASS

## Coverage Requirements
- Standard code: 80%
- Payment/booking logic: 100%
- Authentication: 100%

---

**MANDATORY**: Tests must be written BEFORE implementation. Never skip the RED phase.
