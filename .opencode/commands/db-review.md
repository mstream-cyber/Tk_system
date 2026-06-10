---
description: Review database schema, indexes, migrations, queries
agent: database-reviewer
subtask: true
---

# Database Review Command

Review the database schema, migrations, or query patterns: $ARGUMENTS

## Your Task

1. **Review migration files** in supabase/migrations/
2. **Check schema design** (data types, constraints, indexes)
3. **Analyze queries** in server/src/routes/ for performance
4. **Generate report** with findings and recommendations

## Review Areas

### Schema Design
- Proper data types (bigint, numeric, timestamptz, text)
- CHECK constraints on enum columns
- Foreign key indexes
- NOT NULL on required fields

### Migration Quality
- Reversible migrations
- Idempotent creation (IF NOT EXISTS)
- Proper RLS setup after table creation

### Query Performance
- All WHERE/JOIN columns indexed
- No N+1 patterns
- Composite indexes in correct column order
- Optimistic locking for inventory

## Report Format

### Issues Found
[Schema, indexing, or query issues]

### Recommendations
[Specific improvements with SQL examples]

### Approved
[✓ if no critical issues]

---

**TIP**: Check supabase/migrations/ for latest schema state.
