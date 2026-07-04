import React from 'react';

interface TestEndpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  method: string;
  path: string;
  body: string;
  onBodyChange: (body: string) => void;
  onTest: () => void;
  response: string | null;
}

export function TestEndpointModal({ isOpen, onClose, method, path, body, onBodyChange, onTest, response }: TestEndpointModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Test Endpoint</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-bold rounded ${method === 'GET' ? 'bg-sky-600 text-white' : 'bg-emerald-600 text-white'}`}>
              {method}
            </span>
            <span className="text-sm font-mono text-slate-700">{path}</span>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-slate-500">Request Body (JSON)</label>
            <textarea
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              className="w-full h-40 p-3 text-xs font-mono border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <button
            onClick={onTest}
            className="w-full py-2 bg-indigo-600 text-white font-bold text-xs uppercase rounded-lg hover:bg-indigo-700 transition"
          >
            Send Request
          </button>
          {response && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-500">Response</label>
              <pre className="bg-slate-900 text-emerald-400 p-3 rounded-lg text-xs overflow-x-auto">
                {response}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
