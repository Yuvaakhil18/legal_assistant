import { DocumentMetadata, RiskAssessment, Gotcha, ChecklistItem, ConsolidatedAuditPacket, CounterDraft, QueryResponse } from '../types/domain';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithHandler<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Bypass-Tunnel-Reminder': 'true',
      'ngrok-skip-browser-warning': 'true',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let errorMsg = 'Unknown API error';
    let errorCode = 'UNKNOWN_ERROR';
    try {
      const errorData = await response.json();
      errorMsg = errorData.error?.message || errorData.message || errorMsg;
      errorCode = errorData.error?.code || errorData.errorCode || errorCode;
    } catch {
      errorMsg = response.statusText;
    }
    throw new ApiError(response.status, errorCode, errorMsg);
  }

  // Handle empty responses
  const text = await response.text();
  return text ? JSON.parse(text) : {} as T;
}

// Shape returned by GET /api/documents/:id/clauses
interface ClausesResponse {
  clauses: Array<{
    clause_id: string;
    clause_index: number;
    section_number: string;
    title: string;
    raw_text: string;
    risk_assessment: RiskAssessment;
  }>;
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

// Shape returned by GET /api/documents/:id/overview
interface OverviewResponse {
  metadata: {
    document_id: string;
    filename: string;
    document_type: string;
    jurisdiction: string;
    is_scanned: boolean;
  };
  state: {
    status: string;
    error_message?: string;
    total_clauses: number;
    standard_count: number;
    caution_count: number;
    unfavorable_count: number;
    overall_risk_score: number;
  };
  executive_summary?: string;
  key_findings?: string[];
  disclaimer: string;
}

export const ApiClient = {
  uploadDocument: async (file: File): Promise<{ document_id: string; job_id: string; status: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: 'POST',
      headers: { 'Bypass-Tunnel-Reminder': 'true', 'ngrok-skip-browser-warning': 'true' },
      body: formData,
    });
    
    if (!response.ok) {
      let errorMsg = 'Upload failed';
      try {
        const errorData = await response.json();
        errorMsg = errorData.error?.message || errorMsg;
      } catch { /* ignore */ }
      throw new ApiError(response.status, 'UPLOAD_FAILED', errorMsg);
    }
    
    return response.json();
  },

  getDocumentStatus: async (documentId: string): Promise<DocumentMetadata> => {
    const data = await fetchWithHandler<any>(`/documents/${documentId}`);
    return {
      document_id: data.document_id,
      filename: data.filename,
      document_type: data.document_type || 'general_contract',
      detected_jurisdiction: data.jurisdiction || 'General Commercial',
      status: mapBackendStatus(data.status),
      created_at: data.created_at
    };
  },

  getOverview: async (documentId: string): Promise<OverviewResponse> => {
    return fetchWithHandler<OverviewResponse>(`/documents/${documentId}/overview`);
  },
  
  getClauses: async (documentId: string, page = 1, pageSize = 50): Promise<ClausesResponse> => {
    return fetchWithHandler<ClausesResponse>(`/documents/${documentId}/clauses?page=${page}&pageSize=${pageSize}`);
  },

  getClauseDetail: async (documentId: string, clauseId: string): Promise<any> => {
    return fetchWithHandler(`/documents/${documentId}/clauses/${clauseId}`);
  },
  
  getGotchas: async (documentId: string): Promise<Gotcha[]> => {
    return fetchWithHandler<Gotcha[]>(`/documents/${documentId}/gotchas`);
  },

  getChecklist: async (documentId: string): Promise<ChecklistItem[]> => {
    return fetchWithHandler<ChecklistItem[]>(`/documents/${documentId}/checklist`);
  },

  getAttorneyBrief: async (documentId: string): Promise<ConsolidatedAuditPacket> => {
    return fetchWithHandler<ConsolidatedAuditPacket>(`/documents/${documentId}/brief`);
  },

  getCounterDraft: async (documentId: string, clauseId: string): Promise<CounterDraft> => {
    return fetchWithHandler<CounterDraft>(`/documents/${documentId}/clauses/${clauseId}/counter-draft`, {
      method: 'POST',
      headers: { 'Bypass-Tunnel-Reminder': 'true', 'ngrok-skip-browser-warning': 'true' },
    });
  },

  askQuestion: async (documentId: string, question: string): Promise<QueryResponse> => {
    return fetchWithHandler<QueryResponse>(`/documents/${documentId}/query`, {
      method: 'POST',
      headers: { 'Bypass-Tunnel-Reminder': 'true', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ question }),
    });
  }
};

