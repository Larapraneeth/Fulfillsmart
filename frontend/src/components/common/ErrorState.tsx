import { useState, useRef, useEffect } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';
import { RFC7807ProblemDetails } from '../../types/common';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  problemDetails?: RFC7807ProblemDetails | null;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Operational Error Encountered',
  message,
  problemDetails,
  onRetry,
}: ErrorStateProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopyRequestId = async (requestId: string) => {
    if (!navigator?.clipboard?.writeText) {
      setCopyStatus('error');
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopyStatus('idle'), 3000);
      return;
    }
    try {
      await navigator.clipboard.writeText(requestId);
      setCopyStatus('copied');
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      setCopyStatus('error');
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopyStatus('idle'), 3000);
    }
  };

  const displayTitle = problemDetails?.title || title;
  const displayMessage =
    problemDetails?.detail || message || 'An unexpected error occurred while communicating with the backend.';

  return (
    <div className="p-8 rounded-xl border border-tactical-crimson/30 bg-midnight-900/90 text-center max-w-xl mx-auto my-8">
      <div className="w-12 h-12 rounded-full bg-tactical-crimson/10 border border-tactical-crimson/30 flex items-center justify-center mx-auto mb-4 text-tactical-crimson" aria-hidden="true">
        <AlertTriangle className="w-6 h-6" />
      </div>

      <h3 className="text-lg font-semibold text-midnight-100 font-display mb-2">{displayTitle}</h3>
      <p className="text-sm text-midnight-400 mb-6 font-sans">{displayMessage}</p>

      {problemDetails && (
        <div className="bg-midnight-950 p-4 rounded-lg border border-midnight-700 text-left mb-6 font-mono text-xs space-y-1.5">
          <div className="flex justify-between text-midnight-400">
            <span>Error Code:</span>
            <span className="text-tactical-crimson font-semibold">{problemDetails.error_code}</span>
          </div>
          <div className="flex justify-between text-midnight-400">
            <span>HTTP Status:</span>
            <span className="text-midnight-200">{problemDetails.status}</span>
          </div>
          {problemDetails.request_id && (
            <div className="flex items-center justify-between text-midnight-400 pt-1 border-t border-midnight-800">
              <span>Request ID:</span>
              <div className="flex items-center gap-2">
                <span className="text-tactical-teal font-mono">{problemDetails.request_id}</span>
                <button
                  type="button"
                  onClick={() => handleCopyRequestId(problemDetails.request_id!)}
                  className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-midnight-800 hover:bg-midnight-700 text-midnight-300 hover:text-midnight-100 border border-midnight-700 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tactical-teal/50"
                  aria-label="Copy request ID to clipboard"
                  title="Copy Request ID"
                >
                  {copyStatus === 'copied' ? (
                    <>
                      <Check className="w-3 h-3 text-tactical-emerald" />
                      <span className="text-tactical-emerald">Copied</span>
                    </>
                  ) : copyStatus === 'error' ? (
                    <span className="text-tactical-crimson">Failed</span>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Request
        </Button>
      )}
    </div>
  );
}
