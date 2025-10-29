# TECHNICAL ARCHITECTURE DOCUMENT
## VelocityFibre Database Agent V2.0

**Architect:** Architecture Agent
**Date:** 2025-10-28
**Status:** Draft for Review
**Version:** 2.0

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│  (Mastra Studio Playground - Browser @ port 8080)           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP/REST
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Mastra Agent Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  VelocityFibre DB Agent (Grok-2-1212)               │   │
│  │  - Agent Instructions & Context                       │   │
│  │  - Memory (LibSQL - 15 messages)                     │   │
│  │  - Tool Orchestration                                │   │
│  └─────────┬────────────────────────────────────────────┘   │
└────────────┼──────────────────────────────────────────────┬─┘
             │                                              │
             │ Tool Calls                                   │ Logging
             ▼                                              ▼
┌─────────────────────────────────────────┐   ┌──────────────────┐
│         Tool Execution Layer            │   │  Observability   │
│  ┌───────────────────────────────────┐  │   │  - Query Logs    │
│  │  Core Database Tools (Existing)   │  │   │  - Performance   │
│  │  - getDatabaseOverview            │  │   │  - Errors        │
│  │  - listTables                     │  │   │  - Usage Stats   │
│  │  - getTableSchema                 │  │   └──────────────────┘
│  │  - getTableStats                  │  │
│  │  - runQuery                       │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Analytics Tools (NEW)            │  │
│  │  - calculateMetrics               │  │
│  │  - compareData                    │  │
│  │  - rankEntities                   │  │
│  │  - analyzeTrends                  │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Quality & Performance (NEW)      │  │
│  │  - checkDataQuality               │  │
│  │  - getKPIDashboard                │  │
│  │  - exportResults                  │  │
│  │  - getTableRelationships          │  │
│  └───────────────────────────────────┘  │
└──────────────┬──────────────────────────┘
               │
               │ SQL Queries
               ▼
┌─────────────────────────────────────────┐
│     Data Layer - Neon PostgreSQL        │
│  ┌───────────────────────────────────┐  │
│  │  89 Tables, 59K+ Rows              │  │
│  │  - onemap_properties (32K)         │  │
│  │  - nokia_velocity (20K)            │  │
│  │  - sow_onemap_mapping (4.5K)       │  │
│  │  - staff, contractors, projects    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend** | Mastra Studio UI | Latest | User interface |
| **Agent Framework** | Mastra Core | 0.17.5 | Agent orchestration |
| **AI Model** | xAI Grok-2-1212 | Latest | Primary LLM |
| **Memory** | LibSQL | 0.16.1 | Conversation history |
| **Database** | Neon PostgreSQL | Latest | Data storage |
| **DB Client** | @neondatabase/serverless | 1.0.2 | Connection pooling |
| **Runtime** | Node.js | 20.19.5 | Server runtime |
| **Deployment** | Systemd + Nginx | - | Production hosting |
| **Server** | Hostinger VPS | Ubuntu 24.04 | Infrastructure |

---

## 2. Detailed Component Design

### 2.1 Core Database Tools (Existing - Enhanced)

#### Tool: getDatabaseOverview
**Current Implementation:** ✅ Working
**Enhancements Needed:**
- Add table size estimates
- Add last update timestamps
- Add growth rate indicators
- Add data quality scores

```typescript
// Enhanced Output Schema
{
  success: boolean,
  overview: {
    totalTables: number,
    totalRows: number,
    totalSize: string,  // NEW
    lastScanned: Date,  // NEW
    tables: [{
      name: string,
      rowCount: number,
      sizeEstimate: string,  // NEW
      lastUpdated: Date,      // NEW
      growthRate: number,     // NEW (rows/day)
      qualityScore: number,   // NEW (0-100)
    }]
  }
}
```

#### Tool: getTableStats
**Current Implementation:** ✅ Working
**Enhancements Needed:**
- Statistical analysis (mean, median, stddev)
- Null value analysis
- Unique value counts
- Data type validation

