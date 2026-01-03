# KVR - KeyVault Registry

Application for managing resources (HTTP APIs, Databases, etc.) and API Keys, extracted from OrchestratorAI.

## Features

- **Resource Registry**: Manage HTTP APIs, Databases, Files, and other resources
  - DEV/PRD environment separation
  - Health checks and connectivity tests
  - Promotion workflow (DEV -> PRD)

- **API Keys**: Manage API keys for external integrations
  - Scope-based permissions
  - Rate limiting
  - Usage statistics

- **Authentication**: Dual mode authentication
  - Local JWT authentication
  - TAH (Tenant Access Hub) SSO integration

## Tech Stack

### Backend
- Node.js + Express
- Prisma ORM
- PostgreSQL (shared with OrchestratorAI)
- JWT Authentication

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS + Shadcn/UI
- TanStack Query
- Zustand

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (shared with OrchestratorAI)

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your database URL and secrets
# DATABASE_URL should point to the same database as OrchestratorAI

# Generate Prisma client (DO NOT run migrations)
npm run prisma:generate

# Start development server
npm run dev
```

The backend will start on port 4000.

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

The frontend will start on port 5173.

## API Endpoints

### Health
- `GET /api/v1/health` - Health check
- `GET /api/v1/health/ready` - Readiness check
- `GET /api/v1/health/live` - Liveness check

### Auth
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Get current user

### Resources
- `GET /api/v1/resources` - List resources
- `GET /api/v1/resources/:id` - Get resource
- `POST /api/v1/resources` - Create resource
- `PUT /api/v1/resources/:id` - Update resource
- `DELETE /api/v1/resources/:id` - Delete resource
- `POST /api/v1/resources/:id/test` - Test resource
- `POST /api/v1/resources/:id/promote` - Request promotion
- `POST /api/v1/resources/:id/approve` - Approve promotion
- `POST /api/v1/resources/:id/reject` - Reject promotion

### API Keys
- `GET /api/v1/api-keys` - List API keys
- `GET /api/v1/api-keys/:id` - Get API key
- `POST /api/v1/api-keys` - Create API key
- `PATCH /api/v1/api-keys/:id` - Update API key
- `DELETE /api/v1/api-keys/:id` - Delete API key
- `POST /api/v1/api-keys/:id/regenerate` - Regenerate key
- `GET /api/v1/api-keys/:id/stats` - Get usage stats
- `GET /api/v1/api-keys/scopes/list` - List available scopes

## Environment Variables

### Backend

```env
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/orchestrator_db
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
AUTH_MODE=dual
TAH_ENABLED=true
TAH_ISSUER=https://tah.yourdomain.com
TAH_JWKS_URL=https://tah.yourdomain.com/.well-known/jwks.json
TAH_AUDIENCE=kvr
TAH_APP_ID=kvr
CORS_ORIGIN=http://localhost:5173
```

### Frontend

```env
VITE_API_URL=http://localhost:4000/api/v1
```

## Important Notes

1. **Shared Database**: KVR uses the same PostgreSQL database as OrchestratorAI. Do NOT run Prisma migrations - only use `prisma generate`.

2. **Multi-tenancy**: All queries are filtered by orgId for tenant isolation.

3. **Security**: API keys are hashed before storage. The raw key is only shown once at creation time.
