import fs from 'fs';
import path from 'path';
import os from 'os';
import { AnalysisJob } from '../../types/jobs.js';
import { documentRepository } from '../../repositories/documentRepository.js';
import { analysisRepository } from '../../repositories/analysisRepository.js';
import { IngestionService } from '../ingestion/ingestionService.js';
import { RetrievalService } from '../retrieval/retrievalService.js';
import { RiskReasoningService, RiskContext } from '../risk/riskService.js';
import { LegalIntelligenceService } from '../legal/legalService.js';
import { GuardrailService } from '../guardrails/guardrailService.js';
import { BenchmarkService } from '../benchmark/benchmarkService.js';
import { ConsolidatedAuditPacket, RiskAssessment } from '../../types/contracts.js';
import { logger } from '../../utils/logger.js';

export class AnalysisJobOrchestrator {
  private retrievalService: RetrievalService;
  private riskReasoningService: RiskReasoningService;
  private legalIntelligenceService: LegalIntelligenceService;

  constructor() {
    this.retrievalService = new RetrievalService();
    this.riskReasoningService = new RiskReasoningService();
    this.legalIntelligenceService = new LegalIntelligenceService();
  }

  async execute(job: AnalysisJob): Promise<void> {
    const { document_id, jurisdiction, document_type } = job;
    
    // Stage 1 - Load Document
    const docMeta = await documentRepository.getDocumentById(document_id);
    if (!docMeta) {
      throw new Error(`Document ${document_id} not found.`);
    }

    const filePath = path.join(os.tmpdir(), `doc_${document_id}`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Document file for ${document_id} not found on disk.`);
    }

    try {
      // Stage 2, 3, 4, 5 - Ingest, Normalize, Segment, Hash
      await documentRepository.updateDocumentStatus(document_id, 'processing');
      
      const ingestionResult = await IngestionService.ingest({
        filePath,
        originalFilename: docMeta.filename,
        providedMime: docMeta.mime_type,
        jurisdiction,
        documentType: document_type,
        documentId: document_id
      });

      if (ingestionResult.documentArtifact.state.status === 'failed') {
        throw new Error(ingestionResult.documentArtifact.state.error_message || 'Ingestion failed (e.g. requires OCR)');
      }

      const clauses = ingestionResult.clauseArtifacts;
      
      // Stage 6, 7, 8 - Classify, Retrieve, Reason
      const riskAssessments: RiskAssessment[] = [];
      
      for (const clause of clauses) {
        // Retrieve Benchmarks
        const retrievalResult = await this.retrievalService.retrieveBenchmarks(clause, {
          jurisdiction,
          contractType: document_type
        });

        if (retrievalResult.matches.length > 0) {
          // Persist the matches for this clause
          await analysisRepository.upsertClauseBenchmarks(clause.id, retrievalResult.matches);
        }

        let benchmarkContext = undefined;
        if (retrievalResult.matches.length > 0) {
          const topMatch = retrievalResult.matches[0];
          const benchmark = await BenchmarkService.getBenchmarkById(topMatch.benchmark_id);
          if (benchmark) {
            benchmarkContext = {
              text: benchmark.standard_text,
              explanation: benchmark.plain_explanation,
              risk_baseline: benchmark.risk_baseline
            };
            (clause as any).matched_benchmark_id = benchmark.id;
          }
        }

        const riskContext: RiskContext = {
          clause_id: clause.id,
          raw_text: clause.content.raw_text,
          category: retrievalResult.classified_category,
          jurisdiction,
          is_benchmark_gap: retrievalResult.is_benchmark_gap,
          benchmark: benchmarkContext
        };

        // Risk Reasoning
        const assessment = await this.riskReasoningService.evaluateClause(riskContext);
        
        // Update clause artifact (cast to any for extra DB fields)
        clause.category = assessment.primary_category as any;
        (clause as any).risk_level = assessment.risk_level;
        (clause as any).confidence_score = assessment.confidence_score;
        clause.is_novel_clause = assessment.is_novel_clause;
        (clause as any).delta = assessment.delta;

        riskAssessments.push(assessment);
      }

      // Persist Clauses (Batch upsert)
      // Doing this here ensures clauses are saved even if Legal Intelligence fails
      await analysisRepository.upsertClauses(clauses);

      // Stage 9 - Generate Legal Intelligence
      // Execute concurrently to save time, but guard against LLM limits
      const [gotchasRaw, checklistRaw, attorneyRaw, execSummary] = await Promise.all([
        this.legalIntelligenceService.generateGotchas(riskAssessments),
        this.legalIntelligenceService.generateChecklist(docMeta.filename, riskAssessments),
        this.legalIntelligenceService.generateAttorneyBrief(docMeta.filename, riskAssessments),
        this.legalIntelligenceService.generateExecutiveSummary(riskAssessments)
      ]);

      // Stage 10 - Apply Guardrails before persistence
      // For arrays of items, we should ideally validate, but the GuardrailService 
      // currently validates single strings. The instructions say:
      // "Every generated legal intelligence result must pass through the existing guardrail layer"
      
      const validateOrDrop = (text: string) => {
        const res = GuardrailService.applyGuardrails(text, 'Report');
        return res.is_compliant ? text : null;
      };

      const packet: ConsolidatedAuditPacket = {
        document_id,
        executive_summary: validateOrDrop(execSummary.executive_summary) || 'Summary withheld due to guardrails.',
        key_findings: execSummary.key_findings.filter(f => validateOrDrop(f) !== null),
        top_gotchas: gotchasRaw.filter(g => 
          validateOrDrop(g.impact_description) !== null && validateOrDrop(g.plain_english_advice) !== null
        ),
        pre_signing_checklist: checklistRaw.filter(c => 
          validateOrDrop(c.impact_rationale) !== null && validateOrDrop(c.item) !== null
        ),
        attorney_consultation_questions: attorneyRaw.filter(q => 
          validateOrDrop(q.question) !== null && validateOrDrop(q.context_summary) !== null
        )
      };

      // Stage 11 - Persist final results
      await analysisRepository.upsertConsolidatedAudit(document_id, packet);

      // Tally risk counts
      const totals = { standard: 0, caution: 0, unfavorable: 0 };
      for (const a of riskAssessments) {
        if (a.risk_level === 'Standard') totals.standard++;
        if (a.risk_level === 'Caution') totals.caution++;
        if (a.risk_level === 'Unfavorable') totals.unfavorable++;
      }

      await analysisRepository.completeDocumentProcessing(document_id, totals);

    } finally {
      // Always try to cleanup temp file when processing ends (success or fail)
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      } catch (err) {
        logger.warn(`Failed to cleanup temp file ${filePath}`, { error: err });
      }
    }
  }
}
