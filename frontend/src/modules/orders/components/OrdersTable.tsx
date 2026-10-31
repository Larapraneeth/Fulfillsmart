import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Boxes,
  Truck,
  Copy,
  Check,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import {
  OrderListItem,
  OrderSortField,
  SortOrderDirection,
} from '../../../types/orders';

export interface OrdersTableProps {
  orders: OrderListItem[];
  sortBy?: OrderSortField;
  sortOrder?: SortOrderDirection;
  onSortChange: (field: OrderSortField) => void;
  onSelectOrder: (orderId: string) => void;
  selectedOrderId?: string | null;
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function formatOrderDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return isoString;
  }
}

export function OrdersTable({
  orders,
  sortBy = 'order_time',
  sortOrder = 'desc',
  onSortChange,
  onSelectOrder,
  selectedOrderId,
}: OrdersTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const renderSortIndicator = (field: OrderSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 text-midnight-600 group-hover:text-midnight-400" aria-hidden="true" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-tactical-teal" aria-hidden="true" />
    ) : (
      <ArrowDown className="w-3 h-3 text-tactical-teal" aria-hidden="true" />
    );
  };

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-midnight-700/80 bg-midnight-900 shadow-xl">
      <table className="w-full text-left border-collapse text-xs" aria-label="Historical Orders Data Grid">
        <thead>
          <tr className="border-b border-midnight-700 bg-midnight-950/90 text-midnight-400 font-mono text-[11px] uppercase tracking-wider">
            {/* Order ID */}
            <th scope="col" className="py-3 px-4">
              <button
                type="button"
                onClick={() => onSortChange('order_id')}
                className="group inline-flex items-center gap-1.5 hover:text-midnight-100 font-mono transition-colors focus:outline-none focus-visible:text-tactical-teal"
                aria-label={`Sort by Order ID. Currently sorted ${sortBy === 'order_id' ? sortOrder : 'none'}`}
              >
                <span>Order ID</span>
                {renderSortIndicator('order_id')}
              </button>
            </th>

            {/* Placement Date */}
            <th scope="col" className="py-3 px-4">
              <button
                type="button"
                onClick={() => onSortChange('order_time')}
                className="group inline-flex items-center gap-1.5 hover:text-midnight-100 font-mono transition-colors focus:outline-none focus-visible:text-tactical-teal"
                aria-label={`Sort by Order Date. Currently sorted ${sortBy === 'order_time' ? sortOrder : 'none'}`}
              >
                <span>Order Date (IST)</span>
                {renderSortIndicator('order_time')}
              </button>
            </th>

            {/* Destination */}
            <th scope="col" className="py-3 px-4">Destination</th>

            {/* Priority & Service */}
            <th scope="col" className="py-3 px-4">
              <button
                type="button"
                onClick={() => onSortChange('order_priority')}
                className="group inline-flex items-center gap-1.5 hover:text-midnight-100 font-mono transition-colors focus:outline-none focus-visible:text-tactical-teal"
                aria-label={`Sort by Priority. Currently sorted ${sortBy === 'order_priority' ? sortOrder : 'none'}`}
              >
                <span>Priority & Svc</span>
                {renderSortIndicator('order_priority')}
              </button>
            </th>

            {/* Volume */}
            <th scope="col" className="py-3 px-4 text-center">Items & Units</th>

            {/* Warehouse Allocation */}
            <th scope="col" className="py-3 px-4">Warehouse Allocation</th>

            {/* Carrier Intelligence */}
            <th scope="col" className="py-3 px-4">Carrier(s)</th>

            {/* Order Total INR */}
            <th scope="col" className="py-3 px-4 text-right">Order Value</th>

            {/* Delivery Outcome */}
            <th scope="col" className="py-3 px-4 text-center">Delivery Status</th>

            {/* Action */}
            <th scope="col" className="py-3 px-4 text-right">Action</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-midnight-800/80 font-sans">
          {orders.map((order) => {
            const isSelected = selectedOrderId === order.order_id;

            return (
              <tr
                key={order.order_id}
                onClick={() => onSelectOrder(order.order_id)}
                className={`transition-colors cursor-pointer group ${
                  isSelected
                    ? 'bg-tactical-teal/10 border-l-2 border-l-tactical-teal'
                    : 'hover:bg-midnight-850/70'
                }`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectOrder(order.order_id);
                  }
                }}
                role="row"
                aria-selected={isSelected}
              >
                {/* 1. Order ID & Customer */}
                <td className="py-3 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-tactical-teal tracking-tight">
                      {order.order_id}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleCopyId(e, order.order_id)}
                      className="text-midnight-500 hover:text-midnight-200 p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-tactical-teal/50"
                      title="Copy Order ID"
                      aria-label={`Copy order ID ${order.order_id}`}
                    >
                      {copiedId === order.order_id ? (
                        <Check className="w-3 h-3 text-tactical-emerald" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <div className="text-[11px] font-mono text-midnight-400 mt-0.5">
                    {order.customer_id}
                  </div>
                </td>

                {/* 2. Order Timestamp */}
                <td className="py-3 px-4 whitespace-nowrap font-mono text-midnight-300">
                  {formatOrderDateTime(order.order_time)}
                </td>

                {/* 3. Destination City / Zone */}
                <td className="py-3 px-4 whitespace-nowrap">
                  <div className="font-medium text-midnight-100">
                    {order.zone_city ? `${order.zone_city}, ${order.zone_state}` : order.zone_name}
                  </div>
                  <div className="text-[11px] font-mono text-midnight-400">
                    {order.destination_zone_id} · {order.zone_name}
                  </div>
                </td>

                {/* 4. Priority & Service */}
                <td className="py-3 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {order.order_priority === 'HIGH' || order.order_priority === 'CRITICAL' ? (
                      <Badge variant="amber" size="sm" className="font-mono">
                        {order.order_priority}
                      </Badge>
                    ) : (
                      <Badge variant="outline" size="sm" className="font-mono text-midnight-400">
                        {order.order_priority}
                      </Badge>
                    )}

                    <Badge
                      variant={
                        order.requested_service === 'SAME_DAY'
                          ? 'cyan'
                          : order.requested_service === 'EXPRESS'
                          ? 'teal'
                          : 'default'
                      }
                      size="sm"
                      className="font-mono"
                    >
                      {order.requested_service}
                    </Badge>
                  </div>
                </td>

                {/* 5. Items & Units */}
                <td className="py-3 px-4 whitespace-nowrap text-center font-mono">
                  <span className="text-midnight-200 font-semibold">{order.line_count}</span>
                  <span className="text-midnight-400 text-[11px]"> {order.line_count === 1 ? 'line' : 'lines'} · </span>
                  <span className="text-midnight-200 font-semibold">{order.total_units}</span>
                  <span className="text-midnight-400 text-[11px]"> units</span>
                </td>

                {/* 6. Warehouse Allocation */}
                <td className="py-3 px-4 whitespace-nowrap">
                  {order.is_split ? (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="indigo" size="sm" className="gap-1 font-mono font-semibold">
                        <Boxes className="w-3 h-3 text-tactical-indigoLight" />
                        SPLIT ({order.allocated_nodes.length} Nodes)
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 font-mono text-midnight-300">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-tactical-teal" />
                      <span>{order.allocated_nodes[0] || '1 Node'}</span>
                    </div>
                  )}
                  {order.is_split && (
                    <div className="text-[10px] font-mono text-tactical-indigoLight/80 mt-0.5 truncate max-w-[160px]" title={order.allocated_nodes.join(', ')}>
                      {order.allocated_nodes.join(', ')}
                    </div>
                  )}
                </td>

                {/* 7. Carrier Information */}
                <td className="py-3 px-4 whitespace-nowrap">
                  {order.delivery_outcome_status === 'CARRIER_UNAVAILABLE' ? (
                    <span className="text-midnight-500 font-mono text-xs italic">Unassigned (0 Carriers)</span>
                  ) : order.is_split && order.carrier_names.length > 1 ? (
                    <div>
                      <div className="flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-tactical-indigoLight" />
                        <span className="font-mono font-semibold text-tactical-indigoLight text-xs">
                          Multi-Carrier ({order.carrier_names.length})
                        </span>
                      </div>
                      <div
                        className="text-[10px] font-mono text-midnight-400 mt-0.5 truncate max-w-[170px]"
                        title={order.carrier_names.join(', ')}
                      >
                        {order.carrier_names.join(', ')}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 font-mono text-midnight-200">
                      <Truck className="w-3.5 h-3.5 text-midnight-400 shrink-0" />
                      <span>{order.carrier_name || order.primary_carrier_id || 'Assigned'}</span>
                    </div>
                  )}
                </td>

                {/* 8. Order Value in INR */}
                <td className="py-3 px-4 whitespace-nowrap text-right font-mono font-semibold text-midnight-100">
                  {inrFormatter.format(order.order_total_inr)}
                </td>

                {/* 9. Delivery Outcome Status */}
                <td className="py-3 px-4 whitespace-nowrap text-center">
                  {order.delivery_outcome_status === 'DELIVERED_ON_TIME' ? (
                    <Badge variant="emerald" size="sm" pulse className="gap-1 font-mono">
                      <CheckCircle2 className="w-3 h-3 text-tactical-emerald" />
                      On-Time
                    </Badge>
                  ) : order.delivery_outcome_status === 'DELIVERED_LATE' ? (
                    <Badge variant="amber" size="sm" className="gap-1 font-mono">
                      <Clock className="w-3 h-3 text-tactical-amber" />
                      Late
                    </Badge>
                  ) : order.delivery_outcome_status === 'CARRIER_UNAVAILABLE' ? (
                    <Badge variant="crimson" size="sm" className="gap-1 font-mono">
                      <AlertTriangle className="w-3 h-3 text-tactical-crimson" />
                      Unavailable
                    </Badge>
                  ) : (
                    <Badge variant="outline" size="sm" className="font-mono">
                      {order.delivery_outcome_status || 'Pending'}
                    </Badge>
                  )}
                </td>

                {/* 10. Action Button */}
                <td className="py-3 px-4 whitespace-nowrap text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectOrder(order.order_id);
                    }}
                    className="h-7 px-2 text-xs font-mono text-midnight-300 hover:text-tactical-teal group-hover:border-midnight-600 gap-1"
                    aria-label={`Inspect order ${order.order_id}`}
                  >
                    <span>Inspect</span>
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
