# STORY-002: Create compareData Tool

**Priority:** P0 - Critical
**Story Points:** 5
**Sprint:** Phase 1, Week 1
**Dependencies:** STORY-001 (shares validation logic)
**Assigned To:** Developer Agent

---

## User Story

**As an** Operations Manager
**I want to** compare metrics between time periods or entities
**So that** I can identify trends and performance changes

---

## Acceptance Criteria

### Functional Requirements
- [ ] Compare data between two groups with different filters
- [ ] Support time-based comparisons (this week vs last week)
- [ ] Support entity-based comparisons (contractor A vs B)
- [ ] Calculate absolute difference
- [ ] Calculate percentage change
- [ ] Determine trend direction (up/down/stable)
- [ ] Generate human-readable insights

### Non-Functional Requirements
- [ ] Executes in <3 seconds for 10K+ rows
- [ ] Handles division by zero gracefully
- [ ] Provides meaningful insights automatically
- [ ] Validates both comparison groups exist

### Edge Cases
- [ ] Handle zero values in baseline (prevent div/0)
- [ ] Handle NULL values in comparisons
- [ ] Handle empty result sets
- [ ] Handle identical values (0% change)
- [ ] Handle negative values correctly

---

## Technical Specification

### File Location
```
src/mastra/tools/analytics.tool.ts
```

### Input Schema
```typescript
{
  tableName: string,
  metric: string,                 // column to compare
  compareBy: 'time' | 'entity' | 'status',
  group1: {
    label: string,                // "This Week", "Contractor A"
    filters: Array<{
      column: string,
      operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE',
      value: any
    }>
  },
  group2: {
    label: string,                // "Last Week", "Contractor B"
    filters: Array<{
      column: string,
      operator: string,
      value: any
    }>
  },
  aggregation?: 'count' | 'sum' | 'avg'  // Default: count
}
```

### Output Schema
```typescript
{
  success: boolean,
  comparison: {
    group1: {
      label: string,
      value: number,
      rowCount: number
    },
    group2: {
      label: string,
      value: number,
      rowCount: number
    },
    difference: number,           // group1 - group2
    percentChange: number,        // ((g1-g2)/g2) * 100
    trend: 'up' | 'down' | 'stable',
    insight: string              // Auto-generated explanation
  },
  executionTime: number,
  message: string
}
```

### Implementation

