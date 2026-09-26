# Database Architecture & Data Modeling (docs/database.md) — Architecture V2

## 1. Overview & Storage Topology

The **Legal Intelligence Platform** employs **PostgreSQL 16** with the **`pgvector`** extension as its unified primary relational and semantic vector store, combined with **Redis 7** for job queues (BullMQ) and sub-millisecond semantic caching.

Architecture V2 establishes strict, 100% field consistency with all API contracts, introduces jurisdiction and contract-family dimensions, models interactive Q&A history, tracks token consumption and latency metrics, and maintains a zero-dependency in-memory fallback.

---

## 2. Relational & Vector Schema (DDL)

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- 1. DOCUMENTS TABLE
-- Stores uploaded contracts, processing states, executive summaries, and telemetry
-- ============================================================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    content_hash VARCHAR(64) NOT NULL, -- SHA-256 of raw file buffer
    raw_text TEXT,
    document_type VARCHAR(50) DEFAULT 'general_contract', -- general_contract, nda, employment, lease, saas_msa
    jurisdiction VARCHAR(50) DEFAULT 'General Commercial', -- General Commercial, US-General, US-CA, US-NY, UK, India
    status VARCHAR(30) NOT NULL DEFAULT 'uploaded', -- uploaded, queued, processing, analyzed, failed
    error_message TEXT,
    is_scanned BOOLEAN DEFAULT false,
    
    -- Analysis Synthesis
    total_clauses INTEGER DEFAULT 0,
    standard_count INTEGER DEFAULT 0,
    caution_count INTEGER DEFAULT 0,
    unfavorable_count INTEGER DEFAULT 0,
    overall_risk_score NUMERIC(3, 2) DEFAULT 0.00, -- 0.00 (low) to 1.00 (critical)
    executive_summary TEXT,
    key_findings JSONB DEFAULT '[]'::jsonb, -- Array of string summaries
    
    -- Observability & Cost Telemetry
    total_prompt_tokens INTEGER DEFAULT 0,
    total_completion_tokens INTEGER DEFAULT 0,
    estimated_cost_usd NUMERIC(6, 4) DEFAULT 0.0000,
    processing_latency_ms INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_documents_content_hash ON documents(content_hash);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_jurisdiction ON documents(jurisdiction);

-- ============================================================================
-- 2. BENCHMARK_CLAUSES TABLE
-- Curated market-standard reference clauses partitioned by family and jurisdiction
-- ============================================================================
CREATE TABLE benchmark_clauses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(80) NOT NULL, -- Indemnification, Limitation of Liability, Termination, etc.
    contract_family VARCHAR(50) DEFAULT 'general', -- general, nda, employment, lease, saas_msa
    jurisdiction VARCHAR(50) DEFAULT 'General Commercial', -- General Commercial, US-General, US-CA, UK, India
    title VARCHAR(150) NOT NULL,
    standard_text TEXT NOT NULL,
    plain_explanation TEXT NOT NULL,
    risk_baseline VARCHAR(20) DEFAULT 'Standard',
    is_active BOOLEAN DEFAULT true,
    embedding vector(768), -- Dense representation via text-embedding-004
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_benchmark_clauses_category ON benchmark_clauses(category);
CREATE INDEX idx_benchmark_clauses_filter ON benchmark_clauses(category, contract_family, jurisdiction);

-- HNSW Index for ultra-fast vector retrieval
CREATE INDEX idx_benchmark_clauses_embedding_hnsw 
ON benchmark_clauses 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- 3. CLAUSES TABLE
-- Parsed clauses extracted from uploaded contracts
-- ============================================================================
CREATE TABLE clauses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    clause_index INTEGER NOT NULL,
    section_number VARCHAR(50),
    title VARCHAR(200),
    raw_text TEXT NOT NULL,
    tokenized_text TEXT NOT NULL, -- Text with entities tokenized: {{PARTY_A}}
    sha256 VARCHAR(64) NOT NULL,
    category VARCHAR(80),
    risk_level VARCHAR(20) DEFAULT 'Standard', -- Standard, Caution, Unfavorable
    confidence_score NUMERIC(3, 2) DEFAULT 0.00,
    deviation_summary TEXT,
    risk_factors JSONB DEFAULT '[]'::jsonb,
    is_novel_clause BOOLEAN DEFAULT false,
    matched_benchmark_id UUID REFERENCES benchmark_clauses(id) ON DELETE SET NULL,
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_clauses_document_id ON clauses(document_id);
CREATE INDEX idx_clauses_sha256 ON clauses(sha256);
CREATE INDEX idx_clauses_risk_level ON clauses(risk_level);

