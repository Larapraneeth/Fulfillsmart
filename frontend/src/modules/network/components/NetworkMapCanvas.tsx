import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  NodeTopologyItem,
  ZoneTopologyItem,
  HistoricalRouteCorridor,
  MapTransform,
  ProjectedPoint,
} from '../../../types/network';
import {
  MAP_DIMENSIONS,
  createIndiaProjection,
  calculateBowedArcPath,
  getCorridorVisualTier,
  GRATICULE_CONFIG,
} from '../data/mapConfig';
import { Compass, Info, ShieldCheck, Route, X, ArrowRight } from 'lucide-react';

export interface NetworkMapCanvasProps {
  nodes: NodeTopologyItem[];
  deliveryZones: ZoneTopologyItem[];
  corridors: HistoricalRouteCorridor[];
  selectedNodeId: string | null;
  selectedZoneId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onSelectZone: (zoneId: string | null) => void;
  selectedCarrierId?: string;
  minShipmentCount?: number;
  showCorridors?: boolean;
  showDeliveryZones?: boolean;
  showFulfillmentNodes?: boolean;
  transform?: MapTransform;
  onTransformChange?: (transform: MapTransform) => void;
  selectedCorridor?: HistoricalRouteCorridor | null;
  onSelectCorridor?: (corridor: HistoricalRouteCorridor | null) => void;
  className?: string;
}

interface HoveredEntity {
  type: 'node' | 'zone' | 'corridor';
  title: string;
  subtitle: string;
  badge?: string;
  metrics: Array<{ label: string; value: string }>;
  disclosure?: string;
}

