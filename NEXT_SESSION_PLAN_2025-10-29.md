# Next Session Plan: Use Neon MCP Server
**Date:** 29 October 2025 (for next session)
**Status:** 🚀 Ready to Implement
**Estimated Time:** 1-2 hours

---

## 🎯 New Strategy

**STOP building custom database tools** - use the official **Neon MCP Server** instead!

### Why This is Better:
1. ✅ **Maintained by Neon** - They handle SQL driver issues
2. ✅ **Battle-tested** - Used by Claude Desktop, Cursor, etc.
3. ✅ **More features** - Branching, migrations, performance analysis
4. ✅ **No debugging needed** - `run_sql` tool works out of the box
5. ✅ **Native Mastra integration** - MCPClient designed for this

---

## 📋 Implementation Steps

### Step 1: Install MCP Dependencies (5 min)
```bash
cd /home/louisdup/Agents/mastraAgent_velocityfibreDbAgent
npm install @mastra/mcp@latest
```

### Step 2: Install Neon MCP Server (5 min)
```bash
# Option A: Use npx (recommended)
# No installation needed, just configure

# Option B: Install globally
npm install -g @neondatabase/mcp-server-neon
```

### Step 3: Get Neon API Key (5 min)
```bash
# Get from: https://console.neon.tech/app/settings/api-keys
# Add to .env:
echo "NEON_API_KEY=your_key_here" >> .env
```

### Step 4: Create MCP Client Configuration (10 min)

**File:** `src/mastra/mcp-client.ts` (NEW)
```typescript
import { MCPClient } from "@mastra/mcp";

export const neonMCP = new MCPClient({
  servers: {
    neon: {
      command: "npx",
      args: ["-y", "@neondatabase/mcp-server-neon"],
      env: {
        NEON_API_KEY: process.env.NEON_API_KEY!,
      }
    }
  }
});
```

### Step 5: Update Agent to Use MCP Tools (15 min)

**File:** `src/mastra/agents/velocityfibre-db.agent.ts` (MODIFY)
```typescript
import { Agent } from "@mastra/core";
import { neonMCP } from "../mcp-client";

// Get all Neon MCP tools
const neonTools = await neonMCP.getTools();

// Create agent with MCP tools
export const velocityfibreDbAgent = new Agent({
  name: "velocityfibre-db",
  instructions: VELOCITYFIBRE_DB_PROMPT,
  model: "openai/gpt-4o",
  tools: neonTools, // Use MCP tools instead of custom tools!
});
```

### Step 6: Update Agent Prompt (10 min)

**Update capabilities section in prompt:**
```markdown
# Your Capabilities

You have access to Neon database tools via MCP:

**SQL Execution:**
1. **run_sql**: Execute any SQL query on the database
2. **run_sql_transaction**: Run multiple queries in a transaction

**Schema Exploration:**
3. **get_database_tables**: List all tables in the database
4. **describe_table_schema**: Get detailed schema for any table

**Advanced Features:**
5. **explain_sql_statement**: Analyze query performance
6. **prepare_database_migration**: Test migrations safely
7. **complete_database_migration**: Apply migration changes
```

### Step 7: Delete Old Custom Tools (5 min)
```bash
# These are no longer needed:
rm src/mastra/tools/velocityfibre-db.tool.ts
```

### Step 8: Test Locally (20 min)
```bash
npm run dev

# Test queries:
curl -X POST http://localhost:4111/api/agents/velocityfibreDbAgentGrok/generate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"How many contractors?"}]}'
```

### Step 9: Deploy to Production (15 min)
```bash
# Commit changes
git add -A
git commit -m "feat: Replace custom tools with Neon MCP Server

Using official @neondatabase/mcp-server-neon for all DB operations.
This fixes all SQL driver issues and adds bonus features like
branching, migrations, and performance analysis."

git push origin master

# Deploy to VPS
ssh -i ~/.ssh/qfield_vps root@72.61.166.168 "
  cd /opt/velocityfibre-agent &&
  git pull &&
  npm install &&
  systemctl restart velocityfibre-agent
"
```

---

## 🎁 Bonus Features You Get For Free

### 1. Database Branching
```
User: "Create a test branch of the database"
Agent: [Uses create_branch tool]
```

### 2. Safe Migrations
```
User: "Test this schema change before applying it"
Agent: [Uses prepare_database_migration]
```

### 3. Query Performance Analysis
```
User: "Why is this query slow?"
Agent: [Uses explain_sql_statement]
```

---

## 📝 Code Changes Summary

