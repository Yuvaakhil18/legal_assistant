import { useEffect, useState } from 'react';
import { ApiClient } from '../api/client';
import { ShieldAlert, AlertTriangle, BarChart3 } from 'lucide-react';

interface OverviewData {
  metadata: {
    document_id: string;
    filename: string;
    document_type: string;
    jurisdiction: string;
  };
  state: {
    status: string;
    total_clauses: number;
    standard_count: number;
    caution_count: number;
    unfavorable_count: number;
  };
  executive_summary?: string;
  key_findings?: string[];
  disclaimer: string;
}

export function DocumentOverview({ documentId }: { documentId: string }) {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    ApiClient.getOverview(documentId)
      .then(data => setOverview(data as OverviewData))
      .catch(() => setOverview(null))
      .finally(() => setLoading(false));
  }, [documentId]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading overview...</div>;
  if (!overview) return <div className="p-8 text-center text-red-500">Failed to load overview.</div>;

  const { metadata, state } = overview;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{metadata.filename}</h2>
            <p className="text-gray-500 mt-1 flex items-center gap-2">
              <span className="capitalize">{metadata.document_type}</span>
              <span>&bull;</span>
              <span>{metadata.jurisdiction}</span>
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Analysis Complete
          </span>
        </div>
      </div>

      {overview.executive_summary && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-indigo-500" />
            Executive Summary
          </h3>
          <p className="text-gray-700 text-sm leading-relaxed">{overview.executive_summary}</p>
          {overview.key_findings && overview.key_findings.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Key Findings</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                {overview.key_findings.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm text-center">
          <div className="text-3xl font-bold text-green-600">{state.standard_count}</div>
          <div className="text-sm text-gray-500 mt-1">Standard</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm text-center">
          <div className="text-3xl font-bold text-amber-600">{state.caution_count}</div>
          <div className="text-sm text-gray-500 mt-1">Caution</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm text-center">
          <div className="text-3xl font-bold text-red-600">{state.unfavorable_count}</div>
          <div className="text-sm text-gray-500 mt-1">Unfavorable</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Risk Summary
          </h3>
          <p className="text-gray-600 text-sm">
            {state.total_clauses} clauses analyzed. Review the Gotchas and Checklist before proceeding.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            Next Steps
          </h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>1. Review the <strong>Top Gotchas</strong></li>
            <li>2. Complete the <strong>Checklist</strong></li>
            <li>3. Export the <strong>Attorney Brief</strong></li>
          </ul>
        </div>
      </div>

      <div className="text-xs text-gray-400 text-center">{overview.disclaimer}</div>
    </div>
  );
}
