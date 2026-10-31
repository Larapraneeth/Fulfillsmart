import { useSystemHealth, useSystemReadiness } from '../../api/queries/useSystemStatus';
import { Badge } from '../common/Badge';

export function StatusTicker() {
  const healthQuery = useSystemHealth();
  const readyQuery = useSystemReadiness();

  const isHealthy = healthQuery.data?.status === 'healthy';
  const isReady = readyQuery.data?.status === 'ready';
  const isError = healthQuery.isError || readyQuery.isError;
  const isLoading = healthQuery.isLoading || readyQuery.isLoading;

  // Measure actual round-trip latency from client query
  const measuredLatency = healthQuery.data?.roundTripMs ?? readyQuery.data?.roundTripMs ?? null;

  return (
    <div className="flex items-center gap-2" role="status" aria-live="polite">
      {isLoading ? (
        <Badge variant="outline" size="sm">
          Checking Backend...
        </Badge>
      ) : isError ? (
        <Badge variant="crimson" size="sm" pulse>
          Backend Offline
        </Badge>
      ) : (
        <div className="flex items-center gap-2">
          {/* Liveness Indicator */}
          <Badge variant={isHealthy ? 'emerald' : 'crimson'} size="sm" pulse={isHealthy}>
            API: {isHealthy ? 'Healthy' : 'Degraded'}
          </Badge>

          {/* Readiness Indicator */}
          <Badge variant={isReady ? 'teal' : 'amber'} size="sm">
            DB: {isReady ? 'Connected' : 'Pending'}
          </Badge>

          {/* Measured Client Round-Trip Latency (Informational Telemetry Only) */}
          {measuredLatency !== null && (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 font-mono text-xs text-midnight-300 bg-midnight-950 px-2 py-0.5 rounded border border-midnight-700"
              title="Informational: Measured round-trip network latency between browser and backend"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-tactical-teal/60" aria-hidden="true" />
              {measuredLatency}ms rtt
            </span>
          )}
        </div>
      )}
    </div>
  );
}