```typescript
// Enhanced Output Schema
{
  success: boolean,
  stats: {
    tableName: string,
    rowCount: number,
    sampleData: Record<string, any>[],
    columnStats: [{           // NEW
      name: string,
      type: string,
      nullCount: number,
      uniqueCount: number,
      minValue: any,
      maxValue: any,
      avgValue: number,
      commonValues: any[]
    }],
    dataQuality: {            // NEW
      completeness: number,
      consistency: number,
      accuracy: number
    }
  }
}
```

#### Tool: runQuery
**Current Implementation:** ✅ Working
**Enhancements Needed:**
- Query validation & optimization hints
- Execution time tracking
- Result set streaming for large queries
- Automatic EXPLAIN ANALYZE

```typescript
// Enhanced Output Schema
{
  success: boolean,
  data: Record<string, any>[],
  rowCount: number,
  executionTime: number,     // NEW (milliseconds)
  queryPlan: string,         // NEW (EXPLAIN output)
  optimizationHints: string[], // NEW
  fromCache: boolean,        // NEW
  message: string
}
```

---

### 2.2 New Analytics Tools (Phase 1)

#### Tool: calculateMetrics
**Purpose:** Perform aggregations without writing SQL
**Priority:** P0

```typescript
{
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
    limit: z.number().default(100)
  }),
  outputSchema: z.object({
    success: z.boolean(),
    results: z.array(z.record(z.any())),
    summary: z.object({
      totalRecords: z.number(),
      calculationTime: z.number(),
      metricApplied: z.string()
    }),
    message: z.string()
  })
}
```

**Implementation Strategy:**
- Build safe SQL query from parameters
- Apply filters before aggregation
- Use proper GROUP BY for grouping
- Add error handling for invalid columns
- Cache results for 5 minutes

#### Tool: compareData
**Purpose:** Compare metrics across time periods, contractors, projects
**Priority:** P0

```typescript
{
  id: "compare-data",
  description: "Compare metrics between two groups/periods",
  inputSchema: z.object({
    tableName: z.string(),
    metric: z.string(),
    compareBy: z.enum(['time', 'entity', 'status']),
    group1: z.object({
      label: z.string(),
      filters: z.array(...)
    }),
    group2: z.object({
      label: z.string(),
      filters: z.array(...)
    })
  }),
  outputSchema: z.object({
    success: z.boolean(),
    comparison: {
      group1: { label: string, value: number },
      group2: { label: string, value: number },
      difference: number,
      percentChange: number,
      trend: 'up' | 'down' | 'stable',
      insight: string
    }
  })
}
```

**Implementation Strategy:**
- Run two queries in parallel
- Calculate delta and percentage
- Generate human-readable insights
- Handle division by zero
- Support date range comparisons

#### Tool: rankEntities
**Purpose:** Rank contractors, staff, projects by performance
**Priority:** P0

```typescript
{
  id: "rank-entities",
  description: "Rank entities by a metric (e.g., top contractors by installations)",
  inputSchema: z.object({
    tableName: z.string(),
    rankBy: z.string(),  // column to rank by
    entityColumn: z.string(),  // entity to rank (e.g., contractor_id)
    direction: z.enum(['top', 'bottom']),
    limit: z.number().default(10),
    filters: z.array(...).optional()
  }),
  outputSchema: z.object({
    success: z.boolean(),
    rankings: z.array(z.object({
      rank: z.number(),
      entity: z.string(),
      value: z.number(),
      percentOfTotal: z.number
    })),
    totalEntities: z.number(),
    message: z.string()
  })
}
```

**Implementation Strategy:**
- Use window functions for ranking
- Calculate percentage of total
- Handle ties appropriately
- Support custom filters
- Format results for readability

---

### 2.3 Export Functionality (Phase 1)

#### Tool: exportResults
**Purpose:** Export query results to CSV/JSON/Excel
**Priority:** P0

