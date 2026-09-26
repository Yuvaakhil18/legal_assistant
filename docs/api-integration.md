# API Integration Guide

## Overview

The Legal Intelligence Platform uses a RESTful API architecture. The frontend communicates with the backend via `fetch` wrapped in a custom client (`ApiClient`). All data exchange is JSON.

## Authentication & Security
- Currently designed for internal or single-tenant usage. Authentication will be implemented at the API Gateway layer (Wave 4).
- Request correlation is handled via the `x-request-id` header.
- **Mandatory Disclaimer**: All API error responses include a `disclaimer` field enforcing that the platform provides informational analysis, not legal advice.

## API Endpoints

### 1. Document Ingestion
`POST /api/documents`
- Accepts `multipart/form-data` with a single file (PDF or TXT, max 10MB).
- Returns: `{ document_id, job_id, status }`

### 2. Processing Status
`GET /api/documents/:documentId`
- Polled by the frontend to determine analysis progress.
- Returns: `{ document_id, filename, document_type, jurisdiction, status, created_at }`
- Status transitions: `uploaded` → `queued` → `processing` → `analyzed` (or `failed`)

### 3. Read Endpoints (Analysis Results)
- `GET /api/documents/:documentId/overview`: Gets overall status, risk counts, and executive summary.
- `GET /api/documents/:documentId/clauses`: Returns paginated clauses with embedded risk assessments.
- `GET /api/documents/:documentId/clauses/:clauseId`: Returns clause details, including matched benchmarks.
- `GET /api/documents/:documentId/gotchas`: Returns prioritized gotchas (critical risks).
- `GET /api/documents/:documentId/checklist`: Returns the actionable pre-signing checklist.
- `GET /api/documents/:documentId/brief`: Returns the consolidated attorney consultation brief.

### 4. Interactive Endpoints
- `POST /api/documents/:documentId/clauses/:clauseId/counter-draft`: Generates educational sample alternative text for an unfavorable clause.
- `POST /api/documents/:documentId/query`: Conversational Q&A grounded exclusively in the document's text.

## Frontend Client Architecture
- Resides in `frontend/src/api/client.ts`.
- Uses a `fetchWithHandler` utility to standardize error parsing and response unwrapping.
- API Errors are thrown as `ApiError` instances containing the backend's standard error code (e.g., `VALIDATION_FAILED`, `DOCUMENT_NOT_FOUND`).
