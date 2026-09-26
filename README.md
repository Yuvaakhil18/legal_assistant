# Legal Intelligence Platform ⚖️

> **Next-Generation Contract Risk Auditing & Automated Counter-Drafting Platform**  
> *Empowering freelancers, contractors, tenants, and small businesses to negotiate agreements with confidence.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_(pgvector)-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Google Gemini](https://img.shields.io/badge/AI-Google_Gemini_1.5_Flash-8E75C2?style=flat-square&logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![Tests](https://img.shields.io/badge/Tests-80%20Passing-success?style=flat-square)](https://vitest.dev/)

---

> [!IMPORTANT]  
> **Informational Purposes Only — Not Legal Advice**  
> This platform generates automated clause breakdowns, risk indicators, and counter-proposals for educational and informational review. It does not provide legal representation or attorney-client privilege. Always consult a licensed legal professional before executing legal agreements.

---

## 🎯 Problem Statement Alignment

### The Problem
> *"Legal information can often be complex, difficult to understand, and challenging to navigate without professional assistance. Build a GenAI-powered solution that makes legal information and basic legal assistance more accessible by helping users understand, compare, and navigate legal documents and information."*

### How The Legal Intelligence Platform Solves the Problem
This platform targets the severe information asymmetry that non-lawyers face when presented with standard contracts. Rather than acting as another generic Q&A chat wrapper, this is purpose-built as an **automated contract risk auditor and counter-drafting assistant**.

| Feature | Direct Solution | Implementation Details |
| :--- | :--- | :--- |
| **Simplifying complex legal documents** | Automatically segments dense, intimidating contracts into discrete, categorized clauses accompanied by plain-English explanations. | PDF segmentation, 7-Agent Topology |
| **Comparing contracts & agreements** | Measures clause deviations against market-standard benchmark clauses using **pgvector HNSW cosine similarity** (`vector(768)`). | `RetrievalAgent`, pgvector HNSW indexing |
| **Highlighting important risks & inconsistencies** | Triages clauses into non-color-only risk tiers: **Standard** (fair), **Caution** (deviation), and **Unfavorable** (predatory terms like unilateral indemnities or unlimited liabilities). | `RiskAuditorAgent`, Gemini Structured Outputs |
| **Generating actionable outputs & summaries** | Synthesizes an executive **"Top Gotchas"** report translating critical liabilities, payment delays, and non-competes into accessible language. | `GotchasAgent`, Dashboard Overview |
| **Helping users understand options & next steps** | Generates **ready-to-send counter-drafts** with written legal justifications that users can copy directly into negotiation emails. | `CounterDraftAgent`, Interactive Clause Explorer |
| **Providing interactive legal Q&A** | Allows users to ask conversational questions about their contract and receive grounded, cited answers linked directly to extracted clauses. | `LegalInquiryAgent`, Retrieval-Augmented Generation (RAG) |

---

## 🌟 Overview

Contracts are intentionally written in dense, one-sided legalese that disadvantage freelancers, tenants, and independent professionals. Hidden traps—such as unilateral indemnification, perpetual non-competes, subjective payment withholding, and broad IP assignments—frequently slip through unnoticed.

The **Legal Intelligence Platform** bridges this asymmetry. Users upload any contract (`.pdf`), and the system's asynchronous, multi-agent AI pipeline parses the document, analyzes its clauses, and delivers a robust, educational audit.

The system is built upon **Architecture V2**:
- **7-Agent Topology**: Coordinated ensemble of specialized domain agents (`IngestionAgent`, `RetrievalAgent`, `RiskAuditorAgent`, `CounterDraftAgent`, `GotchasAgent`, `GuardrailAgent`, `LegalInquiryAgent`).
- **Asynchronous Queue**: Powered by **BullMQ + Redis 7** (`contract-analysis-queue`) with exponential backoff and dead-letter queue routing (`contract-analysis-dlq`).
- **Dual-Tier Retrieval**: Category pre-filtering followed by **`pgvector` HNSW** cosine retrieval across market benchmark clauses.
- **Resilient Fallback Mode**: Automatic in-memory LRU cache and vector search for zero-dependency local runs and CI testing.

---

## 🛡️ Security & Privacy Engineering

- **Layered Prompt Injection Defense**: Cryptographic UUID nonces (`<user_contract_clause nonce="...">`), tag escaping, system role anchoring, and runtime Zod validation.
- **Deterministic Entity Tokenization**: Signer identities and names are mapped to ephemeral tokens (`{{PARTY_A}}`, `{{PARTY_B}}`) in memory during analysis, preserving utility while keeping PII out of disk logs.
- **Scanned Document Detection**: Flags image-only scans early with `DOCUMENT_REQUIRES_OCR`.
- **Zero Raw Contract Logging**: Application logs omit raw legal text and sensitive information.

---

## 🚀 Quickstart Guide

### Prerequisites
- [Node.js](https://nodejs.org/) v20+ or v22+
- `npm` or `pnpm`
- *(Optional)* [Docker & Docker Compose](https://www.docker.com/) for PostgreSQL + pgvector and Redis.

### Step 1: Clone & Configure Environment

```bash
# Copy environment configuration
cp .env.example .env
cp .env.example backend/.env
```

### Step 2: (Optional) Start Infrastructure Containers

If you have Docker installed, launch PostgreSQL with `pgvector` and Redis:
```bash
docker compose up -d
```
*Note: If Docker is not running, the application automatically activates **Resilient In-Memory Fallback Mode** (`USE_IN_MEMORY_FALLBACK=true`), allowing full development and testing without containers.*

### Step 3: Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

### Step 4: Run Database Migrations

```bash
cd backend
npm run migrate
```
*(If the database is unreachable and fallback is enabled, the migration runner gracefully reports simulated in-memory migration).*

### Step 5: Start the Development Servers

#### Terminal 1 — Backend API Server:
```bash
cd backend
npm run dev
```
*Server starts on [http://localhost:3000](http://localhost:3000).*  

#### Terminal 2 — Frontend Client:
```bash
cd frontend
npm run dev
```
*Application opens on [http://localhost:5173](http://localhost:5173).*

---

## 🧪 Testing & Verification

The backend includes a comprehensive Vitest testing harness:

```bash
cd backend

# Run the complete test suite (80/80 passing)
npm test

# Run isolated unit tests
npm run test:unit

# Type check TypeScript codebase
npm run typecheck

# Build for production
npm run build
```