```typescript
{
  id: "export-results",
  description: "Export query results to CSV, JSON, or Excel format",
  inputSchema: z.object({
    query: z.string(),
    format: z.enum(['csv', 'json', 'excel']),
    filename: z.string().optional(),
    includeMetadata: z.boolean().default(true)
  }),
  outputSchema: z.object({
    success: z.boolean(),
    downloadUrl: z.string(),
    fileSize: z.string(),
    rowCount: z.number(),
    expiresAt: z.date(),
    message: z.string()
  })
}
```

**Implementation Strategy:**
1. Execute query with full results (no LIMIT)
2. Convert to requested format:
   - CSV: Use `fast-csv` library
   - JSON: Native JSON.stringify with formatting
   - Excel: Use `exceljs` library
3. Save to `/tmp/exports/` with UUID filename
4. Generate signed URL (valid 24 hours)
5. Schedule cleanup job (delete after 24h)
6. Add metadata header (query, timestamp, user)

**File Structure:**
```
/tmp/exports/
├── {uuid}.csv
├── {uuid}.json
└── {uuid}.xlsx
```

**Dependencies:**
```json
{
  "fast-csv": "^5.0.0",
  "exceljs": "^4.4.0"
}
```

---

### 2.4 Data Quality Tools (Phase 1)

#### Tool: checkDataQuality
**Purpose:** Validate data completeness, freshness, consistency
**Priority:** P0

```typescript
{
  id: "check-data-quality",
  description: "Analyze data quality across tables",
  inputSchema: z.object({
    tableName: z.string().optional(),  // if empty, check all tables
    checks: z.array(z.enum([
      'completeness',
      'freshness',
      'consistency',
      'duplicates',
      'outliers',
      'referential_integrity'
    ])).optional()
  }),
  outputSchema: z.object({
    success: z.boolean(),
    quality: {
      overallScore: z.number(),  // 0-100
      tables: z.array(z.object({
        name: z.string(),
        score: z.number(),
        issues: z.array(z.object({
          type: z.string(),
          severity: z.enum(['critical', 'warning', 'info']),
          description: z.string(),
          affectedRows: z.number(),
          recommendation: z.string()
        }))
      }))
    }
  })
}
```

**Quality Checks:**
1. **Completeness:** NULL value percentage per column
2. **Freshness:** Last updated timestamp analysis
3. **Consistency:** Data type violations, format issues
4. **Duplicates:** Primary key violations, duplicate records
5. **Outliers:** Statistical outliers (>3 std dev)
6. **Referential Integrity:** Orphaned foreign keys

**Scoring Algorithm:**
```
completeness = (1 - nullRatio) * 100
freshness = based on lastUpdated (fresh=100, stale=0)
consistency = (validRecords / totalRecords) * 100

overallScore = (completeness * 0.4 + freshness * 0.3 + consistency * 0.3)
```

---

### 2.5 KPI Dashboard Tools (Phase 2)

#### Tool: getKPIDashboard
**Purpose:** Return all key business metrics in one call
**Priority:** P1

```typescript
{
  id: "get-kpi-dashboard",
  description: "Get all KPIs for VelocityFibre operations",
  inputSchema: z.object({
    timeframe: z.enum(['today', 'week', 'month', 'quarter']).default('week'),
    compareWith: z.enum(['previous_period', 'last_year', 'none']).optional()
  }),
  outputSchema: z.object({
    success: z.boolean(),
    kpis: z.object({
      // Projects
      activeProjects: { value: number, change: number, trend: string },
      completedProjects: { value: number, change: number, trend: string },

      // Contractors
      activeContractors: { value: number, change: number, trend: string },
      topContractor: { name: string, metric: number },

      // Installations
      totalInstallations: { value: number, change: number, trend: string },
      avgInstallationTime: { value: number, change: number, trend: string },

      // Staff
      activeStaff: { value: number, change: number, trend: string },
      staffUtilization: { value: number, change: number, trend: string },

      // Equipment
      equipmentCount: { value: number, change: number, trend: string },

      // Data Quality
      dataHealthScore: { value: number, change: number, trend: string }
    }),
    generatedAt: z.date(),
    message: z.string()
  })
}
```

