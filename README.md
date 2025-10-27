# VelocityFibre Database Agent

An intelligent AI agent that provides deep insights and knowledge about VelocityFibre's project management database for fibre installation operations.

## Features

- **Database Overview**: Get comprehensive views of all tables and their data
- **Schema Analysis**: Examine table structures and relationships
- **Custom Queries**: Execute SQL queries for data retrieval and analysis
- **Intelligent Insights**: Generate actionable insights from operational data
- **Multi-Model Support**: Choose between OpenAI GPT-4o or xAI Grok

## Agents

### 1. velocityfibreDbAgent (OpenAI GPT-4o)
High-quality analysis using OpenAI's GPT-4o model.

### 2. velocityfibreDbAgentGrok (xAI Grok-2-1212)
Fast, efficient analysis using xAI's Grok model.

## Database Access

The agent connects to VelocityFibre's Neon PostgreSQL database containing:
- **88 tables** with project management data
- **87,818+ rows** of operational information
- Project tracking, installations, staff, contractors, inventory, and more

## Setup

### Prerequisites
- Node.js 18+
- npm or pnpm
- VelocityFibre Neon database credentials
- OpenAI API key (for GPT-4o agent) or xAI API key (for Grok agent)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/VelocityFibre/mastraAgent_velocityfibreDbAgent.git
cd mastraAgent_velocityfibreDbAgent
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add:
- `DATABASE_URL`: Your VelocityFibre Neon database connection string
- `OPENAI_API_KEY`: Your OpenAI API key (if using GPT-4o)
- `XAI_API_KEY`: Your xAI API key (if using Grok)

### Development

Run the agent locally:
```bash
npm run dev
```

Access the playground at: http://localhost:4111/

### Build for Production

```bash
npm run build
```

### Deploy to Railway

1. Create a new project in Railway
2. Connect this GitHub repository
3. Add environment variables:
   - `DATABASE_URL`
   - `OPENAI_API_KEY` or `XAI_API_KEY`
4. Railway will automatically deploy using the start script

## Usage

### Available Tools

The agent has access to:
- `getDatabaseOverview`: List all tables with row counts
- `listTables`: Get all table names
- `getTableSchema`: View table structure and columns
- `getTableStats`: Get statistics and sample data
- `runQuery`: Execute custom SQL queries (SELECT only)

### Example Queries

- "How many projects are in the database?"
- "Show me the schema of the staff table"
- "What are the top 10 contractors by installations?"
- "Analyze technician productivity trends"
- "Give me an overview of all tables"

## Architecture

- **Framework**: Mastra AI Agent Framework
- **Database**: Neon PostgreSQL (Serverless)
- **Models**: OpenAI GPT-4o / xAI Grok-2-1212
- **Memory**: LibSQL for conversation history
- **Deployment**: Railway-ready

## License

MIT