export function NetworkMapCanvas({
  nodes,
  deliveryZones,
  corridors,
  selectedNodeId,
  selectedZoneId,
  onSelectNode,
  onSelectZone,
  selectedCarrierId = 'ALL',
  minShipmentCount = 0,
  showCorridors = true,
  showDeliveryZones = true,
  showFulfillmentNodes = true,
  transform: controlledTransform,
  onTransformChange,
  selectedCorridor: controlledSelectedCorridor,
  onSelectCorridor,
  className = '',
}: NetworkMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  // -------------------------------------------------------------------------
  // 1. Transform & Viewport State (Controlled or Uncontrolled)
  // -------------------------------------------------------------------------
  const [internalTransform, setInternalTransform] = useState<MapTransform>({
    x: 0,
    y: 0,
    k: MAP_DIMENSIONS.defaultZoom,
  });

  const isControlledTransform = controlledTransform !== undefined;
  const currentTransform = isControlledTransform ? controlledTransform : internalTransform;

  const updateTransform = useCallback(
    (next: MapTransform) => {
      if (!isControlledTransform) {
        setInternalTransform(next);
      }
      if (onTransformChange) {
        onTransformChange(next);
      }
    },
    [isControlledTransform, onTransformChange]
  );

  // -------------------------------------------------------------------------
  // 2. Persistent Selected Corridor State
  // -------------------------------------------------------------------------
  const [internalPinnedCorridor, setInternalPinnedCorridor] =
    useState<HistoricalRouteCorridor | null>(null);

  const activePinnedCorridor =
    controlledSelectedCorridor !== undefined
      ? controlledSelectedCorridor
      : internalPinnedCorridor;

  const handleCorridorSelect = useCallback(
    (corridor: HistoricalRouteCorridor | null) => {
      if (controlledSelectedCorridor === undefined) {
        setInternalPinnedCorridor(corridor);
      }
      if (onSelectCorridor) {
        onSelectCorridor(corridor);
      }
    },
    [controlledSelectedCorridor, onSelectCorridor]
  );

  // Keyboard Escape listener to dismiss pinned corridor card
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activePinnedCorridor) {
        handleCorridorSelect(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePinnedCorridor, handleCorridorSelect]);

  // -------------------------------------------------------------------------
  // 3. Hover Tooltip State (Optimized to Avoid Rerendering on Mouse Movement)
  // -------------------------------------------------------------------------
  const [hoveredEntity, setHoveredEntity] = useState<HoveredEntity | null>(null);

  // -------------------------------------------------------------------------
  // 4. Mouse & Touch Drag-Pan State
  // -------------------------------------------------------------------------
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  const touchStartRef = useRef<{
    touchX: number;
    touchY: number;
    initialX: number;
    initialY: number;
    initialPinchDist?: number;
    initialK?: number;
  } | null>(null);

  const rafRef = useRef<number | null>(null);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // 5. Stable D3 Mercator Projection (Centered on India ~79.5°E, ~22.2°N)
  // -------------------------------------------------------------------------
  const projection = useMemo(() => {
    return createIndiaProjection(MAP_DIMENSIONS.width, MAP_DIMENSIONS.height);
  }, []);

  // -------------------------------------------------------------------------
  // 6. Project Nodes (Exact Facility Coordinates - Preserved Untouched)
  // -------------------------------------------------------------------------
  const projectedNodes = useMemo(() => {
    const map = new Map<string, { node: NodeTopologyItem; point: ProjectedPoint }>();
    for (const node of nodes) {
      if (
        typeof node.latitude === 'number' &&
        typeof node.longitude === 'number' &&
        isFinite(node.latitude) &&
        isFinite(node.longitude)
      ) {
        const coords = projection([node.longitude, node.latitude]);
        if (coords && isFinite(coords[0]) && isFinite(coords[1])) {
          map.set(node.node_id, {
            node,
            point: { x: coords[0], y: coords[1] },
          });
        }
      }
    }
    return map;
  }, [nodes, projection]);

  // -------------------------------------------------------------------------
  // 7. Project Delivery Zones (Approximate Urban Centroids - Preserved Untouched)
  // -------------------------------------------------------------------------
  const projectedZones = useMemo(() => {
    const map = new Map<string, { zone: ZoneTopologyItem; point: ProjectedPoint }>();
    for (const zone of deliveryZones) {
      if (
        typeof zone.latitude === 'number' &&
        typeof zone.longitude === 'number' &&
        isFinite(zone.latitude) &&
        isFinite(zone.longitude)
      ) {
        const coords = projection([zone.longitude, zone.latitude]);
        if (coords && isFinite(coords[0]) && isFinite(coords[1])) {
          map.set(zone.delivery_zone_id, {
            zone,
            point: { x: coords[0], y: coords[1] },
          });
        }
      }
    }
    return map;
  }, [deliveryZones, projection]);

  // -------------------------------------------------------------------------
  // 8. Co-location Detection for Visual Display Offset (6px Separation)
  // Original coordinates are 100% preserved; offset is used strictly for rendering pins.
  // -------------------------------------------------------------------------
  const coLocatedSet = useMemo(() => {
    const nodeSet = new Set<string>();
    const zoneSet = new Set<string>();
    for (const [nodeId, { point: np }] of projectedNodes.entries()) {
      for (const [zoneId, { point: zp }] of projectedZones.entries()) {
        const dx = np.x - zp.x;
        const dy = np.y - zp.y;
        // Within 2 projected pixels indicates co-located city coordinates
        if (dx * dx + dy * dy < 4) {
          nodeSet.add(nodeId);
          zoneSet.add(zoneId);
        }
      }
    }
    return { nodes: nodeSet, zones: zoneSet };
  }, [projectedNodes, projectedZones]);

  // -------------------------------------------------------------------------
  // 9. Filter and Project Corridors (Uses True Geodesic Coordinates, Zero Offset)
  // -------------------------------------------------------------------------
  const renderedCorridors = useMemo(() => {
    if (!showCorridors) return [];

    return corridors
      .filter((c) => {
        if (selectedCarrierId !== 'ALL' && c.carrier_id !== selectedCarrierId) {
          return false;
        }
        if (c.historical_shipment_count < minShipmentCount) {
          return false;
        }
        return true;
      })
      .map((c) => {
        const origin = projectedNodes.get(c.node_id)?.point;
        const destination = projectedZones.get(c.delivery_zone_id)?.point;
        if (!origin || !destination) return null;

        // Curved arc connects true unshifted geographic endpoints
        const path = calculateBowedArcPath(origin, destination, 0.12);
        const tier = getCorridorVisualTier(c.historical_shipment_count);

        const isPinned =
          activePinnedCorridor !== null &&
          activePinnedCorridor.node_id === c.node_id &&
          activePinnedCorridor.delivery_zone_id === c.delivery_zone_id &&
          activePinnedCorridor.carrier_id === c.carrier_id;

        const isConnectedToSelected =
          isPinned ||
          (selectedNodeId && c.node_id === selectedNodeId) ||
          (selectedZoneId && c.delivery_zone_id === selectedZoneId);

        return {
          corridor: c,
          path,
          tier,
          isPinned,
          isConnectedToSelected: Boolean(isConnectedToSelected),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [
    corridors,
    showCorridors,
    selectedCarrierId,
    minShipmentCount,
    projectedNodes,
    projectedZones,
    selectedNodeId,
    selectedZoneId,
    activePinnedCorridor,
  ]);

  // -------------------------------------------------------------------------
  // 10. Compute WGS-84 Graticule Lines (Parallels & Meridians across India)
  // -------------------------------------------------------------------------
  const graticuleLines = useMemo(() => {
    const parallels: Array<{ id: string; d: string; label: string; x: number; y: number }> = [];
    const meridians: Array<{ id: string; d: string; label: string; x: number; y: number }> = [];

    // Latitude parallels (horizontal in Mercator)
    for (const lat of GRATICULE_CONFIG.latitudes) {
      const pStart = projection([68, lat]);
      const pEnd = projection([96, lat]);
      if (pStart && pEnd && isFinite(pStart[0]) && isFinite(pEnd[0])) {
        parallels.push({
          id: `lat-${lat}`,
          d: `M ${pStart[0].toFixed(1)} ${pStart[1].toFixed(1)} L ${pEnd[0].toFixed(1)} ${pEnd[1].toFixed(1)}`,
          label: `${lat}°N`,
          x: Math.max(14, pStart[0] - 28),
          y: pStart[1] + 3,
        });
      }
    }

    // Longitude meridians (vertical in Mercator)
    for (const lon of GRATICULE_CONFIG.longitudes) {
      const pStart = projection([lon, 8]);
      const pEnd = projection([lon, 36]);
      if (pStart && pEnd && isFinite(pStart[1]) && isFinite(pEnd[1])) {
        meridians.push({
          id: `lon-${lon}`,
          d: `M ${pStart[0].toFixed(1)} ${pStart[1].toFixed(1)} L ${pEnd[0].toFixed(1)} ${pEnd[1].toFixed(1)}`,
          label: `${lon}°E`,
          x: pStart[0],
          y: Math.min(MAP_DIMENSIONS.height - 24, pStart[1] + 14),
        });
      }
    }

    return { parallels, meridians };
  }, [projection]);

  // -------------------------------------------------------------------------
  // 11. Performance-Optimized Tooltip Position Tracker (Direct DOM transform)
  // -------------------------------------------------------------------------
  const updateTooltipPosition = useCallback((clientX: number, clientY: number) => {
    if (tooltipRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = clientX - rect.left;
      const rawY = clientY - rect.top;
      const clampedX = Math.min(Math.max(12, rawX + 16), rect.width - 290);
      const clampedY = Math.min(Math.max(12, rawY - 12), rect.height - 200);
      tooltipRef.current.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
    }
  }, []);

  // Helper for immediate hover (nodes & zones)
  const setEntityHoverImmediate = useCallback(
    (entity: HoveredEntity, clientX: number, clientY: number) => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      setHoveredEntity(entity);
      updateTooltipPosition(clientX, clientY);
    },
    [updateTooltipPosition]
  );

  // Helper for debounced hover (corridors: 60ms delay prevents sweep stutter)
  const setCorridorHoverDebounced = useCallback(
    (entity: HoveredEntity, clientX: number, clientY: number) => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
      hoverTimeoutRef.current = window.setTimeout(() => {
        setHoveredEntity(entity);
        updateTooltipPosition(clientX, clientY);
      }, 60);
    },
    [updateTooltipPosition]
  );

  const clearHover = useCallback(() => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredEntity(null);
  }, []);

  // -------------------------------------------------------------------------
  // 12. Mouse Pan & Drag Handlers
  // -------------------------------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Check closest interactive element to avoid dragging when clicking nodes/zones/corridors
    if (target.closest('[data-interactive="true"]')) return;

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: currentTransform.x,
      initialY: currentTransform.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (dragStartRef.current) {
          updateTransform({
            ...currentTransform,
            x: dragStartRef.current.initialX + dx,
            y: dragStartRef.current.initialY + dy,
          });
        }
      });
    } else if (hoveredEntity) {
      updateTooltipPosition(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newK = Math.min(
      MAP_DIMENSIONS.maxZoom,
      Math.max(MAP_DIMENSIONS.minZoom, currentTransform.k * zoomFactor)
    );
    if (newK !== currentTransform.k) {
      updateTransform({
        ...currentTransform,
        k: newK,
      });
    }
  };

  // -------------------------------------------------------------------------
  // 13. Touch Handlers (Single-finger Pan & Two-finger Pinch Zoom)
  // -------------------------------------------------------------------------
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-interactive="true"]')) return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartRef.current = {
        touchX: touch.clientX,
        touchY: touch.clientY,
        initialX: currentTransform.x,
        initialY: currentTransform.y,
      };
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchStartRef.current = {
        touchX: (t1.clientX + t2.clientX) / 2,
        touchY: (t1.clientY + t2.clientY) / 2,
        initialX: currentTransform.x,
        initialY: currentTransform.y,
        initialPinchDist: dist,
        initialK: currentTransform.k,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    if (e.touches.length === 1 && touchStartRef.current.initialPinchDist === undefined) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.touchX;
      const dy = touch.clientY - touchStartRef.current.touchY;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (touchStartRef.current) {
          updateTransform({
            ...currentTransform,
            x: touchStartRef.current.initialX + dx,
            y: touchStartRef.current.initialY + dy,
          });
        }
      });
    } else if (
      e.touches.length === 2 &&
      touchStartRef.current.initialPinchDist !== undefined &&
      touchStartRef.current.initialK !== undefined
    ) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const scaleRatio = dist / touchStartRef.current.initialPinchDist;
      const newK = Math.min(
        MAP_DIMENSIONS.maxZoom,
        Math.max(MAP_DIMENSIONS.minZoom, touchStartRef.current.initialK * scaleRatio)
      );

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        updateTransform({
          ...currentTransform,
          k: newK,
        });
      });
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[540px] sm:h-[620px] rounded-xl bg-midnight-950 border border-midnight-700/80 overflow-hidden flex flex-col justify-between ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        clearHover();
      }}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      aria-label="Interactive India Fulfillment Network Map Canvas"
    >
      {/* Accessible Screen-Reader Live Region */}
      <div className="sr-only" aria-live="polite">
        <h3>Pan-India Tactical Network Map</h3>
        <p>
          Vector map displaying {nodes.length} fulfillment nodes (circle markers),{' '}
          {deliveryZones.length} delivery zone centroids (diamond markers), and{' '}
          {renderedCorridors.length} historical route corridors.
          {selectedNodeId ? ` Currently selected warehouse: ${selectedNodeId}.` : ''}
          {selectedZoneId ? ` Currently selected delivery zone: ${selectedZoneId}.` : ''}
          {activePinnedCorridor
            ? ` Pinned route corridor: ${activePinnedCorridor.node_city} to ${activePinnedCorridor.zone_city} via ${activePinnedCorridor.carrier_name}, ${activePinnedCorridor.historical_shipment_count} shipments, ${activePinnedCorridor.haversine_distance_km.toFixed(1)} km Haversine distance.`
            : ''}
          Use Tab to cycle through facility nodes, zones, and route corridors. Press Enter to inspect.
        </p>
      </div>

      {/* SVG Vector Canvas */}
      <svg
        viewBox={`0 0 ${MAP_DIMENSIONS.width} ${MAP_DIMENSIONS.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full select-none"
        role="region"
        aria-label="Tactical India Fulfillment Network Topology Vector Grid"
      >
        <title>FulfillSmart India Fulfillment Network Map</title>
        <desc>
          Pan-India fulfillment topology with 20 warehouse nodes, 50 delivery zone centroids, and
          150 historical route corridors plotted on a WGS-84 coordinate graticule grid.
        </desc>

        {/* Global Transform Group (Pan & Zoom) */}
        <g transform={`translate(${currentTransform.x}, ${currentTransform.y}) scale(${currentTransform.k})`}>
          {/* Layer 1: WGS-84 Graticule Coordinate Grid */}
          <g className="graticule-grid opacity-35" aria-hidden="true">
            {/* Parallels (Latitudes) */}
            {graticuleLines.parallels.map((line) => (
              <g key={line.id}>
                <path
                  d={line.d}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="0.75"
                  strokeDasharray="3,4"
                />
                <text
                  x={line.x}
                  y={line.y}
                  fill="#64748B"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="pointer-events-none"
                >
                  {line.label}
                </text>
              </g>
            ))}

            {/* Meridians (Longitudes) */}
            {graticuleLines.meridians.map((line) => (
              <g key={line.id}>
                <path
                  d={line.d}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="0.75"
                  strokeDasharray="3,4"
                />
                <text
                  x={line.x}
                  y={line.y}
                  fill="#64748B"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="pointer-events-none"
                >
                  {line.label}
                </text>
              </g>
            ))}

            {/* Geographic Center Crosshair [79.5°E, 22.2°N] */}
            <circle cx="400" cy="310" r="3" fill="#00F2FE" fillOpacity="0.4" />
            <circle
              cx="400"
              cy="310"
              r="14"
              fill="none"
              stroke="#00F2FE"
              strokeWidth="0.75"
              strokeOpacity="0.3"
              strokeDasharray="2,2"
            />
          </g>

          {/* Layer 2: Historical Route Corridors (Bézier Arcs - Rendered Behind Markers) */}
          {showCorridors && (
            <g className="corridors-layer">
              {renderedCorridors.map((item) => {
                const isSelected = item.isConnectedToSelected;
                const isPinned = item.isPinned;
                const isDimmed =
                  (selectedNodeId || selectedZoneId || activePinnedCorridor) && !isSelected;

                const strokeColor = isPinned
                  ? '#F59E0B'
                  : isSelected
                  ? '#00F2FE'
                  : item.tier.color;

                const strokeWidth = isPinned
                  ? 3.5
                  : isSelected
                  ? Math.max(2.5, item.tier.strokeWidth * 1.5)
                  : item.tier.strokeWidth;

                const opacity = isDimmed ? 0.12 : isSelected ? 0.98 : item.tier.opacity;

                const c = item.corridor;
                const corridorKey = `${c.node_id}-${c.delivery_zone_id}-${c.carrier_id}`;

                return (
                  <g
                    key={corridorKey}
                    tabIndex={0}
                    role="button"
                    data-interactive="true"
                    aria-label={`Route corridor from ${c.node_city} to ${c.zone_city} via ${c.carrier_name}, ${c.historical_shipment_count} shipments, ${c.haversine_distance_km.toFixed(1)} km Haversine distance`}
                    className="cursor-pointer focus:outline-none group"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCorridorSelect(isPinned ? null : c);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCorridorSelect(isPinned ? null : c);
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseEnter={(e) =>
                      setCorridorHoverDebounced(
                        {
                          type: 'corridor',
                          title: `${c.node_city} → ${c.zone_city}`,
                          subtitle: `Carrier: ${c.carrier_name} (${c.carrier_id})`,
                          badge: `${c.historical_shipment_count.toLocaleString()} Shipments`,
                          metrics: [
                            {
                              label: 'Haversine Distance',
                              value: `${c.haversine_distance_km.toFixed(1)} km`,
                            },
                            {
                              label: 'Origin Hub',
                              value: `${c.node_city} (${c.node_id})`,
                            },
                            {
                              label: 'Destination Zone',
                              value: `${c.zone_city} (${c.delivery_zone_id})`,
                            },
                          ],
                          disclosure:
                            'Straight-line geodesic displacement (Haversine formula), not highway driving distance.',
                        },
                        e.clientX,
                        e.clientY
                      )
                    }
                    onMouseLeave={clearHover}
                  >
                    {/* Visible Arc Path */}
                    <path
                      d={item.path}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeOpacity={opacity}
                      strokeLinecap="round"
                      className="group-focus-visible:stroke-tactical-amber group-focus-visible:stroke-[3.5] group-focus-visible:stroke-opacity-100"
                    />

                    {/* Transparent Hit Target for Mouse & Touch (12px) */}
                    <path
                      d={item.path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="12"
                      className="cursor-pointer"
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Layer 3: Delivery Zones (Distinct Diamond Markers ◆ - Rendered Above Corridors) */}
          {showDeliveryZones && (
            <g className="delivery-zones-layer">
              {Array.from(projectedZones.values()).map(({ zone, point }) => {
                const isSelected = zone.delivery_zone_id === selectedZoneId;
                const dSize = isSelected ? 7 : 5;

                // Visual separation: in co-located cities, offset zone by +6px X (East)
                const isCoLocated = coLocatedSet.zones.has(zone.delivery_zone_id);
                const displayX = isCoLocated ? point.x + 6 : point.x;
                const displayY = point.y;

                return (
                  <g
                    key={zone.delivery_zone_id}
                    tabIndex={0}
                    role="button"
                    data-interactive="true"
                    aria-pressed={isSelected}
                    aria-label={`Delivery Zone: ${zone.zone_name} in ${zone.city}, Region ${zone.region}, Received Orders: ${zone.total_orders_received.toLocaleString()}`}
                    className="cursor-pointer focus:outline-none group"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectZone(isSelected ? null : zone.delivery_zone_id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectZone(isSelected ? null : zone.delivery_zone_id);
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseEnter={(e) =>
                      setEntityHoverImmediate(
                        {
                          type: 'zone',
                          title: zone.zone_name,
                          subtitle: `${zone.city}, ${zone.state} (${zone.region} Region)`,
                          badge: `${zone.distance_band} Band`,
                          metrics: [
                            {
                              label: 'Total Orders Received',
                              value: `${zone.total_orders_received.toLocaleString()} orders`,
                            },
                            {
                              label: 'Zone ID',
                              value: zone.delivery_zone_id,
                            },
                            {
                              label: 'Synthetic Pincode',
                              value: zone.synthetic_pincode,
                            },
                          ],
                          disclosure:
                            'Approximate urban city centroid coordinates (derived from geo_centroids.py), not customer drop-off address.',
                        },
                        e.clientX,
                        e.clientY
                      )
                    }
                    onMouseLeave={clearHover}
                  >
                    {/* 32px Diameter Invisible Expanded Hit Target Circle (r=16) */}
                    <circle
                      cx={displayX}
                      cy={displayY}
                      r={16}
                      fill="transparent"
                      pointerEvents="all"
                      className="cursor-pointer"
                    />

                    {/* Outer Diamond Selection Halo (Static, high-contrast, zero-jitter) */}
                    {isSelected && (
                      <polygon
                        points={`${displayX},${displayY - 12} ${displayX + 12},${displayY} ${displayX},${displayY + 12} ${displayX - 12},${displayY}`}
                        fill="#06B6D4"
                        fillOpacity="0.22"
                        stroke="#06B6D4"
                        strokeWidth="1.75"
                        strokeDasharray="3,2"
                      />
                    )}

                    {/* Diamond Marker Shape (Stable Vector Attributes - Zero CSS Transform Scale) */}
                    <polygon
                      points={`${displayX},${displayY - dSize} ${displayX + dSize},${displayY} ${displayX},${displayY + dSize} ${displayX - dSize},${displayY}`}
                      fill={isSelected ? '#06B6D4' : '#082F49'}
                      stroke="#06B6D4"
                      strokeWidth={isSelected ? '2.25' : '1.5'}
                      className="group-hover:stroke-white group-hover:stroke-[2.25] group-focus-visible:stroke-white group-focus-visible:stroke-[3]"
                    />

                    {/* City Name Label (Visible if Selected or Zoomed In - Positioned Below) */}
                    {(isSelected || currentTransform.k >= 1.5) && (
                      <text
                        x={displayX}
                        y={displayY + 15}
                        fill="#A5F3FC"
                        fontSize="9"
                        fontFamily="monospace"
                        textAnchor="middle"
                        className="pointer-events-none drop-shadow-sm font-semibold"
                      >
                        {zone.city}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Layer 4: Fulfillment Nodes (Distinct Concentric Circle Markers ● - Rendered Above Zones) */}
          {showFulfillmentNodes && (
            <g className="fulfillment-nodes-layer">
              {Array.from(projectedNodes.values()).map(({ node, point }) => {
                const isSelected = node.node_id === selectedNodeId;
                const radius = isSelected ? 6.5 : 5;

                // Visual separation: in co-located cities, offset node by -6px X (West)
                const isCoLocated = coLocatedSet.nodes.has(node.node_id);
                const displayX = isCoLocated ? point.x - 6 : point.x;
                const displayY = point.y;

                return (
                  <g
                    key={node.node_id}
                    tabIndex={0}
                    role="button"
                    data-interactive="true"
                    aria-pressed={isSelected}
                    aria-label={`Warehouse: ${node.node_name} in ${node.city}, Type: ${node.node_type}, Daily Capacity: ${node.daily_order_capacity.toLocaleString()} orders`}
                    className="cursor-pointer focus:outline-none group"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNode(isSelected ? null : node.node_id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectNode(isSelected ? null : node.node_id);
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseEnter={(e) =>
                      setEntityHoverImmediate(
                        {
                          type: 'node',
                          title: node.node_name,
                          subtitle: `${node.city}, ${node.state} (Pincode: ${node.node_pincode})`,
                          badge: node.node_type.replace(/_/g, ' '),
                          metrics: [
                            {
                              label: 'Daily Order Limit',
                              value: `${node.daily_order_capacity.toLocaleString()} orders/day`,
                            },
                            {
                              label: '260-Day Cumulative Alloc',
                              value: `${node.allocated_orders_total.toLocaleString()} orders`,
                            },
                            {
                              label: 'Period Utilization',
                              value: `${node.order_utilization_pct.toFixed(1)}%`,
                            },
                          ],
                          disclosure:
                            'Exact facility coordinates sourced directly from master database (fulfillment_nodes table).',
                        },
                        e.clientX,
                        e.clientY
                      )
                    }
                    onMouseLeave={clearHover}
                  >
                    {/* 32px Diameter Invisible Expanded Hit Target Circle (r=16) */}
                    <circle
                      cx={displayX}
                      cy={displayY}
                      r={16}
                      fill="transparent"
                      pointerEvents="all"
                      className="cursor-pointer"
                    />

                    {/* Outer Target Ring Halo (Static, high-contrast, zero-jitter) */}
                    {isSelected && (
                      <circle
                        cx={displayX}
                        cy={displayY}
                        r="14"
                        fill="#00F2FE"
                        fillOpacity="0.22"
                        stroke="#00F2FE"
                        strokeWidth="1.75"
                        strokeDasharray="3,2"
                      />
                    )}

                    {/* Concentric Node Circle (Stable Vector Attributes - Zero CSS Transform Scale) */}
                    <circle
                      cx={displayX}
                      cy={displayY}
                      r={radius}
                      fill={isSelected ? '#00F2FE' : '#042F2E'}
                      stroke="#00F2FE"
                      strokeWidth={isSelected ? '2.25' : '1.5'}
                      className="group-hover:stroke-white group-hover:stroke-[2.25] group-focus-visible:stroke-white group-focus-visible:stroke-[3]"
                    />

                    {/* Center Core Dot */}
                    <circle
                      cx={displayX}
                      cy={displayY}
                      r="1.75"
                      fill={isSelected ? '#060913' : '#00F2FE'}
                      className="pointer-events-none"
                    />

                    {/* Node City Label (Positioned Above to Avoid Overlap with Zone Label Below) */}
                    {(isSelected || currentTransform.k >= 1.25) && (
                      <text
                        x={displayX}
                        y={displayY - 11}
                        fill="#E2E8F0"
                        fontSize="9.5"
                        fontFamily="monospace"
                        textAnchor="middle"
                        className="pointer-events-none drop-shadow-sm font-bold tracking-tight"
                      >
                        {node.city}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}
        </g>
      </svg>

      {/* Persistent Pinned Corridor Detail Card (Available After Pointer Leaves) */}
      {activePinnedCorridor && (
        <div
          data-interactive="true"
          className="absolute top-3 right-3 z-20 p-3.5 rounded-xl bg-midnight-950/95 backdrop-blur-md border border-tactical-amber/50 shadow-2xl max-w-sm font-mono text-xs animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center justify-between gap-3 border-b border-midnight-800 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Route className="w-4 h-4 text-tactical-amber shrink-0" aria-hidden="true" />
              <span className="font-bold text-midnight-100 truncate text-xs">
                {activePinnedCorridor.node_city} → {activePinnedCorridor.zone_city}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCorridorSelect(null)}
              className="p-1 rounded text-midnight-400 hover:text-midnight-100 hover:bg-midnight-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tactical-amber"
              aria-label="Close pinned corridor details"
              title="Close (Esc)"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-1.5 mb-3 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-midnight-400">Carrier:</span>
              <span className="font-semibold text-tactical-cyan">
                {activePinnedCorridor.carrier_name} ({activePinnedCorridor.carrier_id})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-midnight-400">Historical Shipments:</span>
              <span className="font-bold text-tactical-amber">
                {activePinnedCorridor.historical_shipment_count.toLocaleString()} shipments
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-midnight-400">Haversine Distance:</span>
              <span className="font-semibold text-midnight-200">
                {activePinnedCorridor.haversine_distance_km.toFixed(1)} km
              </span>
            </div>
          </div>

          {/* Quick Inspector Jump Buttons */}
          <div className="flex items-center gap-2 mb-2 font-sans text-xs">
            <button
              type="button"
              onClick={() => onSelectNode(activePinnedCorridor.node_id)}
              className="flex-1 px-2 py-1 rounded bg-midnight-900 hover:bg-midnight-800 border border-midnight-700 hover:border-tactical-teal text-tactical-teal text-[11px] font-mono flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tactical-teal"
              aria-label={`Inspect warehouse node in ${activePinnedCorridor.node_city}`}
            >
              <span>{activePinnedCorridor.node_city} Hub</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onSelectZone(activePinnedCorridor.delivery_zone_id)}
              className="flex-1 px-2 py-1 rounded bg-midnight-900 hover:bg-midnight-800 border border-midnight-700 hover:border-tactical-cyan text-tactical-cyan text-[11px] font-mono flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tactical-cyan"
              aria-label={`Inspect delivery zone in ${activePinnedCorridor.zone_city}`}
            >
              <span>{activePinnedCorridor.zone_city} Zone</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </button>
          </div>

          <div className="pt-2 border-t border-midnight-900 text-[10px] text-midnight-400 leading-tight font-sans flex items-start gap-1">
            <Info className="w-3 h-3 text-tactical-amber shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Straight-line geodesic displacement (Haversine formula), not highway driving distance.
            </span>
          </div>
        </div>
      )}

      {/* Floating Tactical Tooltip (Positioned via CSS transform without full re-render) */}
      <div
        ref={tooltipRef}
        className={`absolute top-0 left-0 z-20 pointer-events-none p-3 rounded-lg bg-midnight-950/95 backdrop-blur-md border border-midnight-700 shadow-2xl max-w-xs font-mono text-xs transition-opacity duration-150 ${
          hoveredEntity && !activePinnedCorridor ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ willChange: 'transform' }}
        aria-hidden={!hoveredEntity || Boolean(activePinnedCorridor)}
      >
        {hoveredEntity && (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-midnight-800 pb-1.5 mb-2">
              <span
                className={`font-semibold ${
                  hoveredEntity.type === 'node'
                    ? 'text-tactical-teal'
                    : hoveredEntity.type === 'zone'
                    ? 'text-tactical-cyan'
                    : 'text-tactical-amber'
                }`}
              >
                {hoveredEntity.title}
              </span>
              {hoveredEntity.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-midnight-900 border border-midnight-700 text-midnight-300">
                  {hoveredEntity.badge}
                </span>
              )}
            </div>

            <div className="text-[11px] text-midnight-400 mb-2 font-sans">
              {hoveredEntity.subtitle}
            </div>

            <div className="space-y-1 mb-2">
              {hoveredEntity.metrics.map((m) => (
                <div key={m.label} className="flex justify-between text-[11px]">
                  <span className="text-midnight-400">{m.label}:</span>
                  <span className="font-semibold text-midnight-200">{m.value}</span>
                </div>
              ))}
            </div>

            {hoveredEntity.disclosure && (
              <div className="pt-1.5 border-t border-midnight-900 text-[10px] text-midnight-400 leading-tight font-sans flex items-start gap-1">
                <Info className="w-3 h-3 text-tactical-cyan shrink-0 mt-0.5" aria-hidden="true" />
                <span>{hoveredEntity.disclosure}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Canvas Header Tactical Crosshair & Coordinates HUD */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none text-[11px] font-mono text-midnight-400 bg-midnight-950/70 backdrop-blur-sm px-2.5 py-1 rounded border border-midnight-800/80">
        <Compass className="w-3.5 h-3.5 text-tactical-teal" aria-hidden="true" />
        <span>WGS-84 Mercator (Center: 79.5°E, 22.2°N)</span>
      </div>

      {/* Floating Tactical Legend Bar (Bottom Overlay with pointer-events-none to prevent blocking) */}
      <div className="absolute bottom-2.5 left-3 right-3 z-10 pointer-events-none flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-midnight-950/85 backdrop-blur-sm border border-midnight-800 text-[11px] font-mono">
        <div className="flex flex-wrap items-center gap-3">
          {/* Node Legend (Circle) */}
          <span className="flex items-center gap-1.5 text-midnight-300">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full bg-tactical-teal border border-teal-300"
              aria-hidden="true"
            />
            <span>● 20 Warehouses (Exact WGS-84)</span>
          </span>

          {/* Zone Legend (Diamond) */}
          <span className="flex items-center gap-1.5 text-midnight-300">
            <span
              className="inline-block w-2.5 h-2.5 rotate-45 bg-tactical-cyan border border-cyan-300"
              aria-hidden="true"
            />
            <span>◆ 50 Zones (Urban Centroids)</span>
          </span>

          {/* Corridor Legend (Curved Arc) */}
          <span className="flex items-center gap-1.5 text-midnight-300">
            <span className="text-tactical-amber font-bold" aria-hidden="true">
              ⌒
            </span>
            <span>{renderedCorridors.length} Corridors (Straight-Line Haversine)</span>
          </span>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-midnight-500 font-sans">
          <ShieldCheck className="w-3.5 h-3.5 text-tactical-teal shrink-0" aria-hidden="true" />
          <span>Point-to-point geodesic topology. No fabricated political boundaries.</span>
        </div>
      </div>
    </div>
  );
}
