# Testing Strategy

## Overview
The Legal Intelligence Platform employs a robust testing strategy combining integration tests (using Vitest and Supertest) on the backend, and component/behavioral tests (using Vitest and React Testing Library) on the frontend.

## Backend Testing
**Tooling**: Vitest, Supertest

### Test Suites
1. **Document API (`documentApi.test.ts`)**:
   - Covers ingestion: `POST /api/documents`.
   - Validates file size limits, MIME type enforcement, and magic byte validation.
   - Tests idempotency and queue failure recovery.
2. **Read API (`documentReadApi.test.ts`)**:
   - Covers all Wave 3C endpoints.
   - Mocks the DB repository to simulate rows being returned and mapped into canonical domain shapes.
3. **Interactive API (`interactiveApi.test.ts`)**:
   - Covers Wave 3D endpoints: Counter-drafting and Q&A.
   - Validates Zod ID parsing, empty/missing parameters, and interaction with the AI Services.
4. **Worker & Orchestrator (`analysisWorker.test.ts`, `analysisOrchestrator.test.ts`)**:
   - Tests the end-to-end pipeline execution from segmentation to synthesis.

## Frontend Testing
**Tooling**: Vitest, React Testing Library, jsdom

### Test Suites
1. **App component (`App.test.tsx`)**:
   - Tests UI view transitions (upload → processing → overview).
   - Validates client-side file size and type rejection.
   - Tests mock-based interaction (selecting a clause, expanding Q&A).
   - Ensures native HTML escaping (XSS prevention) works properly.

## Execution
Run from the repository root (or within respective directories):
```bash
npm --prefix backend run test
npm --prefix frontend run test
```
