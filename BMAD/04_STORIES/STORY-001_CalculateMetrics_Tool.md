# STORY-001: Create calculateMetrics Tool

**Priority:** P0 - Critical
**Story Points:** 5
**Sprint:** Phase 1, Week 1
**Dependencies:** None
**Assigned To:** Developer Agent

---

## User Story

**As an** Operations Manager
**I want to** calculate aggregated metrics (count, sum, average, etc.) without writing SQL
**So that** I can quickly analyze data and make informed decisions

---

## Acceptance Criteria

### Functional Requirements
- [ ] Tool accepts tableName, metric type, column, groupBy, filters
- [ ] Supports metrics: count, sum, avg, min, max, distinct
- [ ] Returns formatted results with summary statistics
- [ ] Handles GROUP BY aggregations correctly
- [ ] Applies WHERE filters before aggregation
- [ ] Orders results appropriately
- [ ] Limits results to prevent overwhelming responses

### Non-Functional Requirements
- [ ] Executes in <2 seconds for tables with 10K+ rows
- [ ] Handles errors gracefully with clear messages
- [ ] Validates table and column names exist
- [ ] Prevents SQL injection
- [ ] Logs execution time and results count

### Edge Cases
- [ ] Handles empty tables (returns 0/null appropriately)
- [ ] Handles NULL values in aggregations
- [ ] Handles division by zero for averages
- [ ] Handles invalid column names
- [ ] Handles unsupported metric types

---

## Technical Specification

### File Location
```
src/mastra/tools/analytics.tool.ts
```

### Input Schema
```typescript
{
  tableName: string,              // Required: table to query
  metric: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct',
  column?: string,                // Required for sum/avg/min/max
  groupBy?: string,               // Optional: column to group by
  filters?: Array<{               // Optional: WHERE conditions
    column: string,
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE',
    value: any
  }>,
  orderBy?: 'asc' | 'desc',      // Optional: sort order
  limit?: number                  // Default: 100
}
```

### Output Schema
```typescript
{
  success: boolean,
  results: Array<Record<string, any>>,  // Query results
  summary: {
    totalRecords: number,
    calculationTime: number,      // milliseconds
    metricApplied: string,
    aggregatedValue?: number      // if single value
  },
  message: string
}
```

### Implementation Details

#### 1. Validation Function
```typescript
function validateCalculateMetricsInput(input: any): void {
  // Check table exists
  const validTables = await getValidTableNames();
  if (!validTables.includes(input.tableName)) {
    throw new AgentError(
      'INVALID_TABLE',
      `Table '${input.tableName}' does not exist`,
      `The table '${input.tableName}' was not found. Use listTables to see available tables.`,
      'error',
      false
    );
  }

  // Check column exists (if provided)
  if (input.column) {
    const columns = await getTableColumns(input.tableName);
    if (!columns.includes(input.column)) {
      throw new AgentError(
        'INVALID_COLUMN',
        `Column '${input.column}' does not exist in table '${input.tableName}'`,
        `The column '${input.column}' was not found. Use getTableSchema to see available columns.`,
        'error',
        false
      );
    }
  }

  // Validate metric requires column
  if (['sum', 'avg', 'min', 'max'].includes(input.metric) && !input.column) {
    throw new AgentError(
      'MISSING_COLUMN',
      `Metric '${input.metric}' requires a column parameter`,
      `Please specify which column to calculate ${input.metric} for.`,
      'error',
      false
    );
  }
}
```

#### 2. Query Builder Function
```typescript
function buildMetricQuery(input: CalculateMetricsInput): string {
  let query = 'SELECT ';

  // Build SELECT clause
  if (input.groupBy) {
    query += `"${input.groupBy}", `;
  }

  switch (input.metric) {
    case 'count':
      query += input.column
        ? `COUNT("${input.column}") as count`
        : `COUNT(*) as count`;
      break;
    case 'sum':
      query += `SUM("${input.column}") as sum`;
      break;
    case 'avg':
      query += `AVG("${input.column}") as avg`;
      break;
    case 'min':
      query += `MIN("${input.column}") as min`;
      break;
    case 'max':
      query += `MAX("${input.column}") as max`;
      break;
    case 'distinct':
      query += `COUNT(DISTINCT "${input.column}") as distinct_count`;
      break;
  }

  // FROM clause
  query += ` FROM "${input.tableName}"`;

  // WHERE clause
  if (input.filters && input.filters.length > 0) {
    const conditions = input.filters.map(f =>
      `"${f.column}" ${f.operator} ${sanitizeValue(f.value)}`
    );
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  // GROUP BY clause
  if (input.groupBy) {
    query += ` GROUP BY "${input.groupBy}"`;
  }

  // ORDER BY clause
  if (input.orderBy) {
    const orderCol = input.groupBy || input.metric;
    query += ` ORDER BY ${orderCol} ${input.orderBy.toUpperCase()}`;
  }

  // LIMIT clause
  query += ` LIMIT ${input.limit || 100}`;

  return query;
}
```

