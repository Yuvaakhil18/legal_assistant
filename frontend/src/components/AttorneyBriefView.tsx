import { useEffect, useState } from 'react';
import { ConsolidatedAuditPacket } from '../types/domain';
import { ApiClient } from '../api/client';
import { Briefcase, Download } from 'lucide-react';

export function AttorneyBriefView({ documentId }: { documentId: string }) {
  const [brief, setBrief] = useState<ConsolidatedAuditPacket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    ApiClient.getAttorneyBrief(documentId)
      .then(setBrief)
      .catch(() => setBrief(null))
      .finally(() => setLoading(false));
  }, [documentId]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading attorney brief...</div>;
  if (!brief) return <div className="p-8 text-center text-red-500">Failed to load brief.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="w-6 h-6 text-indigo-600" />
          <h2 className="text-2xl font-bold text-gray-900">Attorney Consultation Brief</h2>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-200"
        >
          <Download className="w-4 h-4" />
          Export PDF
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 print:p-0 print:border-none print:shadow-none space-y-8">
        <div className="border-b border-gray-200 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <Briefcase className="w-6 h-6 text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">Executive Summary</h3>
          </div>
          <p className="text-gray-800 text-sm leading-relaxed">{brief.executive_summary}</p>
        </div>

        {brief.key_findings?.length > 0 && (
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Key Findings</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-800">
              {brief.key_findings.map((finding, idx) => (
                <li key={idx}>{finding}</li>
              ))}
            </ul>
          </div>
        )}

        {brief.attorney_consultation_questions?.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Questions for Counsel</h3>
            <div className="space-y-4">
              {brief.attorney_consultation_questions.map((q, idx) => (
                <div key={idx} className="bg-gray-50 p-4 rounded-md border border-gray-200">
                  <div className="text-xs font-bold text-indigo-600 mb-1">REF: {q.clause_ref}</div>
                  <div className="text-sm text-gray-900 font-medium">{q.question}</div>
                  {q.context_summary && (
                    <div className="text-xs text-gray-500 mt-1">{q.context_summary}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 text-center">
        This brief is for informational purposes only. It does not constitute legal advice.
      </div>
    </div>
  );
}
