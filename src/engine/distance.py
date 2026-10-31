r"""
FulfillSmart Distance Calculation Service
Calculates approximate straight-line Haversine spherical distance between fulfillment nodes
and synthetic Indian delivery zones.

IMPORTANT NOTE:
All distances calculated by this module are approximate straight-line spherical distances (in km).
They represent direct geographic displacement based on documented, deterministic city coordinates,
and are NOT actual road-routing, highway network, or turn-by-turn navigation distances.
"""
import math
from typing import Dict, List, Tuple
from src.db import get_db_connection

# Deterministic geographic coordinates for the 50 synthetic Indian delivery zones
# Anchored to the primary coordinates of each destination city
ZONE_COORDINATES: Dict[str, Tuple[float, float]] = {
    "DZ-001": (17.3850, 78.4867),  # Hyderabad, Telangana
    "DZ-002": (12.9716, 77.5946),  # Bengaluru, Karnataka
    "DZ-003": (13.0827, 80.2707),  # Chennai, Tamil Nadu
    "DZ-004": (17.6868, 83.2185),  # Visakhapatnam, Andhra Pradesh
    "DZ-005": (9.9312, 76.2673),   # Kochi, Kerala
    "DZ-006": (19.0760, 72.8777),  # Mumbai, Maharashtra
    "DZ-007": (23.0225, 72.5714),  # Ahmedabad, Gujarat
    "DZ-008": (15.4909, 73.8278),  # Panaji, Goa
    "DZ-009": (26.9124, 75.7873),  # Jaipur, Rajasthan
    "DZ-010": (28.6139, 77.2090),  # Delhi, Delhi
    "DZ-011": (28.4595, 77.0266),  # Gurugram, Haryana
    "DZ-012": (30.9010, 75.8573),  # Ludhiana, Punjab
    "DZ-013": (26.8467, 80.9462),  # Lucknow, Uttar Pradesh
    "DZ-014": (30.3165, 78.0322),  # Dehradun, Uttarakhand
    "DZ-015": (31.1048, 77.1734),  # Shimla, Himachal Pradesh
    "DZ-016": (32.7266, 74.8570),  # Jammu, Jammu and Kashmir
    "DZ-017": (22.5726, 88.3639),  # Kolkata, West Bengal
    "DZ-018": (25.5941, 85.1376),  # Patna, Bihar
    "DZ-019": (20.2961, 85.8245),  # Bhubaneswar, Odisha
    "DZ-020": (23.3441, 85.3096),  # Ranchi, Jharkhand
    "DZ-021": (26.1445, 91.7362),  # Guwahati, Assam
    "DZ-022": (25.5788, 91.8933),  # Shillong, Meghalaya
    "DZ-023": (24.8170, 93.9368),  # Imphal, Manipur
    "DZ-024": (23.8315, 91.2868),  # Agartala, Tripura
    "DZ-025": (23.7271, 92.7176),  # Aizawl, Mizoram
    "DZ-026": (25.6751, 94.1086),  # Kohima, Nagaland
    "DZ-027": (27.0844, 93.6053),  # Itanagar, Arunachal Pradesh
    "DZ-028": (23.2599, 77.4126),  # Bhopal, Madhya Pradesh
    "DZ-029": (21.2514, 81.6296),  # Raipur, Chhattisgarh
    "DZ-030": (26.4499, 80.3319),  # Kanpur, Uttar Pradesh
    "DZ-031": (18.5204, 73.8567),  # Pune, Maharashtra
    "DZ-032": (21.1458, 79.0882),  # Nagpur, Maharashtra
    "DZ-033": (21.1702, 72.8311),  # Surat, Gujarat
    "DZ-034": (12.2958, 76.6394),  # Mysuru, Karnataka
    "DZ-035": (11.0168, 76.9558),  # Coimbatore, Tamil Nadu
    "DZ-036": (16.5062, 80.6480),  # Vijayawada, Andhra Pradesh
    "DZ-037": (17.9689, 79.5941),  # Warangal, Telangana
    "DZ-038": (8.5241, 76.9366),   # Thiruvananthapuram, Kerala
    "DZ-039": (26.2389, 73.0243),  # Jodhpur, Rajasthan
    "DZ-040": (28.5355, 77.3910),  # Noida, Uttar Pradesh
    "DZ-041": (25.3176, 82.9739),  # Varanasi, Uttar Pradesh
    "DZ-042": (31.6340, 74.8723),  # Amritsar, Punjab
    "DZ-043": (26.7271, 88.3953),  # Siliguri, West Bengal
    "DZ-044": (20.4625, 85.8828),  # Cuttack, Odisha
    "DZ-045": (24.7914, 85.0002),  # Gaya, Bihar
    "DZ-046": (27.4728, 94.9120),  # Dibrugarh, Assam
    "DZ-047": (22.7196, 75.8577),  # Indore, Madhya Pradesh
    "DZ-048": (22.0797, 82.1391),  # Bilaspur, Chhattisgarh
    "DZ-049": (15.2832, 73.9862),  # Margao, Goa
    "DZ-050": (28.4089, 77.3178),  # Faridabad, Haryana
}


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate spherical straight-line distance in kilometers between two coordinates
    using the Haversine formula. Earth mean radius is taken as 6,371.0 km.
    """
    earth_radius_km = 6371.0
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    
    return round(earth_radius_km * c, 2)


class DistanceService:
    """
    In-memory distance service that caches node-to-zone approximate straight-line distances.
    Guarantees fast O(1) distance lookups during batch allocation.
    """
    def __init__(self):
        self._node_coords: Dict[str, Tuple[float, float]] = {}
        self._distance_matrix: Dict[Tuple[str, str], float] = {}
        self._ranked_nodes_per_zone: Dict[str, List[Tuple[str, float]]] = {}
        self._load_and_compute_matrix()

    def _load_and_compute_matrix(self) -> None:
        """Load node coordinates from fulfillment_nodes table and precalculate distance matrix."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT node_id, latitude, longitude FROM fulfillment_nodes WHERE is_active = 1")
        for row in cursor.fetchall():
            self._node_coords[row["node_id"]] = (float(row["latitude"]), float(row["longitude"]))
        conn.close()

        for zone_id, (z_lat, z_lon) in ZONE_COORDINATES.items():
            zone_rankings = []
            for node_id, (n_lat, n_lon) in self._node_coords.items():
                dist = haversine_distance_km(n_lat, n_lon, z_lat, z_lon)
                self._distance_matrix[(node_id, zone_id)] = dist
                zone_rankings.append((node_id, dist))
            
            # Sort candidate nodes in ascending order of approximate straight-line distance
            zone_rankings.sort(key=lambda x: x[1])
            self._ranked_nodes_per_zone[zone_id] = zone_rankings

    def get_distance_km(self, node_id: str, zone_id: str) -> float:
        """Return cached approximate straight-line Haversine distance in km."""
        return self._distance_matrix.get((node_id, zone_id), 99999.0)

    def get_ranked_nodes(self, zone_id: str) -> List[Tuple[str, float]]:
        """Return list of (node_id, approx_straight_line_dist_km) sorted nearest-first."""
        return self._ranked_nodes_per_zone.get(zone_id, [])


# Global distance service singleton
distance_service = DistanceService()