#### 3. Main Execution Function
```typescript
export const calculateMetricsTool = createTool({
  id: "calculate-metrics",
  description: "Calculate aggregated metrics (count, sum, avg, min, max, etc.)",
  inputSchema: z.object({
    tableName: z.string(),
    metric: z.enum(['count', 'sum', 'avg', 'min', 'max', 'distinct']),
    column: z.string().optional(),
    groupBy: z.string().optional(),
    filters: z.array(z.object({
      column: z.string(),
      operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'LIKE']),
      value: z.any()
    })).optional(),
    orderBy: z.enum(['asc', 'desc']).optional(),
    limit: z.number().optional().default(100)
  }),
  outputSchema: z.object({
    success: z.boolean(),
    results: z.array(z.record(z.any())),
    summary: z.object({
      totalRecords: z.number(),
      calculationTime: z.number(),
      metricApplied: z.string(),
      aggregatedValue: z.number().optional()
    }),
    message: z.string()
  }),
  execute: async ({ context }) => {
    const startTime = Date.now();

    try {
      // 1. Validate input
      await validateCalculateMetricsInput(context);

      // 2. Build query
      const query = buildMetricQuery(context);

      // 3. Execute query
      const result = await sql.query(query);

      // 4. Calculate summary
      const calculationTime = Date.now() - startTime;
      const aggregatedValue = result.rows.length === 1 && !context.groupBy
        ? Object.values(result.rows[0])[0] as number
        : undefined;

      // 5. Log query
      await logQuery({
        tool: 'calculateMetrics',
        query,
        tableName: context.tableName,
        executionTime: calculationTime,
        rowsReturned: result.rows.length,
        success: true
      });

      return {
        success: true,
        results: result.rows as Array<Record<string, any>>,
        summary: {
          totalRecords: result.rows.length,
          calculationTime,
          metricApplied: context.metric,
          aggregatedValue
        },
        message: aggregatedValue !== undefined
          ? `Calculated ${context.metric} = ${aggregatedValue} from ${context.tableName}`
          : `Calculated ${context.metric} across ${result.rows.length} groups from ${context.tableName}`
      };

    } catch (error) {
      const calculationTime = Date.now() - startTime;

      // Log error
      await logQuery({
        tool: 'calculateMetrics',
        tableName: context.tableName,
        executionTime: calculationTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return user-friendly error
      if (error instanceof AgentError) {
        throw error;
      }

      throw new AgentError(
        'CALCULATION_ERROR',
        error instanceof Error ? error.message : String(error),
        'Failed to calculate metrics. Please check your parameters and try again.',
        'error',
        true,  // retryable
        { input: context }
      );
    }
  }
});
```

#### 4. Helper Functions
```typescript
function sanitizeValue(value: any): string {
  if (typeof value === 'string') {
    // Escape single quotes and wrap in quotes
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  // For dates, arrays, etc.
  return `'${String(value)}'`;
}

async function getValidTableNames(): Promise<string[]> {
  const result = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `;
  return result.map(row => row.table_name);
}

