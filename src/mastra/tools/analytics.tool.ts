import { createTool } from "@mastra/core";
import { z } from "zod";
import { neon } from "@neondatabase/serverless";

// Initialize the database connection
const sql = neon(process.env.DATABASE_URL!);

// Types
interface QueryLog {
  tool: string;
  query?: string;
  tableName?: string;
  executionTime: number;
  rowsReturned?: number;
  success: boolean;
  error?: string;
}

// Helper: Sanitize values for SQL
function sanitizeValue(value: any): string {
  if (typeof value === 'string') {
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
  return `'${String(value)}'`;
}

// Helper: Get valid table names
async function getValidTableNames(): Promise<string[]> {
  const result = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `;
  return result.map(row => row.table_name);
}

// Helper: Get table columns
async function getTableColumns(tableName: string): Promise<string[]> {
  const result = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = ${tableName}
  `;
  return result.map(row => row.column_name);
}

// Helper: Log query
async function logQuery(log: QueryLog): Promise<void> {
  console.log('[QUERY LOG]', {
    timestamp: new Date().toISOString(),
    ...log
  });
}

// STORY-001: Calculate Metrics Tool
export const calculateMetricsTool = createTool({
  id: "calculate-metrics",
  description: "Calculate aggregated metrics (count, sum, avg, min, max, distinct) on any table. Supports grouping and filtering.",
  inputSchema: z.object({
    tableName: z.string().describe("Name of the table to query"),
    metric: z.enum(['count', 'sum', 'avg', 'min', 'max', 'distinct']).describe("Type of aggregation to perform"),
    column: z.string().optional().describe("Column name (required for sum/avg/min/max/distinct)"),
    groupBy: z.string().optional().describe("Column to group results by"),
    filters: z.array(z.object({
      column: z.string(),
      operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'LIKE']),
      value: z.any()
    })).optional().describe("WHERE clause filters"),
    orderBy: z.enum(['asc', 'desc']).optional().describe("Sort order for results"),
    limit: z.number().optional().default(100).describe("Maximum number of results (default: 100)")
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
      // 1. Validate table exists
      const validTables = await getValidTableNames();
      if (!validTables.includes(context.tableName)) {
        throw new Error(
          `Table '${context.tableName}' does not exist. Use list-tables to see available tables.`
        );
      }

      // 2. Validate column exists (if provided)
      if (context.column) {
        const columns = await getTableColumns(context.tableName);
        if (!columns.includes(context.column)) {
          throw new Error(
            `Column '${context.column}' does not exist in table '${context.tableName}'. Use get-table-schema to see available columns.`
          );
        }
      }

      // 3. Validate metric requires column
      if (['sum', 'avg', 'min', 'max', 'distinct'].includes(context.metric) && !context.column) {
        throw new Error(
          `Metric '${context.metric}' requires a column parameter. Please specify which column to calculate ${context.metric} for.`
        );
      }

      // 4. Build query
      let query = 'SELECT ';

      // Add GROUP BY column to SELECT if present
      if (context.groupBy) {
        query += `"${context.groupBy}", `;
      }

      // Add metric calculation
      switch (context.metric) {
        case 'count':
          query += context.column
            ? `COUNT("${context.column}") as count`
            : `COUNT(*) as count`;
          break;
        case 'sum':
          query += `SUM("${context.column}") as sum`;
          break;
        case 'avg':
          query += `AVG("${context.column}")::numeric(10,2) as avg`;
          break;
        case 'min':
          query += `MIN("${context.column}") as min`;
          break;
        case 'max':
          query += `MAX("${context.column}") as max`;
          break;
        case 'distinct':
          query += `COUNT(DISTINCT "${context.column}") as distinct_count`;
          break;
      }

      // FROM clause
      query += ` FROM "${context.tableName}"`;

      // WHERE clause
      if (context.filters && context.filters.length > 0) {
        const conditions = context.filters.map(f =>
          `"${f.column}" ${f.operator} ${sanitizeValue(f.value)}`
        );
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      // GROUP BY clause
      if (context.groupBy) {
        query += ` GROUP BY "${context.groupBy}"`;
      }

      // ORDER BY clause
      if (context.orderBy) {
        const orderCol = context.groupBy || context.metric;
        query += ` ORDER BY ${orderCol} ${context.orderBy.toUpperCase()}`;
      }

      // LIMIT clause
      query += ` LIMIT ${context.limit || 100}`;

      // 5. Execute query
      const result = await sql.query(query);

      // 6. Calculate summary
      const calculationTime = Date.now() - startTime;
      const aggregatedValue = result.rows.length === 1 && !context.groupBy
        ? Number(Object.values(result.rows[0])[context.groupBy ? 1 : 0])
        : undefined;

      // 7. Log query
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

      return {
        success: false,
        results: [],
        summary: {
          totalRecords: 0,
          calculationTime,
          metricApplied: context.metric
        },
        message: `Error calculating metrics: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
});

// STORY-002: Compare Data Tool
export const compareDataTool = createTool({
  id: "compare-data",
  description: "Compare data between two time periods or entities. Calculates differences, percentage changes, and trends.",
  inputSchema: z.object({
    tableName: z.string().describe("Name of the table to query"),
    metric: z.enum(['count', 'sum', 'avg', 'min', 'max']).describe("Metric to compare"),
    column: z.string().optional().describe("Column name (required for sum/avg/min/max)"),
    compareBy: z.string().describe("Column to compare by (e.g., 'created_at' for time, 'contractor_id' for entities)"),
    value1: z.any().describe("First value to compare (e.g., '2024-01-01' or contractor ID 1)"),
    value2: z.any().describe("Second value to compare (e.g., '2024-02-01' or contractor ID 2)"),
    filters: z.array(z.object({
      column: z.string(),
      operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'LIKE']),
      value: z.any()
    })).optional().describe("Additional WHERE clause filters")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    comparison: z.object({
      value1Result: z.number(),
      value2Result: z.number(),
      difference: z.number(),
      percentChange: z.number(),
      trend: z.enum(['up', 'down', 'stable']),
      insight: z.string()
    }).optional(),
    message: z.string()
  }),
  execute: async ({ context }) => {
    const startTime = Date.now();

    try {
      // Helper to build metric query for a specific value
      const buildComparisonQuery = (filterValue: any) => {
        let query = 'SELECT ';

        switch (context.metric) {
          case 'count':
            query += context.column
              ? `COUNT("${context.column}") as result`
              : `COUNT(*) as result`;
            break;
          case 'sum':
            query += `SUM("${context.column}") as result`;
            break;
          case 'avg':
            query += `AVG("${context.column}")::numeric(10,2) as result`;
            break;
          case 'min':
            query += `MIN("${context.column}") as result`;
            break;
          case 'max':
            query += `MAX("${context.column}") as result`;
            break;
        }

        query += ` FROM "${context.tableName}" WHERE "${context.compareBy}" = ${sanitizeValue(filterValue)}`;

        // Add additional filters
        if (context.filters && context.filters.length > 0) {
          const conditions = context.filters.map(f =>
            `"${f.column}" ${f.operator} ${sanitizeValue(f.value)}`
          );
          query += ` AND ${conditions.join(' AND ')}`;
        }

        return query;
      };

      // Execute queries for both values
      const query1 = buildComparisonQuery(context.value1);
      const query2 = buildComparisonQuery(context.value2);

      const result1 = await sql.query(query1);
      const result2 = await sql.query(query2);

      const value1Result = Number(result1.rows[0]?.result || 0);
      const value2Result = Number(result2.rows[0]?.result || 0);

      // Calculate comparison metrics
      const difference = value2Result - value1Result;
      const percentChange = value1Result !== 0
        ? ((difference / value1Result) * 100)
        : (value2Result > 0 ? 100 : 0);

      const trend = Math.abs(percentChange) < 1
        ? 'stable'
        : percentChange > 0
          ? 'up'
          : 'down';

      // Generate insight
      let insight = '';
      if (trend === 'stable') {
        insight = `${context.metric} remained stable between the two periods/entities (${percentChange.toFixed(1)}% change)`;
      } else if (trend === 'up') {
        insight = `${context.metric} increased by ${Math.abs(difference)} (${percentChange.toFixed(1)}%) from ${value1Result} to ${value2Result}`;
      } else {
        insight = `${context.metric} decreased by ${Math.abs(difference)} (${Math.abs(percentChange).toFixed(1)}%) from ${value1Result} to ${value2Result}`;
      }

      const calculationTime = Date.now() - startTime;

      await logQuery({
        tool: 'compareData',
        tableName: context.tableName,
        executionTime: calculationTime,
        success: true
      });

      return {
        success: true,
        comparison: {
          value1Result,
          value2Result,
          difference,
          percentChange: Number(percentChange.toFixed(2)),
          trend,
          insight
        },
        message: insight
      };

    } catch (error) {
      const calculationTime = Date.now() - startTime;

      await logQuery({
        tool: 'compareData',
        tableName: context.tableName,
        executionTime: calculationTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        message: `Error comparing data: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
});

// STORY-003: Rank Entities Tool
export const rankEntitiesTool = createTool({
  id: "rank-entities",
  description: "Rank and sort entities (contractors, staff, projects) by a metric. Returns top/bottom N results with rankings.",
  inputSchema: z.object({
    tableName: z.string().describe("Name of the table to query"),
    metric: z.enum(['count', 'sum', 'avg', 'min', 'max']).describe("Metric to rank by"),
    rankBy: z.string().describe("Column to rank entities by (e.g., 'contractor_id', 'staff_id')"),
    column: z.string().optional().describe("Column for metric calculation (required for sum/avg/min/max)"),
    direction: z.enum(['top', 'bottom']).default('top').describe("Show top or bottom rankings"),
    limit: z.number().optional().default(10).describe("Number of results to return (default: 10)"),
    filters: z.array(z.object({
      column: z.string(),
      operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'LIKE']),
      value: z.any()
    })).optional().describe("Additional WHERE clause filters")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    rankings: z.array(z.object({
      rank: z.number(),
      entity: z.any(),
      value: z.number(),
      percentage: z.number().optional()
    })),
    summary: z.object({
      totalEntities: z.number(),
      totalValue: z.number(),
      avgValue: z.number()
    }).optional(),
    message: z.string()
  }),
  execute: async ({ context }) => {
    const startTime = Date.now();

    try {
      // Build ranking query
      let query = `
        WITH ranked AS (
          SELECT
            "${context.rankBy}" as entity,
      `;

      // Add metric calculation
      switch (context.metric) {
        case 'count':
          query += context.column
            ? `COUNT("${context.column}") as value`
            : `COUNT(*) as value`;
          break;
        case 'sum':
          query += `SUM("${context.column}") as value`;
          break;
        case 'avg':
          query += `AVG("${context.column}")::numeric(10,2) as value`;
          break;
        case 'min':
          query += `MIN("${context.column}") as value`;
          break;
        case 'max':
          query += `MAX("${context.column}") as value`;
          break;
      }

      query += ` FROM "${context.tableName}"`;

      // WHERE clause
      if (context.filters && context.filters.length > 0) {
        const conditions = context.filters.map(f =>
          `"${f.column}" ${f.operator} ${sanitizeValue(f.value)}`
        );
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ` GROUP BY "${context.rankBy}"`;
      query += ` ORDER BY value ${context.direction === 'top' ? 'DESC' : 'ASC'}`;
      query += ` LIMIT ${context.limit || 10}`;
      query += `
        )
        SELECT
          ROW_NUMBER() OVER (ORDER BY value ${context.direction === 'top' ? 'DESC' : 'ASC'}) as rank,
          entity,
          value,
          (value * 100.0 / SUM(value) OVER ())::numeric(10,2) as percentage
        FROM ranked
      `;

      const result = await sql.query(query);

      // Calculate summary
      const totalValue = result.rows.reduce((sum, row: any) => sum + Number(row.value), 0);
      const avgValue = result.rows.length > 0 ? totalValue / result.rows.length : 0;

      const rankings = result.rows.map((row: any) => ({
        rank: Number(row.rank),
        entity: row.entity,
        value: Number(row.value),
        percentage: Number(row.percentage)
      }));

      const calculationTime = Date.now() - startTime;

      await logQuery({
        tool: 'rankEntities',
        query,
        tableName: context.tableName,
        executionTime: calculationTime,
        rowsReturned: result.rows.length,
        success: true
      });

      return {
        success: true,
        rankings,
        summary: {
          totalEntities: result.rows.length,
          totalValue: Number(totalValue.toFixed(2)),
          avgValue: Number(avgValue.toFixed(2))
        },
        message: `Ranked ${context.direction} ${result.rows.length} entities by ${context.metric} from ${context.tableName}`
      };

    } catch (error) {
      const calculationTime = Date.now() - startTime;

      await logQuery({
        tool: 'rankEntities',
        tableName: context.tableName,
        executionTime: calculationTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        rankings: [],
        message: `Error ranking entities: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
});
