import { useEffect, useState } from 'react';
import { Gotcha } from '../types/domain';
import { ApiClient } from '../api/client';
import { ShieldAlert } from 'lucide-react';

const severityColor: Record<string, string> = {
  Critical: 'bg-red-50 border-red-200 text-red-800',
  High: 'bg-amber-50 border-amber-200 text-amber-800',
  Moderate: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  Low: 'bg-gray-50 border-gray-200 text-gray-800'
};

export function Gotchas({ documentId }: { documentId: string }) {
  const [gotchas, setGotchas] = useState<Gotcha[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    ApiClient.getGotchas(documentId)
      .then(setGotchas)
      .catch(() => setGotchas([]))
      .finally(() => setLoading(false));
  }, [documentId]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading gotchas...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <ShieldAlert className="w-6 h-6 text-red-500" />
        <h2 className="text-2xl font-bold text-gray-900">Top Gotchas</h2>
      </div>

      {gotchas.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center text-green-700">
          No significant risks identified. This is a positive signal, but always consult a qualified attorney.
        </div>
      ) : (
        gotchas.map((g, idx) => (
          <div key={idx} className={`p-5 border rounded-lg ${severityColor[g.severity] || severityColor.Moderate}`}>
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold">{g.priority}. {g.title}</h3>
              <span className="text-xs font-bold uppercase">{g.severity}</span>
            </div>
            <p className="text-sm mb-3">{g.impact_description}</p>
            <p className="text-sm italic">{g.plain_english_advice}</p>
          </div>
        ))
      )}
    </div>
  );
}
