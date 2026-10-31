/**
 * FulfillSmart Tactical Map Configuration & Projection Utilities
 *
 * GEOGRAPHIC BOUNDARY & PROVENANCE DISCLOSURE:
 * 1. Deliberate Omission of Fabricated Boundary Polygons:
 *    Authoritative, legally verified Survey of India boundary GeoJSON assets are not
 *    bundled in this offline sandbox. In accordance with strict compliance and cartographic
 *    integrity guidelines, unverified or hand-drawn third-party boundary polygons are NOT
 *    fabricated.
 * 2. Tactical Point-to-Point Topology:
 *    The network canvas renders a calibrated geographic graticule coordinate grid (WGS-84),
 *    plotting exact facility node coordinates (from master database) and approximate
 *    urban city-centroid coordinates (from internal network reference table) connected by
 *    straight-line geodesic Haversine corridors.
 * 3. Distance Disclosure:
 *    All corridor distances represent geodesic spherical displacement (Haversine formula).
 *    Actual highway driving distances and road transit times are not calculated by this system.
 */

import { geoMercator, GeoProjection } from 'd3-geo';
import { ProjectedPoint } from '../../../types/network';

export const MAP_DIMENSIONS = {
  width: 800,
  height: 620,
  minZoom: 0.8,
  maxZoom: 5.0,
  defaultZoom: 1.0,
};

/**
 * Creates a calibrated Mercator projection centered on the geographic center of India.
 * Longitude: ~79.5°E, Latitude: ~22.2°N.
 */
export function createIndiaProjection(
  width: number = MAP_DIMENSIONS.width,
  height: number = MAP_DIMENSIONS.height
): GeoProjection {
  return geoMercator()
    .center([79.5, 22.2])
    .scale(1150)
    .translate([width / 2, height / 2]);
}

/**
 * Computes an SVG Quadratic Bézier curve string connecting two projected points
 * with a subtle perpendicular bowing effect for tactical corridor visualization.
 */
export function calculateBowedArcPath(
  p1: ProjectedPoint,
  p2: ProjectedPoint,
  curvature: number = 0.12
): string {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) return `M ${p1.x} ${p1.y}`;

  // Perpendicular normal vector
  const nx = -dy / dist;
  const ny = dx / dist;

  // Midpoint with slight perpendicular displacement
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const offset = dist * curvature;

  const cx = mx + nx * offset;
  const cy = my + ny * offset;

  return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
}

/**
 * Classifies shipment count into visual line weights and opacity tiers.
 */
export function getCorridorVisualTier(shipmentCount: number) {
  if (shipmentCount >= 140) {
    return {
      strokeWidth: 2.5,
      opacity: 0.85,
      className: 'high-volume',
      color: '#00F2FE', // Tactical Teal
    };
  }
  if (shipmentCount >= 100) {
    return {
      strokeWidth: 1.75,
      opacity: 0.6,
      className: 'medium-volume',
      color: '#06B6D4', // Tactical Cyan
    };
  }
  return {
    strokeWidth: 1.0,
    opacity: 0.35,
    className: 'low-volume',
    color: '#64748B', // Muted Slate
  };
}

/**
 * Graticule parallels (Latitude) and meridians (Longitude) for India coverage.
 * Latitude: 8°N to 36°N (every 4°)
 * Longitude: 68°E to 96°E (every 4°)
 */
export const GRATICULE_CONFIG = {
  latitudes: [8, 12, 16, 20, 24, 28, 32, 36],
  longitudes: [68, 72, 76, 80, 84, 88, 92, 96],
};
