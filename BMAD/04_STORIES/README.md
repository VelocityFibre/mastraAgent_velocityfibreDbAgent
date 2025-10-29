# Development Stories - VelocityFibre Agent V2.0

**Project:** VelocityFibre Database Agent Improvements
**Methodology:** BMAD Method
**Total Stories:** 15 stories across 3 phases
**Timeline:** 6 weeks

---

## Story Status Overview

| Story | Feature | Priority | Points | Status | Phase |
|-------|---------|----------|--------|--------|-------|
| STORY-001 | calculateMetrics Tool | P0 | 5 | ✅ Detailed | Phase 1 |
| STORY-002 | compareData Tool | P0 | 5 | 📝 Outlined | Phase 1 |
| STORY-003 | rankEntities Tool | P0 | 5 | 📝 Outlined | Phase 1 |
| STORY-004 | exportResults Tool | P0 | 8 | 📝 Outlined | Phase 1 |
| STORY-005 | checkDataQuality Tool | P0 | 8 | 📝 Outlined | Phase 1 |
| STORY-006 | Error Handling & Retry Logic | P0 | 3 | 📝 Outlined | Phase 1 |
| STORY-007 | Query Performance Monitoring | P0 | 3 | 📝 Outlined | Phase 1 |
| STORY-008 | getKPIDashboard Tool | P1 | 8 | 📝 Outlined | Phase 2 |
| STORY-009 | analyzeTrends Tool | P1 | 8 | 📝 Outlined | Phase 2 |
| STORY-010 | Query Templates Library | P1 | 5 | 📝 Outlined | Phase 2 |
| STORY-011 | getTableRelationships Tool | P1 | 5 | 📝 Outlined | Phase 2 |
| STORY-012 | Query Caching Layer | P2 | 5 | 📝 Outlined | Phase 3 |
| STORY-013 | Pagination for Large Results | P2 | 3 | 📝 Outlined | Phase 3 |
| STORY-014 | Query History Tracking | P2 | 3 | 📝 Outlined | Phase 3 |
| STORY-015 | Data Freshness Indicators | P2 | 3 | 📝 Outlined | Phase 3 |

**Total Story Points:** 76 points (≈ 6 weeks @ 13 points/week)

---

## Phase 1: Foundation (Weeks 1-2) - 37 Points

### Critical Priority (P0)

#### ✅ STORY-001: calculateMetrics Tool (5 points)
**File:** `STORY-001_CalculateMetrics_Tool.md`
**Status:** Fully detailed, ready for implementation
**Description:** Create analytics tool for aggregations without SQL
**Dependencies:** None
**Deliverables:**
- `src/mastra/tools/analytics.tool.ts`
- Unit tests (90%+ coverage)
- Integration tests with agent
- Documentation

**Key Features:**
- Count, sum, avg, min, max, distinct metrics
- GROUP BY support
- WHERE filters
- ORDER BY and LIMIT
- Error handling and validation

---

#### STORY-002: compareData Tool (5 points)
**File:** `STORY-002_CompareData_Tool.md` (to be created)
**Description:** Compare metrics between two groups/periods
**Dependencies:** STORY-001 (shares validation logic)
**Deliverables:**
- Comparison tool in `analytics.tool.ts`
- Support time-based and entity-based comparisons
- Calculate % change and trends
- Generate insights

**Key Features:**
- Compare two filtered datasets
- Calculate difference and % change
- Trend indicators (up/down/stable)
- Auto-generate insights

**Acceptance Criteria:**
- Compare data across time periods
- Compare data across entities (contractors, projects)
- Return delta, percentage, and trend
- Execute in <3 seconds

---

#### STORY-003: rankEntities Tool (5 points)
**File:** `STORY-003_RankEntities_Tool.md` (to be created)
**Description:** Rank contractors, staff, projects by performance
**Dependencies:** STORY-001 (shares query builder)
**Deliverables:**
- Ranking tool in `analytics.tool.ts`
- Support top N and bottom N
- Calculate percentage of total
- Handle ties

**Key Features:**
- Rank by any numeric metric
- Support top/bottom rankings
- Calculate % of total
- Apply custom filters

**Acceptance Criteria:**
- Rank contractors by installations
- Rank staff by performance metrics
- Support limit (default top 10)
- Include percentage calculations

---

#### STORY-004: exportResults Tool (8 points)
**File:** `STORY-004_ExportResults_Tool.md` (to be created)
**Description:** Export query results to CSV/JSON/Excel
**Dependencies:** None (standalone)
**Deliverables:**
- `src/mastra/tools/export.tool.ts`
- CSV export with `fast-csv`
- Excel export with `exceljs`
- JSON export (native)
- File storage and cleanup
- Download URL generation