function mapBackendStatus(status: string): DocumentMetadata['status'] {
  switch (status) {
    case 'analyzed': return 'completed';
    case 'uploaded':
    case 'queued':
    case 'processing':
      return 'processing';
    case 'failed': return 'failed';
    default: return 'processing';
  }
}

// --- MOCK DATA FOR UI DEVELOPMENT ---
export const MockApiClient = {
  uploadDocument: async (_file: File): Promise<{ document_id: string; job_id: string; status: string }> => {
    return new Promise(resolve => setTimeout(() => resolve({ document_id: 'mock-doc-123', job_id: 'mock-job-123', status: 'queued' }), 1500));
  },
  
  getDocumentStatus: async (documentId: string): Promise<DocumentMetadata> => {
    return {
      document_id: documentId,
      filename: 'Consulting_Agreement.pdf',
      document_type: 'contract',
      detected_jurisdiction: 'US-NY',
      status: 'completed',
      created_at: new Date().toISOString()
    };
  },

  getOverview: async (documentId: string): Promise<OverviewResponse> => ({
    metadata: { document_id: documentId, filename: 'Test.pdf', document_type: 'contract', jurisdiction: 'US', is_scanned: false },
    state: { status: 'analyzed', total_clauses: 10, standard_count: 8, caution_count: 1, unfavorable_count: 1, overall_risk_score: 2.5 },
    executive_summary: 'Mock summary',
    key_findings: ['Finding 1'],
    disclaimer: 'This is not legal advice.'
  }),

  getClauses: async (_documentId: string): Promise<ClausesResponse> => ({
    clauses: [
      { clause_id: 'c1', clause_index: 0, section_number: '1.1', title: 'Services', raw_text: 'Contractor shall perform services.', risk_assessment: { clause_id: 'c1', risk_level: 'Standard', primary_category: 'General', is_novel_clause: false } },
      { clause_id: 'c2', clause_index: 1, section_number: '8.1', title: 'Indemnification', raw_text: 'Contractor will indemnify the Client for all claims unconditionally.', risk_assessment: { clause_id: 'c2', risk_level: 'Unfavorable', primary_category: 'Indemnification', delta: { deviation_summary: 'Unilateral, uncapped indemnity.', risk_factors: ['Uncapped liability', 'No reciprocal protection'] }, is_novel_clause: false, benchmark_title: 'Mutual Indemnification with Cap' } }
    ],
    pagination: { page: 1, page_size: 50, total: 2, total_pages: 1 }
  }),

  getGotchas: async (_documentId: string): Promise<Gotcha[]> => {
    return [
      { priority: 1, title: 'Unlimited Financial Liability', severity: 'Critical', impact_description: 'High risk.', plain_english_advice: 'Request a cap.', related_clause_ids: ['c2'] }
    ];
  },

  getChecklist: async (_documentId: string): Promise<ChecklistItem[]> => {
    return [
      { item: 'Verify payment terms are at least Net 30.', category: 'Payment', status: 'Action Required' }
    ];
  },

  getAttorneyBrief: async (documentId: string): Promise<ConsolidatedAuditPacket> => {
    return {
      document_id: documentId,
      executive_summary: 'Contract favors client heavily.',
      key_findings: ['Uncapped indemnity'],
      top_gotchas: [],
      pre_signing_checklist: [],
      attorney_consultation_questions: [{ clause_ref: '8.1', question: 'Is this enforceable?', context_summary: 'Test context' }]
    };
  },
  
  getCounterDraft: async (_documentId: string, clauseId: string): Promise<CounterDraft> => {
    return {
      clause_id: clauseId,
      proposed_text: 'Sample / educational language — not legal advice.\n\nEach party shall indemnify the other for gross negligence capped at fees paid.',
      key_modifications: ['Made mutual', 'Added cap'],
      negotiation_talking_point: 'Market standard is mutual protection.'
    };
  },

  askQuestion: async (documentId: string, question: string): Promise<QueryResponse> => {
    return {
      document_id: documentId,
      question,
      answer: '[DISCLAIMER: This information is provided for educational and informational purposes only. It is not legal advice, nor does it create an attorney-client relationship. You should consult a qualified attorney for advice regarding your specific situation.]\n\nBased on Section 8.1, you are required to indemnify unconditionally.',
      grounding_citations: [{ clause_id: 'c2', section_number: '8.1', title: 'Indemnification', relevance_score: 0.95 }],
      suggested_follow_ups: ['What happens if I breach?']
    };
  }
};