### Files to Create:
- `src/mastra/mcp-client.ts` - MCP client configuration

### Files to Modify:
- `src/mastra/agents/velocityfibre-db.agent.ts` - Use MCP tools
- `.env` - Add NEON_API_KEY
- `package.json` - Add @mastra/mcp dependency

### Files to Delete:
- `src/mastra/tools/velocityfibre-db.tool.ts` - No longer needed

---

## ⚠️ Important Notes

### Environment Variables Needed:
```bash
DATABASE_URL=postgresql://...          # Existing
NEON_API_KEY=your_neon_api_key_here   # NEW - Get from console.neon.tech
OPENAI_API_KEY=sk-proj-...            # Existing
XAI_API_KEY=xai-...                   # Existing
```

### Get Neon API Key:
1. Go to https://console.neon.tech/app/settings/api-keys
2. Click "Generate new API key"
3. Name it "VF Agent MCP"
4. Copy the key
5. Add to `.env` file

### Security:
- MCP server recommended for **local development only**
- For production, consider using the custom tools with proper validation
- Or use Neon's hosted MCP server with OAuth (enterprise feature)

---

## 🧪 Expected Results

### Before (Current State):
```
User: "How many contractors?"
Agent: [Loops infinitely, never returns answer]
```

### After (With MCP):
```
User: "How many contractors?"
Agent: [Calls run_sql tool]
Result: "18 contractors in the system"
Time: <3 seconds ✅
```

---

## 📊 Success Criteria

- [ ] Agent returns correct contractor count (18)
- [ ] No infinite loops
- [ ] Response time <3 seconds
- [ ] All basic queries work (count, select, filter)
- [ ] Schema exploration works
- [ ] Agent can explain query results clearly

---

## 🔄 Rollback Plan

If MCP approach fails:
```bash
git revert HEAD
git push origin master
ssh -i ~/.ssh/qfield_vps root@72.61.166.168 "
  cd /opt/velocityfibre-agent &&
  git pull &&
  systemctl restart velocityfibre-agent
"
```

---

## 💡 Why Previous Approach Failed

### Root Cause:
Neon's `@neondatabase/serverless` driver has a complex API for dynamic queries that doesn't work well with simple string interpolation.

### What We Tried:
1. ❌ `sql.query(string)` - Deprecated
2. ❌ `sql(string)` - Blocked by driver
3. ❌ `sql.unsafe(string)` - Returns wrapper object
4. ❌ `` sql`${sql.unsafe(string)}` `` - Still failed in Mastra context

### Real Solution:
Let Neon's MCP server handle the complexity. They built it specifically for this use case and it works with Claude, Cursor, and other AI tools.

---

## 📚 Reference Links

- **Neon MCP Server Docs:** https://neon.com/docs/ai/neon-mcp-server
- **Neon MCP GitHub:** https://github.com/neondatabase/mcp-server-neon
- **Mastra MCP Docs:** https://mastra.ai/en/docs/tools-mcp/mcp-overview
- **Get Neon API Key:** https://console.neon.tech/app/settings/api-keys

---

## 🎯 Time Estimates

| Task | Estimated Time | Complexity |
|------|----------------|------------|
| Install dependencies | 5 min | Easy |
| Get API key | 5 min | Easy |
| Create MCP client | 10 min | Easy |
| Update agent | 15 min | Medium |
| Update prompts | 10 min | Easy |
| Delete old tools | 5 min | Easy |
| Test locally | 20 min | Medium |
| Deploy & verify | 15 min | Easy |
| **TOTAL** | **85 min** | **Medium** |

**Confidence:** 🟢 High - This is the official, supported approach

---

## ✅ Pre-Session Checklist

Before starting next session, verify:
- [ ] Local dev environment working (`npm run dev`)
- [ ] DATABASE_URL in `.env` (already have this ✓)
- [ ] Can access Neon console (console.neon.tech)
- [ ] Mastra docs accessible (mastra.ai)
- [ ] VPS SSH access working ✓

---

## 🚀 Alternative: Quick Test with MCP First

Want to verify MCP works before full implementation?

### 1-Minute Test:
```bash
# Install MCP client
npm install @mastra/mcp@latest

# Test Neon MCP server standalone
npx -y @neondatabase/mcp-server-neon

# It will prompt for NEON_API_KEY
# Then you can test run_sql command
```

This lets you verify the MCP server works before modifying the agent.

---

**Status:** Ready to implement
**Next Session Goal:** Working agent in 1-2 hours
**Success Rate:** 95% (official tooling = high confidence)