**Key Features:**
- Export to CSV, JSON, Excel
- Include metadata (query, timestamp)
- Generate download links
- Auto-cleanup after 24 hours
- Support up to 100K rows

**Acceptance Criteria:**
- Export completes in <5s for 10K rows
- Files properly formatted
- Secure download URLs
- Automatic file cleanup

**Technical Notes:**
- Store files in `/tmp/exports/`
- Use UUID filenames
- Implement cleanup cron job
- Add dependencies: `fast-csv`, `exceljs`

---

#### STORY-005: checkDataQuality Tool (8 points)
**File:** `STORY-005_CheckDataQuality_Tool.md` (to be created)
**Description:** Validate data completeness, freshness, consistency
**Dependencies:** None
**Deliverables:**
- `src/mastra/tools/quality.tool.ts`
- 6 quality checks
- Scoring algorithm
- Recommendations engine
- Quality dashboard

**Key Features:**
- Completeness check (NULL analysis)
- Freshness check (last updated)
- Consistency check (data types)
- Duplicate detection
- Outlier detection
- Referential integrity check

**Quality Checks:**
1. **Completeness:** % of NULL values per column
2. **Freshness:** Time since last update
3. **Consistency:** Data type violations
4. **Duplicates:** PK violations, duplicate rows
5. **Outliers:** Statistical outliers (>3 σ)
6. **Integrity:** Orphaned foreign keys

**Acceptance Criteria:**
- Scan all 89 tables in <30 seconds
- Generate 0-100 quality score
- Identify critical/warning/info issues
- Provide actionable recommendations

---

#### STORY-006: Error Handling & Retry Logic (3 points)
**File:** `STORY-006_Error_Handling.md` (to be created)
**Description:** Add robust error handling and retry logic
**Dependencies:** All tool stories benefit from this
**Deliverables:**
- `src/mastra/utils/retry.ts`
- `src/mastra/utils/errors.ts`
- Exponential backoff retry
- Custom error classes
- Circuit breaker pattern

**Key Features:**
- Automatic retry (3 attempts)
- Exponential backoff
- User-friendly error messages
- Error categorization
- Circuit breaker for database

**Error Types:**
```typescript
class AgentError extends Error {
  code: string;
  userMessage: string;
  severity: 'critical' | 'error' | 'warning';
  retryable: boolean;
}
```

**Acceptance Criteria:**
- 99%+ success rate for valid queries
- Clear error messages (no stack traces)
- Automatic retry for transient errors
- Circuit breaker prevents cascade failures

---

#### STORY-007: Query Performance Monitoring (3 points)
**File:** `STORY-007_Performance_Monitoring.md` (to be created)
**Description:** Log and monitor query performance
**Dependencies:** None
**Deliverables:**
- `src/mastra/utils/monitoring.ts`
- Query logging system
- Performance metrics
- Slow query alerts
- Dashboard data

**Key Features:**
- Log all queries with execution time
- Track tool usage statistics
- Identify slow queries (>5s)
- Monitor error rates
- Cache hit rates

**Metrics to Track:**
```typescript
{
  queryCount: number,
  avgExecutionTime: number,
  p95ExecutionTime: number,
  errorRate: number,
  toolUsage: Record<string, number>,
  cacheHitRate: number
}
```

**Acceptance Criteria:**
- <100ms logging overhead
- Store last 10K queries
- Generate performance reports
- Alert on degradation

---

## Phase 2: Intelligence (Weeks 3-4) - 26 Points

### High Priority (P1)

#### STORY-008: getKPIDashboard Tool (8 points)
**Description:** Return all key business metrics in one call
**Deliverables:**
- `src/mastra/tools/kpi.tool.ts`
- 20+ predefined KPIs
- Period-over-period comparison
- Trend indicators
- Dashboard formatter

**KPIs to Include:**
- Active/completed projects
- Active contractors & top performer
- Total installations
- Staff metrics
- Equipment counts
- Data quality score

#### STORY-009: analyzeTrends Tool (8 points)
**Description:** Time-series analysis and forecasting
**Deliverables:**
- `src/mastra/tools/trends.tool.ts`
- Trend direction detection
- Growth rate calculation
- Simple forecasting
- Anomaly detection

**Analysis Types:**
- Moving averages
- Linear regression
- Seasonality detection
- Anomaly identification

#### STORY-010: Query Templates Library (5 points)
**Description:** 50+ pre-built query templates
**Deliverables:**
- `src/mastra/templates/`
- Template categories
- Parameterized templates
- Template discovery
- Usage examples

