import { createTool } from "@mastra/core";
import { z } from "zod";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

// Load .env file
dotenv.config();

// Initialize the database connection
if (!process.env.DATABASE_URL) {
  console.error('[FATAL] DATABASE_URL not found in environment variables');
}
const sql = neon(process.env.DATABASE_URL!);

// Tool to list all tables in the database
export const listTablesTool = createTool({
  id: "list-tables",
  description: "List all tables in the VelocityFibre database",
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    tables: z.array(z.object({
      table_name: z.string(),
      table_schema: z.string(),
    })),
    message: z.string(),
  }),
  execute: async () => {
    try {
      const result = await sql`
        SELECT table_name, table_schema
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_name
      `;

      return {
        success: true,
        tables: result as Array<{ table_name: string; table_schema: string }>,
        message: `Found ${result.length} tables in the database`,
      };
    } catch (error) {
      return {
        success: false,
        tables: [],
        message: `Error listing tables: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// Tool to get the schema for a specific table
export const getTableSchemaTool = createTool({
  id: "get-table-schema",
  description: "Get the schema (columns, types, constraints) for a specific table",
  inputSchema: z.object({
    tableName: z.string().describe("The name of the table to get schema for"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    columns: z.array(z.object({
      column_name: z.string(),
      data_type: z.string(),
      is_nullable: z.string(),
      column_default: z.string().nullable(),
    })),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { tableName } = context;

    try {
      const result = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = ${tableName}
        ORDER BY ordinal_position
      `;

      return {
        success: true,
        columns: result as Array<{
          column_name: string;
          data_type: string;
          is_nullable: string;
          column_default: string | null;
        }>,
        message: `Found ${result.length} columns in table '${tableName}'`,
      };
    } catch (error) {
      return {
        success: false,
        columns: [],
        message: `Error getting schema for table '${tableName}': ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// Tool to run custom SQL queries
export const runQueryTool = createTool({
  id: "run-query",
  description: "Execute a SQL query on the VelocityFibre database. Use for data retrieval and analysis.",
  inputSchema: z.object({
    query: z.string().describe("The SQL query to execute (SELECT only for safety)"),
    limit: z.number().optional().default(100).describe("Maximum number of rows to return (default: 100)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.array(z.record(z.any())),
    rowCount: z.number(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { query, limit } = context;

    // Safety check: only allow SELECT queries
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery.startsWith('select')) {
      return {
        success: false,
        data: [],
        rowCount: 0,
        message: "Only SELECT queries are allowed for safety reasons",
      };
    }

    try {
      // Add LIMIT clause if not present
      let finalQuery = query;
      if (!trimmedQuery.includes('limit')) {
        finalQuery = `${query} LIMIT ${limit}`;
      }

      console.log('[runQuery] Executing:', finalQuery);
      const result = await sql.query(finalQuery);
      console.log('[runQuery] Success - rows:', result.rows?.length || 0);

      return {
        success: true,
        data: result.rows as Array<Record<string, any>>,
        rowCount: result.rows.length,
        message: `Query executed successfully. Returned ${result.rows.length} rows.`,
      };
    } catch (error) {
      console.error('[runQuery] Failed:', error);
      return {
        success: false,
        data: [],
        rowCount: 0,
        message: `Error executing query: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// Tool to get table statistics and insights
export const getTableStatsTool = createTool({
  id: "get-table-stats",
  description: "Get statistics and insights about a specific table (row count, sample data)",
  inputSchema: z.object({
    tableName: z.string().describe("The name of the table to analyze"),
    sampleSize: z.number().optional().default(5).describe("Number of sample rows to return (default: 5)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    stats: z.object({
      tableName: z.string(),
      rowCount: z.number(),
      sampleData: z.array(z.record(z.any())),
    }).optional(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { tableName, sampleSize } = context;

    try {
      // Get row count
      const countResult = await sql.query(
        `SELECT COUNT(*) as count FROM "${tableName}"`
      );
      const rowCount = Number(countResult.rows[0].count);

      // Get sample data
      const sampleResult = await sql.query(
        `SELECT * FROM "${tableName}" LIMIT ${sampleSize}`
      );

      return {
        success: true,
        stats: {
          tableName,
          rowCount,
          sampleData: sampleResult.rows as Array<Record<string, any>>,
        },
        message: `Retrieved statistics for table '${tableName}': ${rowCount} total rows`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting stats for table '${tableName}': ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// Tool to analyze database overview
export const getDatabaseOverviewTool = createTool({
  id: "get-database-overview",
  description: "Get a comprehensive overview of the entire database including all tables and their row counts",
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    overview: z.object({
      totalTables: z.number(),
      tables: z.array(z.object({
        name: z.string(),
        rowCount: z.number(),
        estimatedSize: z.string().optional(),
      })),
    }).optional(),
    message: z.string(),
  }),
  execute: async () => {
    try {
      // Get all tables
      const tablesResult = await sql`
        SELECT
          schemaname,
          relname as tablename,
          n_live_tup as row_count
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
      `;

      const tables = tablesResult.map((row: any) => ({
        name: row.tablename,
        rowCount: Number(row.row_count || 0),
      }));

      return {
        success: true,
        overview: {
          totalTables: tables.length,
          tables,
        },
        message: `Database contains ${tables.length} tables with a total of ${tables.reduce((sum, t) => sum + t.rowCount, 0)} rows`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting database overview: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
