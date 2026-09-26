import { useEffect, useState } from 'react';
import { RiskAssessment } from '../types/domain';
import { ApiClient } from '../api/client';
import { AlertCircle, FileText, ExternalLink, Loader2 } from 'lucide-react';

function getRiskColor(level: string) {
  switch (level) {
    case 'Unfavorable': return 'bg-red-50 text-red-700 border-red-200';
    case 'Caution': return 'bg-amber-50 text-amber-700 border-amber-200';
    default: return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

interface ClauseRow {
  clause_id: string;
  clause_index: number;
  section_number: string;
  title: string;
  raw_text: string;
  risk_assessment: RiskAssessment;
}

export function ClauseExplorer({ documentId }: { documentId: string }) {
  const [clauses, setClauses] = useState<ClauseRow[]>([]);
  const [selectedClause, setSelectedClause] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [counterDraft, setCounterDraft] = useState<any>(null);
  const [draftLoading, setDraftLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    ApiClient.getClauses(documentId)
      .then(data => setClauses(data.clauses))
      .catch(() => setClauses([]))
      .finally(() => setLoading(false));
  }, [documentId]);

  useEffect(() => {
    if (!selectedClause) {
      setDetail(null);
      setCounterDraft(null);
      return;
    }
    setDetailLoading(true);
    setCounterDraft(null);
    ApiClient.getClauseDetail(documentId, selectedClause)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [documentId, selectedClause]);

  const handleCounterDraft = async () => {
    if (!selectedClause) return;
    setDraftLoading(true);
    try {
      const draft = await ApiClient.getCounterDraft(documentId, selectedClause);
      setCounterDraft(draft);
    } catch {
      setCounterDraft({ error: true });
    } finally {
      setDraftLoading(false);
    }
  };

  const selectedData = clauses.find(c => c.clause_id === selectedClause);
  const risk = selectedData?.risk_assessment || detail?.risk_assessment;

  if (loading) return <div className="p-8 text-center text-gray-500">Loading clauses...</div>;

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-8rem)] gap-6">
      {/* List */}
      <div className="w-full md:w-1/3 flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Document Clauses ({clauses.length})</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {clauses.map(clause => {
            const isSelected = selectedClause === clause.clause_id;
            const clauseRisk = clause.risk_assessment;
            return (
              <button
                key={clause.clause_id}
                onClick={() => setSelectedClause(clause.clause_id)}
                className={`w-full text-left p-3 rounded-md border text-sm transition-colors ${
                  isSelected 
                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' 
                    : 'border-transparent hover:bg-gray-100'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-gray-900">Section {clause.section_number}</span>
                  {clauseRisk && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getRiskColor(clauseRisk.risk_level)}`}>
                      {clauseRisk.risk_level}
                    </span>
                  )}
                </div>
                <div className="text-gray-500 truncate">{clause.title}</div>
              </button>
            );
          })}
          {clauses.length === 0 && (
            <div className="text-center text-gray-400 py-8">No clauses found</div>
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="w-full md:w-2/3 flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {detailLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : selectedData ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Section {selectedData.section_number}: {selectedData.title}
              </h2>
              {risk && (
                <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md border ${getRiskColor(risk.risk_level)}`}>
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Risk: {risk.risk_level}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">DOCUMENT FACT</h3>
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-md text-sm text-gray-800 whitespace-pre-wrap font-serif">
                {selectedData.raw_text}
              </div>
            </div>

            {detail?.benchmark && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> REFERENCE EVIDENCE
                </h3>
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-md text-sm text-indigo-900">
                  <div className="font-medium mb-1">{detail.benchmark.title}</div>
                  {detail.benchmark.explanation && (
                    <p className="text-indigo-700 text-xs">{detail.benchmark.explanation}</p>
                  )}
                </div>
              </div>
            )}

            {risk && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider">AI INTERPRETATION</h3>
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-md space-y-4">
                  {risk.delta ? (
                    <>
                      <p className="text-sm text-amber-900">{risk.delta.deviation_summary}</p>
                      {risk.delta.risk_factors.length > 0 && (
                        <ul className="list-disc pl-5 text-sm text-amber-900 space-y-1">
                          {risk.delta.risk_factors.map((factor: string, i: number) => (
                            <li key={i}>{factor}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-amber-700 italic">No detailed AI interpretation available.</p>
                  )}
                </div>
              </div>
            )}

            {/* Counter-Draft Section */}
            {risk && risk.risk_level !== 'Standard' && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-green-600 uppercase tracking-wider">EDUCATIONAL SAMPLE ALTERNATIVE</h3>
                {counterDraft && !counterDraft.error ? (
                  <div className="bg-green-50 border border-green-100 p-4 rounded-md space-y-3">
                    <div className="bg-white border border-green-200 p-3 rounded text-sm text-gray-800 whitespace-pre-wrap font-serif">
                      {counterDraft.proposed_text}
                    </div>
                    {counterDraft.key_modifications?.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-green-700 mb-1">Key Modifications:</div>
                        <ul className="list-disc pl-5 text-xs text-green-800 space-y-0.5">
                          {counterDraft.key_modifications.map((m: string, i: number) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {counterDraft.negotiation_talking_point && (
                      <p className="text-xs text-green-700 italic">{counterDraft.negotiation_talking_point}</p>
                    )}
                    {counterDraft.disclaimer && (
                      <p className="text-xs text-gray-400">{counterDraft.disclaimer}</p>
                    )}
                  </div>
                ) : counterDraft?.error ? (
                  <div className="bg-red-50 border border-red-100 p-3 rounded-md text-sm text-red-700">
                    Failed to generate sample language. Please try again.
                  </div>
                ) : (
                  <button
                    onClick={handleCounterDraft}
                    disabled={draftLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {draftLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Generate Sample Language
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <FileText className="w-12 h-12 mb-4 opacity-20" />
            <p>Select a clause to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
