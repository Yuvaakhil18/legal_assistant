import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Circle } from 'lucide-react';

const STAGES = [
  'Upload',
  'Validate',
  'Extract',
  'Segment',
  'Classify',
  'Retrieve',
  'Analyze',
  'Finalize'
];

export function ProcessingView() {
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    // Simulated processing sequence for UI presentation
    const interval = setInterval(() => {
      setCurrentStage(prev => {
        if (prev < STAGES.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 250); // Fast simulation
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Processing Document</h2>
        
        <div className="space-y-4">
          {STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStage;
            const isCurrent = idx === currentStage;
            
            return (
              <div key={stage} className="flex items-center gap-3">
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : isCurrent ? (
                  <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300" />
                )}
                
                <span className={`text-sm font-medium ${
                  isCompleted ? 'text-gray-900' : isCurrent ? 'text-indigo-700' : 'text-gray-400'
                }`}>
                  {stage}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
