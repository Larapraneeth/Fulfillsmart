import { RefreshCw, Radio } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';

export interface OverviewHeaderProps {
  isFetching?: boolean;
  dataUpdatedAt?: number;
  onRefresh?: () => void;
}

export function OverviewHeader({
  isFetching = false,
  dataUpdatedAt,
  onRefresh,
}: OverviewHeaderProps) {
  const formatTime = (timestamp?: number) => {
    if (!timestamp) return 'Synchronizing...';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC',
    }) + ' UTC';
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-midnight-700">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold tracking-tight text-midnight-100 font-display">
            Executive Overview
          </h1>
          <Badge variant="teal" size="sm" pulse>
            Operational Control Tower
          </Badge>
        </div>
        <p className="text-sm text-midnight-400 font-sans">
          Intelligent fulfillment network command center and operational performance telemetry.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-midnight-900 border border-midnight-700 text-xs font-mono text-midnight-300">
          <Radio className="w-3.5 h-3.5 text-tactical-teal animate-pulse" aria-hidden="true" />
          <span className="text-midnight-400">Baseline:</span>
          <span className="font-semibold text-midnight-100">50K Historical Orders</span>
        </div>

        {dataUpdatedAt ? (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-midnight-900/60 border border-midnight-700 text-xs font-mono text-midnight-400">
            <span>Last synced:</span>
            <span className="text-tactical-cyan">{formatTime(dataUpdatedAt)}</span>
          </div>
        ) : null}

        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            className="gap-2 text-xs font-mono"
            aria-label="Refresh telemetry data"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-tactical-cyan ${isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isFetching ? 'Syncing...' : 'Sync Telemetry'}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
