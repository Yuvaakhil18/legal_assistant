import { useState, useEffect, useRef } from 'react';
import { UploadView } from './components/UploadView';
import { ProcessingView } from './components/ProcessingView';
import { DocumentOverview } from './components/DocumentOverview';
import { ClauseExplorer } from './components/ClauseExplorer';
import { Gotchas } from './components/Gotchas';
import { Checklist } from './components/Checklist';
import { AttorneyBriefView } from './components/AttorneyBriefView';
import { DocumentQA } from './components/DocumentQA';
import { ApiClient } from './api/client';
import { ShieldAlert, FileText, CheckSquare, Briefcase, MessageSquare, AlertTriangle } from 'lucide-react';

type ViewState = 'upload' | 'processing' | 'overview' | 'clauses' | 'gotchas' | 'checklist' | 'brief' | 'qa';

function App() {
  const [view, setView] = useState<ViewState>('upload');
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleUpload = async (file: File) => {
    try {
      setError(null);
      setView('processing');
      const result = await ApiClient.uploadDocument(file);
      setDocumentId(result.document_id);

      // Start polling for analysis completion
      pollRef.current = setInterval(async () => {
        try {
          const status = await ApiClient.getDocumentStatus(result.document_id);
          if (status.status === 'completed') {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setView('overview');
          } else if (status.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setError('Document analysis failed. Please try again.');
            setView('upload');
          }
        } catch {
          // Polling error - continue polling
        }
      }, 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
      setView('upload');
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'clauses', label: 'Clause Explorer', icon: AlertTriangle },
    { id: 'gotchas', label: 'Top Gotchas', icon: ShieldAlert },
    { id: 'checklist', label: 'Checklist', icon: CheckSquare },
    { id: 'brief', label: 'Attorney Brief', icon: Briefcase },
    { id: 'qa', label: 'Ask Document', icon: MessageSquare },
  ] as const;

  if (view === 'upload') {
    return (
      <>
        <UploadView onUpload={handleUpload} />
        {error && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-200 text-red-800 px-6 py-3 rounded-lg shadow-lg text-sm">
            {error}
          </div>
        )}
      </>
    );
  }
  if (view === 'processing') return <ProcessingView />;

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      <nav className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold flex items-center gap-2 text-indigo-900">
            <ShieldAlert className="w-6 h-6 text-indigo-600" />
            Legal Intel
          </h1>
          <p className="text-xs text-gray-500 mt-2">Information, not legal advice.</p>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {navItems.map(item => (
              <li key={item.id}>
                <button
                  onClick={() => setView(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    view === item.id 
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <main className="flex-1 overflow-auto bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto">
          {view === 'overview' && documentId && <DocumentOverview documentId={documentId} />}
          {view === 'clauses' && documentId && <ClauseExplorer documentId={documentId} />}
          {view === 'gotchas' && documentId && <Gotchas documentId={documentId} />}
          {view === 'checklist' && documentId && <Checklist documentId={documentId} />}
          {view === 'brief' && documentId && <AttorneyBriefView documentId={documentId} />}
          {view === 'qa' && documentId && <DocumentQA documentId={documentId} />}
        </div>
      </main>
    </div>
  );
}

export default App;