**Template Categories:**
- Contractors
- Projects
- Staff
- Equipment
- Locations

#### STORY-011: getTableRelationships Tool (5 points)
**Description:** Map table relationships and foreign keys
**Deliverables:**
- `src/mastra/tools/schema.tool.ts`
- FK discovery
- Relationship graph
- JOIN suggestions
- Integrity checks

---

## Phase 3: Optimization (Weeks 5-6) - 14 Points

### Medium Priority (P2)

#### STORY-012: Query Caching Layer (5 points)
**Description:** In-memory cache for query results
**Deliverables:**
- `src/mastra/utils/cache.ts`
- LRU cache implementation
- 5-minute TTL
- Cache invalidation
- Hit rate tracking

#### STORY-013: Pagination for Large Results (3 points)
**Description:** Auto-paginate results >1000 rows
**Deliverables:**
- Pagination utility
- Page navigation
- Total count
- Bookmark URLs

#### STORY-014: Query History Tracking (3 points)
**Description:** Store and retrieve query history
**Deliverables:**
- History storage
- Search & filter
- Re-run queries
- Share functionality

#### STORY-015: Data Freshness Indicators (3 points)
**Description:** Show last updated timestamps
**Deliverables:**
- Freshness checker
- Visual indicators
- Staleness alerts
- Update frequency

---

## Development Guidelines

### Code Standards
- TypeScript strict mode
- ESLint + Prettier
- JSDoc comments for all public functions
- 90%+ test coverage for critical paths
- Follow existing code patterns

### Testing Requirements
- Unit tests: 90%+ coverage
- Integration tests: 80%+ coverage
- E2E tests for user journeys
- Performance tests for large datasets

### Documentation
- Inline code comments
- README updates
- API documentation
- Usage examples

### Review Process
1. Self-review checklist
2. Peer code review
3. QA testing
4. Performance validation
5. Documentation review

---

## Sprint Planning

### Sprint 1 (Week 1): Analytics Foundation
- STORY-001: calculateMetrics
- STORY-002: compareData
- STORY-003: rankEntities
**Total:** 15 points

### Sprint 2 (Week 2): Quality & Export
- STORY-004: exportResults
- STORY-005: checkDataQuality
- STORY-006: Error Handling
- STORY-007: Performance Monitoring
**Total:** 22 points

### Sprint 3 (Week 3): KPIs & Trends
- STORY-008: getKPIDashboard
- STORY-009: analyzeTrends
**Total:** 16 points

### Sprint 4 (Week 4): Templates & Schema
- STORY-010: Query Templates
- STORY-011: Table Relationships
**Total:** 10 points

### Sprint 5 (Week 5): Optimization Part 1
- STORY-012: Query Caching
- STORY-013: Pagination
**Total:** 8 points

### Sprint 6 (Week 6): Optimization Part 2
- STORY-014: Query History
- STORY-015: Data Freshness
- Buffer for bug fixes & polish
**Total:** 6 points

---

## Quick Start

1. **Read Planning Documents First:**
   - `01_ANALYST_REPORT.md` - Understand current state
   - `02_PRD.md` - Know what we're building
   - `03_ARCHITECTURE.md` - Technical design

2. **Start with STORY-001:**
   - Fully detailed and ready to code
   - No dependencies
   - Foundation for other analytics tools

3. **Follow Test-Driven Development:**
   - Write tests first
   - Implement to pass tests
   - Refactor for quality

4. **Deploy Incrementally:**
   - Deploy each story to dev
   - Test with real data
   - Get user feedback

---

## Success Criteria

**Phase 1 Complete When:**
- [ ] All 5 P0 tools implemented
- [ ] 90%+ test coverage achieved
- [ ] Performance targets met (<3s response)
- [ ] Error rate <1%
- [ ] Deployed to production

**Phase 2 Complete When:**
- [ ] KPI dashboard operational
- [ ] Trend analysis working
- [ ] 50+ templates available
- [ ] Schema mapping complete

**Phase 3 Complete When:**
- [ ] Caching operational (>50% hit rate)
- [ ] Pagination working for large datasets
- [ ] History tracking functional
- [ ] All optimization targets met

---

## Resources

- **Codebase:** `/opt/velocityfibre-agent/`
- **Database:** Neon PostgreSQL (89 tables)
- **Deployment:** http://72.61.166.168:8080
- **Documentation:** `/home/louisdup/Agents/mastraAgent_velocityfibreDbAgent/BMAD/`
- **Tests:** Run with `npm test`

---

**Document Status:** ✅ Ready for Development
**Last Updated:** 2025-10-28
**Next Action:** Begin STORY-001 implementation