**KPI Definitions:**
```typescript
const KPI_QUERIES = {
  activeProjects: `
    SELECT COUNT(*) FROM projects
    WHERE status = 'active'
  `,

  activeContractors: `
    SELECT COUNT(*) FROM contractors
    WHERE status = 'active'
  `,

  totalInstallations: `
    SELECT COUNT(*) FROM drops
    WHERE created_at >= :timeframe_start
  `,

  avgInstallationTime: `
    SELECT AVG(completion_time_hours)
    FROM drops
    WHERE completed_at >= :timeframe_start
  `,

  topContractor: `
    SELECT contractor_name, COUNT(*) as installs
    FROM drops d
    JOIN contractors c ON d.contractor_id = c.id
    WHERE d.created_at >= :timeframe_start
    GROUP BY contractor_name
    ORDER BY installs DESC
    LIMIT 1
  `
}
```

---

### 2.6 Trend Analysis (Phase 2)

#### Tool: analyzeTrends
**Purpose:** Identify trends and patterns over time
**Priority:** P1

```typescript
{
  id: "analyze-trends",
  description: "Analyze trends in time-series data",
  inputSchema: z.object({
    tableName: z.string(),
    metric: z.string(),
    timeColumn: z.string(),
    groupBy: z.string().optional(),
    period: z.enum(['daily', 'weekly', 'monthly']),
    startDate: z.date(),
    endDate: z.date().optional()
  }),
  outputSchema: z.object({
    success: z.boolean(),
    trends: {
      direction: z.enum(['increasing', 'decreasing', 'stable', 'volatile']),
      growthRate: z.number(),  // % per period
      forecast: z.array(z.object({
        period: z.string(),
        predicted: z.number(),
        confidence: z.number()
      })),
      anomalies: z.array(z.object({
        date: z.date(),
        value: z.number(),
        expectedRange: [number, number],
        severity: z.string()
      })),
      insights: z.array(z.string())
    }
  })
}
```

**Trend Analysis Algorithm:**
1. Aggregate data by time period
2. Calculate moving averages (7-day, 30-day)
3. Detect trend direction using linear regression
4. Identify anomalies (>2 std dev from mean)
5. Simple forecasting (linear extrapolation)
6. Generate insights based on patterns

---

## 3. Data Layer Design

### 3.1 Database Schema Understanding

**Critical Tables:**
```sql
-- High-value tables
onemap_properties (32,564 rows) - Property locations, coordinates
nokia_velocity (20,112 rows) - Nokia equipment, configurations
sow_onemap_mapping (4,571 rows) - SOW to geographic mapping
fibre_segments (681 rows) - Fibre installation segments

-- Core operational tables
staff (43 rows) - Employee information
contractors (18 rows) - Contractor details
projects (2 rows) - Active projects
drops (3 rows) - Installation drops
clients (2 rows) - Customer data

-- Supporting tables
meetings (50 rows) - Meeting records
fireflies_* (691+ rows) - Meeting integrations
sharepoint_* (272+ rows) - SharePoint synced data
```

### 3.2 Query Optimization Strategy

**Indexing Recommendations:**
```sql
-- High-priority indexes
CREATE INDEX idx_drops_contractor ON drops(contractor_id);
CREATE INDEX idx_drops_created ON drops(created_at);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_staff_active ON staff(is_active);

-- Composite indexes for common queries
CREATE INDEX idx_drops_contractor_date ON drops(contractor_id, created_at);
CREATE INDEX idx_installations_status_date ON home_installations(status, created_at);
```

**Query Patterns:**
```typescript
// Always use prepared statements
const query = sql`SELECT * FROM ${sql(tableName)} WHERE id = ${id}`;

// Use connection pooling
const pool = new Pool({ max: 10, idleTimeout: 30000 });

// Implement query timeout
const result = await Promise.race([
  sql.query(query),
  timeout(30000)
]);
```

### 3.3 Caching Strategy