async function getTableColumns(tableName: string): Promise<string[]> {
  const result = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = ${tableName}
  `;
  return result.map(row => row.column_name);
}

async function logQuery(log: QueryLog): Promise<void> {
  // Implement query logging (could be to database, file, or external service)
  console.log('[QUERY LOG]', {
    timestamp: new Date().toISOString(),
    ...log
  });
}
```

---

## Testing Plan

### Unit Tests

```typescript
// tests/unit/analytics.tool.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { calculateMetricsTool } from '../../src/mastra/tools/analytics.tool';

describe('calculateMetrics Tool', () => {
  describe('Count metric', () => {
    it('should count all rows in table', async () => {
      const result = await calculateMetricsTool.execute({
        context: {
          tableName: 'staff',
          metric: 'count'
        }
      });

      expect(result.success).toBe(true);
      expect(result.summary.metricApplied).toBe('count');
      expect(result.summary.aggregatedValue).toBeGreaterThan(0);
    });

    it('should count with filter', async () => {
      const result = await calculateMetricsTool.execute({
        context: {
          tableName: 'staff',
          metric: 'count',
          filters: [{
            column: 'is_active',
            operator: '=',
            value: true
          }]
        }
      });

      expect(result.success).toBe(true);
      expect(result.summary.aggregatedValue).toBeDefined();
    });

    it('should count with groupBy', async () => {
      const result = await calculateMetricsTool.execute({
        context: {
          tableName: 'drops',
          metric: 'count',
          groupBy: 'contractor_id'
        }
      });

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0]).toHaveProperty('contractor_id');
      expect(result.results[0]).toHaveProperty('count');
    });
  });

  describe('Average metric', () => {
    it('should calculate average', async () => {
      const result = await calculateMetricsTool.execute({
        context: {
          tableName: 'staff',
          metric: 'avg',
          column: 'years_experience'
        }
      });

      expect(result.success).toBe(true);
      expect(result.summary.aggregatedValue).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should reject invalid table name', async () => {
      await expect(
        calculateMetricsTool.execute({
          context: {
            tableName: 'invalid_table_xyz',
            metric: 'count'
          }
        })
      ).rejects.toThrow('Table \'invalid_table_xyz\' does not exist');
    });

    it('should reject avg without column', async () => {
      await expect(
        calculateMetricsTool.execute({
          context: {
            tableName: 'staff',
            metric: 'avg'
            // missing column
          }
        })
      ).rejects.toThrow('requires a column parameter');
    });

    it('should handle empty table gracefully', async () => {
      const result = await calculateMetricsTool.execute({
        context: {
          tableName: 'empty_table',  // assuming this exists but is empty
          metric: 'count'
        }
      });

      expect(result.success).toBe(true);
      expect(result.summary.aggregatedValue).toBe(0);
    });
  });
});
```

### Integration Tests

```typescript
// tests/integration/agent-analytics.test.ts
describe('Agent with calculateMetrics', () => {
  it('should use calculateMetrics for "how many" questions', async () => {
    const response = await agent.generate({
      messages: [{
        role: 'user',
        content: 'How many staff members do we have?'
      }]
    });

    const toolCalls = response.steps[0].toolCalls;
    expect(toolCalls).toContainEqual(
      expect.objectContaining({
        toolName: 'calculateMetrics',
        args: expect.objectContaining({
          tableName: 'staff',
          metric: 'count'
        })
      })
    );

    expect(response.text).toMatch(/\d+ staff/i);
  });

  it('should use calculateMetrics for averages', async () => {
    const response = await agent.generate({
      messages: [{
        role: 'user',
        content: 'What is the average experience of our staff?'
      }]
    });

    expect(response.steps.some(step =>
      step.toolCalls?.some(tc =>
        tc.toolName === 'calculateMetrics' &&
        tc.args.metric === 'avg'
      )
    )).toBe(true);
  });
});
```

---

## Definition of Done

- [ ] Code implemented and follows architecture design
- [ ] All unit tests passing (>90% coverage)
- [ ] All integration tests passing
- [ ] Tool registered in agent configuration
- [ ] Error handling tested with edge cases
- [ ] Performance tested (executes in <2s for 10K rows)
- [ ] Code reviewed by peer
- [ ] Documentation updated (inline comments + README)
- [ ] Deployed to dev environment
- [ ] Manual testing completed
- [ ] Agent instructions updated to reference new tool

---

## Dependencies & Packages

```json
{
  "dependencies": {
    "@mastra/core": "^0.17.5",
    "@neondatabase/serverless": "^1.0.2",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@types/node": "^24.9.1"
  }
}
```

---

## Example Usage

### Agent Conversation
```
User: How many contractors do we have?

Agent: Let me check that for you.
[calls calculateMetrics tool]

Agent: We currently have 18 contractors in the system.

User: How many are active?

Agent: Let me filter by active status.
[calls calculateMetrics with filter]

Agent: Of the 18 contractors, 15 are currently active.
```

### Direct Tool Call
```bash
curl -X POST 'http://72.61.166.168:8080/api/agents/velocityfibreDbAgentGrok/generate' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [{
      "role": "user",
      "content": "Calculate the total number of installations per contractor"
    }]
  }'
```

---

## Notes for Developer

- Follow existing code style in `velocityfibre-db.tool.ts`
- Reuse `sql` connection from existing tools
- Add comprehensive error messages (they're shown to users!)
- Log all queries for performance monitoring
- Test with real VelocityFibre data
- Consider adding query caching in future iteration
- Document all public functions with JSDoc comments

---

## Story Status

**Status:** Ready for Development
**Blockers:** None
**Estimated Completion:** 1-2 days