-- HNSW Index for in-document RAG search (used by LegalInquiryAgent)
CREATE INDEX idx_clauses_embedding_hnsw 
ON clauses 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- 4. CLAUSE_BENCHMARKS TABLE
-- Detailed nearest-neighbor scores and rankings for audited clauses
-- ============================================================================
CREATE TABLE clause_benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clause_id UUID NOT NULL REFERENCES clauses(id) ON DELETE CASCADE,
    benchmark_id UUID NOT NULL REFERENCES benchmark_clauses(id) ON DELETE CASCADE,
    cosine_similarity NUMERIC(5, 4) NOT NULL,
    rank INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_clause_benchmark_rank UNIQUE (clause_id, rank)
);

CREATE INDEX idx_clause_benchmarks_clause ON clause_benchmarks(clause_id);

-- ============================================================================
-- 5. COUNTER_DRAFTS TABLE
-- Educational sample substitute language for Caution and Unfavorable clauses
-- ============================================================================
CREATE TABLE counter_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clause_id UUID NOT NULL REFERENCES clauses(id) ON DELETE CASCADE,
    proposed_text TEXT NOT NULL,
    key_modifications JSONB NOT NULL DEFAULT '[]'::jsonb,
    negotiation_talking_point TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'generated', -- generated, copied, exported
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_counter_drafts_clause_id ON counter_drafts(clause_id);

-- ============================================================================
-- 6. GOTCHAS TABLE
-- High-impact "Before You Sign" executive warning cards
-- ============================================================================
CREATE TABLE gotchas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL, -- 1 = highest risk
    title VARCHAR(200) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- Critical, High, Moderate
    impact_description TEXT NOT NULL,
    plain_english_advice TEXT NOT NULL,
    related_clause_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_gotchas_document_id ON gotchas(document_id);

-- ============================================================================
-- 7. CHECKLISTS TABLE
-- Actionable pre-signing operational verification points
-- ============================================================================
CREATE TABLE checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL,
    item TEXT NOT NULL,
    category VARCHAR(80) NOT NULL,
    status VARCHAR(30) DEFAULT 'Action Required', -- Action Required, Verified, Optional
    impact_rationale TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_checklists_document_id ON checklists(document_id);

-- ============================================================================
-- 8. ATTORNEY_BRIEFS TABLE
-- Specific, high-yield questions for users to present to licensed counsel
-- ============================================================================
CREATE TABLE attorney_briefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL,
    clause_ref VARCHAR(150) NOT NULL,
    question TEXT NOT NULL,
    context_summary TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_attorney_briefs_document_id ON attorney_briefs(document_id);

-- ============================================================================
-- 9. DOCUMENT_QAS TABLE
-- Conversational Q&A audit history for the LegalInquiryAgent
-- ============================================================================
CREATE TABLE document_qas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    grounding_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    suggested_follow_ups JSONB DEFAULT '[]'::jsonb,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_document_qas_document_id ON document_qas(document_id);
```

---

## 3. Authoritative Redis Key Schema & TTL Policies

| Key Pattern | Type | Value Payload | TTL | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `cache:emb:v2:<model_id>:<task_type>:<text_sha256>` | String | Serialized Float32 Array (`[768]`) | 30 Days | Avoids re-computing embeddings for identical text |
| `cache:eval:v2:<model_id>:<prompt_v>:<bench_hash>:<clause_sha256>` | String | Serialized Risk Evaluation JSON | 14 Days | Caches semantic delta evaluations with auto-invalidation |
| `rate:ip:<ip_address>` | Integer | Request counter | 60 Sec | Gateway rate limiting (60 RPM) |
| `doc:status:<document_id>` | Hash | `{status, progress, total, current}` | 2 Hours | Real-time frontend progress tracking |
| `bull:contract-analysis-queue:*` | Hash/ZSet | BullMQ job metadata & queue states | BullMQ Managed | Asynchronous worker coordination |

---

## 4. In-Memory Resilient Fallback Specification

When `USE_IN_MEMORY_FALLBACK=true` (for zero-dependency local runs or CI pipelines):
1. **In-Memory Cache Provider**: An LRU cache (capped at 5,000 items) fulfills all `cache:*` requests with exact TTL expirations.
2. **In-Memory Vector Search Provider**: Maintains seeded benchmark vectors in memory and computes cosine distance via unit dot products in pure TypeScript.
3. **In-Memory Job Dispatcher**: Executes queued jobs sequentially via Node.js `EventEmitter` if Redis is unreachable.