```typescript
export const compareDataTool = createTool({
  id: "compare-data",
  description: "Compare metrics between two groups or time periods",
  inputSchema: z.object({
    tableName: z.string(),
    metric: z.string(),
    compareBy: z.enum(['time', 'entity', 'status']),
    group1: z.object({
      label: z.string(),
      filters: z.array(z.object({
        column: z.string(),
        operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'LIKE']),
        value: z.any()
      }))
    }),
    group2: z.object({
      label: z.string(),
      filters: z.array(z.object({
        column: z.string(),
        operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'LIKE']),
        value: z.any()
      }))
    }),
    aggregation: z.enum(['count', 'sum', 'avg']).optional().default('count')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    comparison: z.object({
      group1: z.object({
        label: z.string(),
        value: z.number(),
        rowCount: z.number()
      }),
      group2: z.object({
        label: z.string(),
        value: z.number(),
        rowCount: z.number()
      }),
      difference: z.number(),
      percentChange: z.number(),
      trend: z.enum(['up', 'down', 'stable']),
      insight: z.string()
    }),
    executionTime: z.number(),
    message: z.string()
  }),
  execute: async ({ context }) => {
    const startTime = Date.now();

    try {
      // Validate input
      await validateTableAndColumn(context.tableName, context.metric);

      // Build and execute query for group 1
      const query1 = buildComparisonQuery(
        context.tableName,
        context.metric,
        context.aggregation,
        context.group1.filters
      );
      const result1 = await sql.query(query1);

      // Build and execute query for group 2
      const query2 = buildComparisonQuery(
        context.tableName,
        context.metric,
        context.aggregation,
        context.group2.filters
      );
      const result2 = await sql.query(query2);

      // Extract values
      const value1 = extractValue(result1.rows, context.aggregation);
      const value2 = extractValue(result2.rows, context.aggregation);

      // Calculate comparison metrics
      const difference = value1 - value2;
      const percentChange = value2 === 0
        ? (value1 > 0 ? 100 : 0)  // Handle division by zero
        : ((value1 - value2) / value2) * 100;

      // Determine trend
      const trend = determineTrend(difference, percentChange);

      // Generate insight
      const insight = generateInsight(
        context.group1.label,
        context.group2.label,
        value1,
        value2,
        difference,
        percentChange,
        trend,
        context.compareBy
      );

      const executionTime = Date.now() - startTime;

      // Log comparison
      await logQuery({
        tool: 'compareData',
        tableName: context.tableName,
        executionTime,
        success: true
      });

      return {
        success: true,
        comparison: {
          group1: {
            label: context.group1.label,
            value: value1,
            rowCount: result1.rows.length
          },
          group2: {
            label: context.group2.label,
            value: value2,
            rowCount: result2.rows.length
          },
          difference,
          percentChange: Math.round(percentChange * 10) / 10, // 1 decimal
          trend,
          insight
        },
        executionTime,
        message: `Compared ${context.group1.label} (${value1}) vs ${context.group2.label} (${value2})`
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      await logQuery({
        tool: 'compareData',
        tableName: context.tableName,
        executionTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof AgentError) {
        throw error;
      }

      throw new AgentError(
        'COMPARISON_ERROR',
        error instanceof Error ? error.message : String(error),
        'Failed to compare data. Please check your filters and try again.',
        'error',
        true,
        { input: context }
      );
    }
  }
});

// Helper Functions

function buildComparisonQuery(
  tableName: string,
  metric: string,
  aggregation: string,
  filters: Array<any>
): string {
  let query = 'SELECT ';

  // Build aggregation
  switch (aggregation) {
    case 'count':
      query += `COUNT(*) as value`;
      break;
    case 'sum':
      query += `SUM("${metric}") as value`;
      break;
    case 'avg':
      query += `AVG("${metric}") as value`;
      break;
  }

  query += ` FROM "${tableName}"`;

  // Add WHERE clause
  if (filters && filters.length > 0) {
    const conditions = filters.map(f =>
      `"${f.column}" ${f.operator} ${sanitizeValue(f.value)}`
    );
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  return query;
}

function extractValue(rows: any[], aggregation: string): number {
  if (rows.length === 0) return 0;
  const value = rows[0].value;
  return value === null ? 0 : Number(value);
}

function determineTrend(
  difference: number,
  percentChange: number
): 'up' | 'down' | 'stable' {
  // Consider stable if change is within ±2%
  if (Math.abs(percentChange) < 2) {
    return 'stable';
  }
  return difference > 0 ? 'up' : 'down';
}

function generateInsight(
  label1: string,
  label2: string,
  value1: number,
  value2: number,
  difference: number,
  percentChange: number,
  trend: 'up' | 'down' | 'stable',
  compareBy: string
): string {
  const absDiff = Math.abs(difference);
  const absPercent = Math.abs(percentChange);
  const direction = difference > 0 ? 'increased' : 'decreased';

  if (trend === 'stable') {
    return `${label1} (${value1}) is stable compared to ${label2} (${value2}), with only a ${absPercent.toFixed(1)}% change.`;
  }

  if (compareBy === 'time') {
    return `${label1} shows ${value1}, which ${direction} by ${absDiff} (${absPercent.toFixed(1)}%) compared to ${label2}. This represents a ${trend === 'up' ? 'positive' : 'negative'} trend.`;
  }

  if (compareBy === 'entity') {
    const better = difference > 0 ? label1 : label2;
    return `${better} is performing better with ${direction === 'increased' ? 'higher' : 'lower'} metrics. ${label1} (${value1}) vs ${label2} (${value2}) - a difference of ${absPercent.toFixed(1)}%.`;
  }

  return `${label1} (${value1}) ${direction} by ${absDiff} (${absPercent.toFixed(1)}%) compared to ${label2} (${value2}).`;
}
```

---

## Testing Plan

### Unit Tests