**Cache Layers:**
```
┌─────────────────────────────────────┐
│   L1: In-Memory Cache (Node.js)     │
│   - TTL: 5 minutes                  │
│   - Size: 100 MB max                │
│   - Eviction: LRU                   │
└─────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────┐
│   L2: Redis Cache (Future)          │
│   - TTL: 30 minutes                 │
│   - Shared across instances         │
└─────────────────────────────────────┘
```

**Cache Implementation:**
```typescript
import NodeCache from 'node-cache';

const queryCache = new NodeCache({
  stdTTL: 300,  // 5 minutes
  checkperiod: 60,
  maxKeys: 1000
});

function getCacheKey(query: string, params: any): string {
  return createHash('md5')
    .update(JSON.stringify({ query, params }))
    .digest('hex');
}

async function executeCachedQuery(query: string, params: any) {
  const key = getCacheKey(query, params);

  let result = queryCache.get(key);
  if (result) {
    return { ...result, fromCache: true };
  }

  result = await sql.query(query, params);
  queryCache.set(key, result);

  return { ...result, fromCache: false };
}
```

---

## 4. Performance & Scalability

### 4.1 Performance Targets

| Metric | Target | Current | Gap |
|--------|--------|---------|-----|
| P50 Response Time | <1s | ~3s | -2s |
| P95 Response Time | <3s | ~8s | -5s |
| P99 Response Time | <10s | ~15s | -5s |
| Concurrent Users | 100 | ~10 | +90 |
| Queries/Day | 10,000 | ~100 | +9,900 |
| Cache Hit Rate | >50% | 0% | +50% |
| Error Rate | <1% | ~5% | -4% |

### 4.2 Optimization Strategies

**Query Optimization:**
- Add database indexes on frequently queried columns
- Use EXPLAIN ANALYZE to identify slow queries
- Implement query result pagination
- Add query timeout limits (30s max)
- Use connection pooling

**Caching:**
- Cache database schema (rarely changes)
- Cache aggregation results (5 min TTL)
- Cache KPI dashboard (1 min TTL)
- Cache table statistics (10 min TTL)
- Implement cache warming on startup

**Code Optimization:**
- Parallel tool execution where possible
- Stream large result sets
- Use async/await properly
- Implement backpressure handling
- Add request queuing

### 4.3 Scalability Plan

**Phase 1: Single Server (Current)**
- Hostinger VPS (2 CPU, 4GB RAM)
- Handles 100 queries/day
- Good for MVP testing

**Phase 2: Optimized Single Server**
- Add caching layer
- Optimize queries
- Handle 1,000 queries/day

**Phase 3: Horizontal Scaling (Future)**
- Multiple agent instances
- Load balancer (Nginx)
- Shared Redis cache
- Handle 10,000+ queries/day

---

## 5. Security Architecture

### 5.1 Security Layers

```
┌─────────────────────────────────────┐
│  1. Input Validation                │
│  - SQL injection prevention         │
│  - Parameter sanitization           │
│  - Query allowlist (SELECT only)    │
└─────────────────────────────────────┘
          ▼
┌─────────────────────────────────────┐
│  2. Authentication & Authorization  │
│  - API key validation               │
│  - Rate limiting (100 req/hr)       │
│  - Role-based access control        │
└─────────────────────────────────────┘
          ▼
┌─────────────────────────────────────┐
│  3. Data Protection                 │
│  - PII detection & masking          │
│  - Sensitive column filtering       │
│  - Audit logging                    │
└─────────────────────────────────────┘
          ▼
┌─────────────────────────────────────┐
│  4. Network Security                │
│  - HTTPS only                       │
│  - Firewall rules                   │
│  - VPN access (optional)            │
└─────────────────────────────────────┘
```

### 5.2 SQL Injection Prevention

```typescript
// NEVER do this
const query = `SELECT * FROM ${tableName} WHERE id = ${id}`;  // ❌ DANGEROUS

// ALWAYS use parameterized queries
const query = sql`SELECT * FROM ${sql.ident(tableName)} WHERE id = ${id}`;  // ✅ SAFE

// Additional validation
function validateTableName(name: string): boolean {
  const validTables = ['staff', 'contractors', 'projects', ...];
  return validTables.includes(name);
}

// Block dangerous keywords
function isSafeQuery(query: string): boolean {
  const dangerous = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'TRUNCATE', 'ALTER'];
  const upper = query.toUpperCase();
  return !dangerous.some(keyword => upper.includes(keyword));
}
```

