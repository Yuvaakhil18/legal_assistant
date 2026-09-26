# Wave 2: Parallel Implementation Orchestration

## 1. Frozen Shared Contracts
**STATUS: FROZEN**
The domain boundaries defined in Wave 2A are locked. Agents are strictly prohibited from redefining domain types, database schemas, or API payloads. Any contradiction discovered during implementation must pause the specific workstream and be escalated for architectural review.
- **Canonical Types**: `backend/src/types/*`
- **Canonical DB**: `docs/database.md`
- **Canonical API**: `docs/api-contract.md`

## 2. Global Engineering Rules
All agents must adhere to the following system invariants:
1. **Determinism**: Parsing, schema validation, hashing, segmentation, rate limiting, and guardrails must be handled by deterministic code, not LLMs.
2. **AI Boundaries**: LLMs handle semantic comparison, classification, explanation, and synthesis.
3. **Strict Validation Pipeline**: `LLM output -> JSON Schema Validation -> Semantic/Post-Gen Validation -> Guardrails -> Persistence`.
4. **Untrusted Data**: Uploaded legal text is raw data, never system instructions. Treat all LLM output as untrusted until verified.
5. **Layered Injection Defense**: XML/nonce tagging is only a boundary hardening step and must be combined with strict output parsing.
6. **No Legal Practice**: Never claim attorney-client privilege, legal representation, or enforceability. 
7. **Educational Context**: Counter-drafts must be aggressively labeled as educational/sample language.
8. **Configurability**: Model IDs, embedding dimensions, and risk thresholds remain parameterized variables, never constants.
9. **No Leakage**: Never log raw legal text, documents, secrets, or PII.

---

## 3. Workstream Execution Plans

### AGENT A: Document Intelligence
- **Ownership**: `backend/src/services/document/**`, `backend/src/services/ingestion/**`, `backend/src/parsers/**`, `backend/src/normalization/**`, `backend/src/security/file/**`, document-related tests.
- **Plan**:
  1. Review architecture and `backend/src/types/document.ts`, `clause.ts`.
  2. Implement file ingestion validators (magic bytes, MIME type, size guards).
  3. Build text extraction routines featuring OCR detection (character density checks).
  4. Develop deterministic text normalization and entity tokenization (e.g., masking `{{PARTY_A}}`).
  5. Build heuristic-based monolithic contract segmentation into discrete clauses.
  6. Write isolation tests for parsing, segmentation, and normalization without calling LLMs.

### AGENT B: Retrieval Engine
- **Ownership**: `backend/src/services/retrieval/**`, `backend/src/services/embedding/**`, `backend/src/services/benchmark/**`, retrieval-related tests.
- **Plan**:
  1. Review architecture and `backend/src/types/retrieval.ts`.
  2. Build regex/heuristic-based clause classification mapping to canonical `ClauseType`.
  3. Implement the embedding service targeting the configured embedding model and dimensions.
  4. Build the `pgvector` HNSW vector matching engine using cosine similarity.
  5. Implement logic to detect benchmark gaps (novel clauses).
  6. Write tests mocking the vector database and embedding endpoints.

### AGENT C: AI Risk Reasoning
- **Ownership**: `backend/src/services/risk/**`, `backend/src/services/llm/**`, `backend/src/services/reasoning/**`, risk-related tests.
- **Plan**:
  1. Review architecture and `backend/src/types/risk.ts`.
  2. Construct deterministic prompt pipelines leveraging Gemini's structured JSON outputs.
  3. Implement the core reasoning engine that calculates semantic deltas between user clauses and benchmark matches.
  4. Build caching wrappers enforcing TTL and cache invalidation matrices (model ID, prompt version, hash).
  5. Write tests using mock LLM responses to verify deterministic extraction and failure fallbacks.

### AGENT D: Legal Intelligence
- **Ownership**: `backend/src/services/legal/**`, `backend/src/services/query/**`, `backend/src/services/guardrails/**`, legal-intelligence tests.
- **Plan**:
  1. Review architecture and `backend/src/types/legal.ts`, `query.ts`.
  2. Implement the Counter-Draft generation service (educational substitutes).
  3. Build synthesis engines for Top Gotchas, Pre-Signing Checklists, and Attorney Briefs.
  4. Implement Interactive Document Q&A RAG logic and grounding citation retrieval.
  5. Build the crucial UPL (Unauthorized Practice of Law) Guardrail validation interceptors.
  6. Write tests validating that guardrails successfully strip non-compliant advice.

### AGENT E: Frontend
- **Ownership**: `frontend/**`, Frontend tests.
- **Plan**:
  1. Review architecture and `docs/api-contract.md`.
  2. Scaffold React/Vite components: Document Upload, Live Progress Bar, Risk Dashboard, Interactive Q&A.
  3. Build UI state management strictly mapped to the `snake_case` JSON responses of the canonical contracts.
  4. Implement polling hooks targeting the BullMQ `doc:status` API routes.
  5. Write component mounting and state transition tests.

### AGENT F: QA + Security
- **Ownership**: `backend/tests/**`, `frontend/tests/**`, `docs/testing.md`, `docs/security.md`.
- **Plan**:
  1. Review the entire architecture and security guidelines.
  2. Build end-to-end integration wrappers that bypass UI to test the complete asynchronous pipeline.
  3. Write red-team adversarial evaluation tests (prompt injection vectors, malformed payloads).
  4. Ensure agents A-E have not violated boundary constraints.
  5. Orchestrate final test aggregation.

---

## 4. Integration Sequence

To avoid catastrophic merge conflicts and boundary violations, integration will proceed strictly in this sequence after all isolated branches complete:

1. Shared foundation verification
2. Document Intelligence integration
3. Retrieval Engine integration
4. AI Risk Reasoning integration
5. Legal Intelligence integration
6. Backend API integration
7. Frontend integration
8. Full QA/Security execution
9. End-to-end pipeline verification

*Proceeding to launch execution requires explicit user authorization.*