```typescript
describe('compareData Tool', () => {
  describe('Time-based comparison', () => {
    it('should compare this week vs last week', async () => {
      const result = await compareDataTool.execute({
        context: {
          tableName: 'drops',
          metric: 'installation_count',
          compareBy: 'time',
          group1: {
            label: 'This Week',
            filters: [{
              column: 'created_at',
              operator: '>=',
              value: '2025-10-21'
            }]
          },
          group2: {
            label: 'Last Week',
            filters: [{
              column: 'created_at',
              operator: '>=',
              value: '2025-10-14'
            }, {
              column: 'created_at',
              operator: '<',
              value: '2025-10-21'
            }]
          },
          aggregation: 'count'
        }
      });

      expect(result.success).toBe(true);
      expect(result.comparison.group1.label).toBe('This Week');
      expect(result.comparison.group2.label).toBe('Last Week');
      expect(result.comparison.difference).toBeDefined();
      expect(result.comparison.percentChange).toBeDefined();
      expect(['up', 'down', 'stable']).toContain(result.comparison.trend);
      expect(result.comparison.insight).toContain('compared to');
    });
  });

  describe('Entity-based comparison', () => {
    it('should compare two contractors', async () => {
      const result = await compareDataTool.execute({
        context: {
          tableName: 'drops',
          metric: 'installation_count',
          compareBy: 'entity',
          group1: {
            label: 'Contractor A',
            filters: [{ column: 'contractor_id', operator: '=', value: 1 }]
          },
          group2: {
            label: 'Contractor B',
            filters: [{ column: 'contractor_id', operator: '=', value: 2 }]
          },
          aggregation: 'sum'
        }
      });

      expect(result.success).toBe(true);
      expect(result.comparison.insight).toContain('performing');
    });
  });

  describe('Edge cases', () => {
    it('should handle division by zero', async () => {
      const result = await compareDataTool.execute({
        context: {
          tableName: 'drops',
          metric: 'count',
          compareBy: 'time',
          group1: {
            label: 'Current',
            filters: [{ column: 'status', operator: '=', value: 'active' }]
          },
          group2: {
            label: 'Previous',
            filters: [{ column: 'status', operator: '=', value: 'nonexistent' }]
          },
          aggregation: 'count'
        }
      });

      expect(result.success).toBe(true);
      expect(result.comparison.group2.value).toBe(0);
      expect(result.comparison.percentChange).toBe(100); // or 0 depending on logic
    });

    it('should identify stable trend', async () => {
      // Mock data where values are nearly identical
      const result = await compareDataTool.execute({
        context: {
          tableName: 'staff',
          metric: 'count',
          compareBy: 'time',
          group1: {
            label: 'Current',
            filters: [{ column: 'is_active', operator: '=', value: true }]
          },
          group2: {
            label: 'Previous',
            filters: [{ column: 'is_active', operator: '=', value: true }]
          },
          aggregation: 'count'
        }
      });

      // If values are within 2%, should be stable
      if (Math.abs(result.comparison.percentChange) < 2) {
        expect(result.comparison.trend).toBe('stable');
      }
    });
  });
});
```

### Integration Tests

```typescript
describe('Agent with compareData', () => {
  it('should compare time periods when asked', async () => {
    const response = await agent.generate({
      messages: [{
        role: 'user',
        content: 'How do installations this week compare to last week?'
      }]
    });

    expect(response.steps.some(step =>
      step.toolCalls?.some(tc => tc.toolName === 'compareData')
    )).toBe(true);

    expect(response.text).toMatch(/(increased|decreased|stable)/i);
    expect(response.text).toMatch(/\d+%/); // percentage mentioned
  });

  it('should compare contractors when asked', async () => {
    const response = await agent.generate({
      messages: [{
        role: 'user',
        content: 'Compare the performance of our top two contractors'
      }]
    });

    expect(response.text).toMatch(/(better|higher|lower)/i);
    expect(response.text).toContain('vs');
  });
});
```

---

## Example Usage

### Time Comparison
```typescript
{
  tableName: 'drops',
  metric: 'installation_count',
  compareBy: 'time',
  group1: {
    label: 'October 2025',
    filters: [
      { column: 'created_at', operator: '>=', value: '2025-10-01' },
      { column: 'created_at', operator: '<', value: '2025-11-01' }
    ]
  },
  group2: {
    label: 'September 2025',
    filters: [
      { column: 'created_at', operator: '>=', value: '2025-09-01' },
      { column: 'created_at', operator: '<', value: '2025-10-01' }
    ]
  },
  aggregation: 'sum'
}
```

**Expected Output:**
```typescript
{
  success: true,
  comparison: {
    group1: { label: 'October 2025', value: 245, rowCount: 245 },
    group2: { label: 'September 2025', value: 198, rowCount: 198 },
    difference: 47,
    percentChange: 23.7,
    trend: 'up',
    insight: 'October 2025 shows 245, which increased by 47 (23.7%) compared to September 2025. This represents a positive trend.'
  },
  executionTime: 1234,
  message: 'Compared October 2025 (245) vs September 2025 (198)'
}
```

### Contractor Comparison
```typescript
{
  tableName: 'drops',
  metric: 'completion_time_hours',
  compareBy: 'entity',
  group1: {
    label: 'Top Contractor',
    filters: [{ column: 'contractor_id', operator: '=', value: 5 }]
  },
  group2: {
    label: 'Average Contractor',
    filters: [{ column: 'contractor_id', operator: '!=', value: 5 }]
  },
  aggregation: 'avg'
}
```

---

## Definition of Done

- [ ] Code implemented following STORY-001 pattern
- [ ] All unit tests passing (10+ tests)
- [ ] Integration tests with agent passing
- [ ] Handles edge cases (div/0, nulls, empty sets)
- [ ] Performance: <3s for 10K rows
- [ ] Insights are meaningful and grammatical
- [ ] Tool registered in agent
- [ ] Documentation complete
- [ ] Code reviewed
- [ ] Deployed to dev
- [ ] Manual testing with real data

---

## Notes for Developer

- Reuse validation logic from STORY-001
- Run both queries in parallel using `Promise.all()`
- Ensure division by zero returns sensible defaults
- Test insights with various scenarios
- Consider caching if same comparison repeated
- Make insight generation extensible for future improvements

---

**Status:** Ready for Development
**Estimated Completion:** 1 day
