-- ============================================================================
-- Migration 001: Initial Relational and Vector Schema (Architecture V2)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    raw_text TEXT,
    document_type VARCHAR(50) DEFAULT 'general_contract',
    jurisdiction VARCHAR(50) DEFAULT 'General Commercial',
    status VARCHAR(30) NOT NULL DEFAULT 'uploaded',
    error_message TEXT,
    is_scanned BOOLEAN DEFAULT false,
    
    total_clauses INTEGER DEFAULT 0,
    standard_count INTEGER DEFAULT 0,
    caution_count INTEGER DEFAULT 0,
    unfavorable_count INTEGER DEFAULT 0,
    overall_risk_score NUMERIC(3, 2) DEFAULT 0.00,
    executive_summary TEXT,
    key_findings JSONB DEFAULT '[]'::jsonb,
    
    total_prompt_tokens INTEGER DEFAULT 0,
    total_completion_tokens INTEGER DEFAULT 0,
    estimated_cost_usd NUMERIC(6, 4) DEFAULT 0.0000,
    processing_latency_ms INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_jurisdiction ON documents(jurisdiction);

-- 2. BENCHMARK_CLAUSES TABLE
CREATE TABLE IF NOT EXISTS benchmark_clauses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(80) NOT NULL,
    contract_family VARCHAR(50) DEFAULT 'general',
    jurisdiction VARCHAR(50) DEFAULT 'General Commercial',
    title VARCHAR(150) NOT NULL,
    standard_text TEXT NOT NULL,
    plain_explanation TEXT NOT NULL,
    risk_baseline VARCHAR(20) DEFAULT 'Standard',
    is_active BOOLEAN DEFAULT true,
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_clauses_category ON benchmark_clauses(category);
CREATE INDEX IF NOT EXISTS idx_benchmark_clauses_filter ON benchmark_clauses(category, contract_family, jurisdiction);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_benchmark_clauses_embedding_hnsw') THEN
        CREATE INDEX idx_benchmark_clauses_embedding_hnsw 
        ON benchmark_clauses 
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    END IF;
END $$;

-- 3. CLAUSES TABLE
CREATE TABLE IF NOT EXISTS clauses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    clause_index INTEGER NOT NULL,
    section_number VARCHAR(50),
    title VARCHAR(200),
    raw_text TEXT NOT NULL,
    tokenized_text TEXT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    category VARCHAR(80),
    risk_level VARCHAR(20) DEFAULT 'Standard',
    confidence_score NUMERIC(3, 2) DEFAULT 0.00,
    deviation_summary TEXT,
    risk_factors JSONB DEFAULT '[]'::jsonb,
    is_novel_clause BOOLEAN DEFAULT false,
    matched_benchmark_id UUID REFERENCES benchmark_clauses(id) ON DELETE SET NULL,
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clauses_document_id ON clauses(document_id);
CREATE INDEX IF NOT EXISTS idx_clauses_sha256 ON clauses(sha256);
CREATE INDEX IF NOT EXISTS idx_clauses_risk_level ON clauses(risk_level);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_clauses_embedding_hnsw') THEN
        CREATE INDEX idx_clauses_embedding_hnsw 
        ON clauses 
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    END IF;
END $$;

-- 4. CLAUSE_BENCHMARKS TABLE
CREATE TABLE IF NOT EXISTS clause_benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clause_id UUID NOT NULL REFERENCES clauses(id) ON DELETE CASCADE,
    benchmark_id UUID NOT NULL REFERENCES benchmark_clauses(id) ON DELETE CASCADE,
    cosine_similarity NUMERIC(5, 4) NOT NULL,
    rank INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_clause_benchmark_rank UNIQUE (clause_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_clause_benchmarks_clause ON clause_benchmarks(clause_id);

-- 5. COUNTER_DRAFTS TABLE
CREATE TABLE IF NOT EXISTS counter_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clause_id UUID NOT NULL REFERENCES clauses(id) ON DELETE CASCADE,
    proposed_text TEXT NOT NULL,
    key_modifications JSONB NOT NULL DEFAULT '[]'::jsonb,
    negotiation_talking_point TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'generated',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counter_drafts_clause_id ON counter_drafts(clause_id);

-- 6. GOTCHAS TABLE
CREATE TABLE IF NOT EXISTS gotchas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    impact_description TEXT NOT NULL,
    plain_english_advice TEXT NOT NULL,
    related_clause_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gotchas_document_id ON gotchas(document_id);

-- 7. CHECKLISTS TABLE
CREATE TABLE IF NOT EXISTS checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL,
    item TEXT NOT NULL,
    category VARCHAR(80) NOT NULL,
    status VARCHAR(30) DEFAULT 'Action Required',
    impact_rationale TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklists_document_id ON checklists(document_id);

-- 8. ATTORNEY_BRIEFS TABLE
CREATE TABLE IF NOT EXISTS attorney_briefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL,
    clause_ref VARCHAR(150) NOT NULL,
    question TEXT NOT NULL,
    context_summary TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attorney_briefs_document_id ON attorney_briefs(document_id);

-- 9. DOCUMENT_QAS TABLE
CREATE TABLE IF NOT EXISTS document_qas (
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

CREATE INDEX IF NOT EXISTS idx_document_qas_document_id ON document_qas(document_id);
