import { useState } from 'react';
import { QueryResponse } from '../types/domain';
import { ApiClient } from '../api/client';
import { Send, User, ShieldAlert, FileText, Loader2 } from 'lucide-react';

export function DocumentQA({ documentId }: { documentId: string }) {
  const [history, setHistory] = useState<Array<{ role: 'user' | 'ai'; content: string; citations?: QueryResponse['grounding_citations'] }>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const query = input.trim();
    setInput('');
    setHistory(prev => [...prev, { role: 'user', content: query }]);
    setIsLoading(true);

    try {
      const response = await ApiClient.askQuestion(documentId, query);
      setHistory(prev => [
        ...prev, 
        { role: 'ai', content: response.answer, citations: response.grounding_citations }
      ]);
    } catch (_err) {
      setHistory(prev => [
        ...prev, 
        { role: 'ai', content: 'An error occurred while querying the document. Please try again.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="font-semibold text-gray-900">Ask Document</h2>
        <p className="text-xs text-gray-500 mt-1">Ask questions about the contract. Not a substitute for legal advice.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {history.length === 0 && (
          <div className="text-center text-gray-400 mt-10 space-y-4">
            <MessageSquareIcon className="w-12 h-12 mx-auto opacity-20" />
            <p>Ask a question about the document.</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
              {['What does the termination clause require?', 'Which clauses create unusual obligations?', 'Where does this agreement mention automatic renewal?'].map(q => (
                <button 
                  key={q}
                  onClick={() => setInput(q)}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'ai' && (
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4 text-indigo-600" />
              </div>
            )}
            
            <div className={`max-w-[80%] rounded-lg p-4 ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none' 
                : 'bg-gray-50 border border-gray-200 text-gray-800 rounded-bl-none'
            }`}>
              <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
              
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Evidence
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {msg.citations.map((cit, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600 font-medium shadow-sm">
                        {cit.section_number ? `Sec ${cit.section_number}` : ''} {cit.title ? `- ${cit.title}` : `(${cit.clause_id.slice(0, 8)})`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-gray-500" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg rounded-bl-none p-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              <span className="text-sm text-gray-500">Analyzing document...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question about your contract..."
            className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

// Inline helper for empty state icon
function MessageSquareIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>;
}
