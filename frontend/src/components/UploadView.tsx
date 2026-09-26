import { useState, useRef } from 'react';
import { UploadCloud, FileText, AlertCircle } from 'lucide-react';

interface Props {
  onUpload: (file: File) => void;
}

export function UploadView({ onUpload }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndUpload = (file: File) => {
    setError('');
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10MB.');
      return;
    }
    if (file.type !== 'application/pdf' && file.type !== 'text/plain') {
      setError('Unsupported format. Please upload PDF or TXT.');
      return;
    }
    onUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Analyze a document</h1>
          <p className="mt-3 text-gray-600">Understand your legal documents. Identify important clauses and risks. Prepare information for professional legal review.</p>
        </div>

        <div 
          data-testid="upload-dropzone"
          className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white hover:border-indigo-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            data-testid="file-upload-input"
            ref={inputRef}
            className="hidden" 
            accept=".pdf,.txt,application/pdf,text/plain"
            onChange={e => e.target.files && validateAndUpload(e.target.files[0])}
          />
          
          <UploadCloud className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Drag and drop your contract</h3>
          <p className="mt-1 text-sm text-gray-500">PDF or TXT up to 10MB</p>
          
          <button 
            onClick={() => inputRef.current?.click()}
            className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Select a file
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500 flex items-center justify-center gap-1.5">
            <FileText className="w-4 h-4" />
            <strong>DISCLAIMER:</strong> This tool provides informational analysis and is not legal advice.
          </p>
        </div>
      </div>
    </div>
  );
}