### 5.3 PII Detection

```typescript
const PII_PATTERNS = {
  email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
  phone: /\d{3}[-.]?\d{3}[-.]?\d{4}/g,
  ssn: /\d{3}-\d{2}-\d{4}/g,
  creditCard: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g
};

function maskPII(data: any[]): any[] {
  return data.map(row => {
    const masked = { ...row };
    Object.keys(masked).forEach(key => {
      if (typeof masked[key] === 'string') {
        // Mask emails
        masked[key] = masked[key].replace(PII_PATTERNS.email, '[EMAIL]');
        // Mask phones
        masked[key] = masked[key].replace(PII_PATTERNS.phone, '[PHONE]');
        // etc...
      }
    });
    return masked;
  });
}
```

### 5.4 Audit Logging

```typescript
interface AuditLog {
  timestamp: Date;
  userId: string;
  action: string;
  query: string;
  tableName: string;
  rowsAffected: number;
  executionTime: number;
  success: boolean;
  error?: string;
  ipAddress: string;
}

async function logQuery(log: AuditLog) {
  await sql`
    INSERT INTO audit_log (
      timestamp, user_id, action, query,
      table_name, rows_affected, execution_time,
      success, error, ip_address
    ) VALUES (
      ${log.timestamp}, ${log.userId}, ${log.action},
      ${log.query}, ${log.tableName}, ${log.rowsAffected},
      ${log.executionTime}, ${log.success}, ${log.error},
      ${log.ipAddress}
    )
  `;
}
```

---

## 6. Error Handling & Resilience

### 6.1 Error Handling Strategy

```typescript
class AgentError extends Error {
  constructor(
    public code: string,
    public message: string,
    public userMessage: string,
    public severity: 'critical' | 'error' | 'warning',
    public retryable: boolean,
    public context?: any
  ) {
    super(message);
  }
}

async function executeToolWithRetry(
  tool: Tool,
  params: any,
  maxRetries = 3
): Promise<any> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await tool.execute(params);
    } catch (error) {
      lastError = error;

      // Don't retry if not retryable
      if (error instanceof AgentError && !error.retryable) {
        throw error;
      }

      // Exponential backoff
      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }

  throw new AgentError(
    'MAX_RETRIES_EXCEEDED',
    `Failed after ${maxRetries} attempts`,
    'The operation failed multiple times. Please try again later.',
    'error',
    false,
    { originalError: lastError }
  );
}
```

### 6.2 Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold = 5,
    private timeout = 60000  // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}

// Usage
const dbCircuitBreaker = new CircuitBreaker(5, 60000);

async function queryDatabase(query: string) {
  return dbCircuitBreaker.execute(() => sql.query(query));
}
```

---

## 7. Testing Strategy

### 7.1 Test Pyramid

```
              /\
             /  \
           /  E2E  \          10% - End-to-End Tests
          /________\
         /          \
        / Integration \       30% - Integration Tests
       /              \
      /________________\
     /                  \
    /    Unit Tests      \    60% - Unit Tests
   /______________________\
