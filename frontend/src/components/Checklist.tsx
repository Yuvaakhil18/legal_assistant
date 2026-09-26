import { useEffect, useState } from 'react';
import { ChecklistItem } from '../types/domain';
import { ApiClient } from '../api/client';
import { CheckSquare } from 'lucide-react';

const statusColor: Record<string, string> = {
  'Action Required': 'bg-red-100 text-red-700',
  'Verified': 'bg-green-100 text-green-700',
  'Optional': 'bg-gray-100 text-gray-600'
};

export function Checklist({ documentId }: { documentId: string }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    ApiClient.getChecklist(documentId)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [documentId]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading checklist...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <CheckSquare className="w-6 h-6 text-indigo-500" />
        <h2 className="text-2xl font-bold text-gray-900">Pre-Signing Checklist</h2>
      </div>

      {items.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center text-green-700">
          No checklist items generated. Consult a qualified attorney before signing.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200">
          {items.map((item, idx) => (
            <div key={idx} className="p-4 flex items-start gap-4">
              <div className="shrink-0">
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusColor[item.status] || statusColor.Optional}`}>
                  {item.status}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900 font-medium">{item.item}</p>
                <p className="text-xs text-gray-500 mt-1">Category: {item.category}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