```

### 7.2 Test Coverage Goals

| Component | Unit Tests | Integration Tests | E2E Tests |
|-----------|------------|-------------------|-----------|
| Tools | 90%+ | 80%+ | - |
| Agent Logic | 80%+ | 70%+ | 50%+ |
| Database Queries | 70%+ | 90%+ | - |
| Error Handling | 90%+ | 80%+ | - |
| API Endpoints | 60%+ | 80%+ | 70%+ |

### 7.3 Test Examples

**Unit Test:**
```typescript
describe('calculateMetrics tool', () => {
  it('should calculate average correctly', async () => {
    const result = await calculateMetricsTool.execute({
      tableName: 'staff',
      metric: 'avg',
      column: 'salary'
    });

    expect(result.success).toBe(true);
    expect(result.results[0].avg).toBeGreaterThan(0);
  });

  it('should handle invalid table name', async () => {
    await expect(
      calculateMetricsTool.execute({
        tableName: 'invalid_table',
        metric: 'count'
      })
    ).rejects.toThrow('Table not found');
  });
});
```

**Integration Test:**
```typescript
describe('VelocityFibre Agent Integration', () => {
  it('should generate KPI dashboard', async () => {
    const response = await agent.generate({
      messages: [{
        role: 'user',
        content: 'Show me the KPI dashboard'
      }]
    });

    expect(response.steps).toContainEqual(
      expect.objectContaining({
        toolCalls: expect.arrayContaining([
          expect.objectContaining({ toolName: 'getKPIDashboard' })
        ])
      })
    );

    expect(response.text).toContain('active projects');
    expect(response.text).toContain('contractors');
  });
});
```

**E2E Test:**
```typescript
describe('Complete User Journey', () => {
  it('should analyze contractor performance end-to-end', async () => {
    // 1. User asks question
    const question = 'Who are our top 5 contractors this month?';

    // 2. Agent processes
    const response = await sendToAgent(question);

    // 3. Verify tool usage
    expect(response.toolsUsed).toContain('rankEntities');

    // 4. Verify response quality
    expect(response.text).toMatch(/top \d+ contractors/i);
    expect(response.text).toContain('installations');

    // 5. Verify data accuracy
    const rankings = extractRankings(response.text);
    expect(rankings).toHaveLength(5);
    expect(rankings[0].rank).toBe(1);
  });
});
```

---

## 8. Deployment Architecture

### 8.1 Current Deployment (Phase 1)

```
Hostinger VPS (72.61.166.168)
├── Ubuntu 24.04 LTS
├── Node.js 20.19.5
├── Systemd Service
│   └── velocityfibre-agent.service
│       - ExecStart: npm run dev
│       - Port: 4111
│       - Auto-restart: Yes
├── Nginx Reverse Proxy
│   └── Port 8080 → 4111
│       - SSL: Not yet configured
│       - Rate limiting: Not yet configured
└── Mastra Agent
    ├── Grok-2-1212 (Primary)
    ├── GPT-4o (Backup - quota issues)
    └── LibSQL Memory Storage
```

### 8.2 Deployment Process

```bash
# 1. Pull latest code
cd /opt/velocityfibre-agent
git pull origin main

# 2. Install dependencies
npm install

# 3. Run tests (future)
npm test

# 4. Build if needed
npm run build

# 5. Restart service
systemctl restart velocityfibre-agent

# 6. Verify health
curl http://localhost:4111/api/health
curl http://72.61.166.168:8080/api/agents
```

### 8.3 Monitoring & Observability

**Metrics to Track:**
```typescript
{
  // Performance
  avgResponseTime: number,
  p95ResponseTime: number,
  p99ResponseTime: number,

  // Usage
  totalQueries: number,
  queriesPerHour: number,
  activeUsers: number,

  // Tools
  toolUsageCount: Record<string, number>,
  toolSuccessRate: Record<string, number>,

  // Errors
  errorRate: number,
  errorsByType: Record<string, number>,

  // Resources
  memoryUsage: number,
  cpuUsage: number,
  dbConnectionsActive: number,

  // Cache
  cacheHitRate: number,
  cacheSize: number
}
```

**Health Check Endpoint:**
```typescript
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    version: '2.0.0',
    checks: {
      database: await checkDatabaseConnection(),
      memory: checkMemoryUsage(),
      cache: checkCacheStatus(),
      llm: await checkLLMConnection()
    }
  };

  const isHealthy = Object.values(health.checks)
    .every(check => check.status === 'ok');

  res.status(isHealthy ? 200 : 503).json(health);
});
```

---

## 9. Migration Plan

### 9.1 Phase 1: Core Improvements (Weeks 1-2)

**New Tools to Add:**
1. `calculateMetrics` - Analytics tool
2. `compareData` - Comparison tool
3. `rankEntities` - Ranking tool
4. `exportResults` - Export functionality
5. `checkDataQuality` - Quality validation

**Enhancements:**
- Add retry logic to all tools
- Implement query logging
- Add execution time tracking
- Enhance error messages

**Testing:**
- Unit tests for each new tool
- Integration tests for agent
- Performance benchmarking

### 9.2 Phase 2: Intelligence (Weeks 3-4)

**New Tools:**
6. `getKPIDashboard` - KPI aggregation
7. `analyzeTrends` - Trend analysis
8. `getQueryTemplates` - Template library
9. `getTableRelationships` - Schema mapping
10. `scheduleReport` - Report automation

**Infrastructure:**
- Add caching layer
- Implement rate limiting
- Set up monitoring dashboard
- Add automated backups

### 9.3 Phase 3: Optimization (Weeks 5-6)

**Optimizations:**
- Query result pagination
- Database indexing
- Connection pooling
- Cache warming

**Features:**
11. `getQueryHistory` - History tracking
12. `suggestVisualization` - Chart suggestions
13. `checkDataFreshness` - Staleness monitoring

---

## 10. Success Metrics

### 10.1 Technical Metrics

| Metric | Baseline | Target | Measure |
|--------|----------|--------|---------|
| Response Time (P95) | 8s | <3s | Agent API logs |
| Error Rate | 5% | <1% | Error tracking |
| Cache Hit Rate | 0% | >50% | Cache stats |
| Query Success Rate | 95% | 99%+ | Tool execution logs |
| Uptime | 95% | 99.9% | Monitoring service |

### 10.2 Business Metrics

| Metric | Baseline | Target | Measure |
|--------|----------|--------|---------|
| Daily Active Users | 5 | 20+ | Usage logs |
| Queries per Day | 50 | 500+ | Query logs |
| Time to Insight | 30 min | <5 min | User surveys |
| Manual Reports | 10/week | <2/week | Process tracking |
| User Satisfaction | 3.5/5 | >4.5/5 | NPS surveys |

---

## 11. Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Database performance degradation | High | Medium | Add indexing, caching, query optimization |
| LLM API rate limits | High | Medium | Implement caching, use Grok as primary |
| Security vulnerabilities | High | Low | Security audit, input validation, SQL injection prevention |
| Data quality issues | Medium | High | Add quality checks, monitoring, alerts |
| Scalability bottlenecks | Medium | Medium | Horizontal scaling plan, load testing |
| Tool complexity | Low | High | Comprehensive documentation, examples |

---

## 12. Appendix

### 12.1 File Structure

```
/opt/velocityfibre-agent/
├── src/
│   └── mastra/
│       ├── agents/
│       │   └── velocityfibre-db.agent.ts
│       ├── tools/
│       │   ├── velocityfibre-db.tool.ts (existing)
│       │   ├── analytics.tool.ts (NEW)
│       │   ├── quality.tool.ts (NEW)
│       │   ├── kpi.tool.ts (NEW)
│       │   ├── export.tool.ts (NEW)
│       │   └── trends.tool.ts (NEW)
│       ├── utils/
│       │   ├── query-builder.ts (NEW)
│       │   ├── cache.ts (NEW)
│       │   ├── retry.ts (NEW)
│       │   └── validation.ts (NEW)
│       └── index.ts
├── BMAD/
│   ├── 01_ANALYST_REPORT.md
│   ├── 02_PRD.md
│   ├── 03_ARCHITECTURE.md (this file)
│   └── 04_STORIES/ (next)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env
├── package.json
├── mastra.config.ts
└── README.md
```

### 12.2 Dependencies to Add

```json
{
  "dependencies": {
    "fast-csv": "^5.0.0",
    "exceljs": "^4.4.0",
    "node-cache": "^5.1.2",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "@types/node-cache": "^4.2.5",
    "vitest": "^1.0.0"
  }
}
```

---

**Document Status:** ✅ Complete - Ready for Implementation
**Next Step:** Create Development Stories
