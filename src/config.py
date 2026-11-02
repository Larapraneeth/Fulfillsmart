"""
FulfillSmart Configuration Module
Provides centralized, typed access to application settings and paths.
"""
from pathlib import Path
import os
import json
from typing import Dict, Any, List, Optional

ROOT_DIR = Path(__file__).resolve().parents[1]
CONFIG_FILE = ROOT_DIR / "config" / "settings.json"

# Load local .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT_DIR / ".env")
except ImportError:
    pass


class Settings:
    def __init__(self, config_dict: Dict[str, Any]):
        self.app_name: str = config_dict.get("app_name", "FulfillSmart")
        self.version: str = config_dict.get("version", "1.0.0")
        self.environment: str = os.getenv("ENVIRONMENT") or config_dict.get("environment", "production_simulation")
        self.random_seed: int = config_dict.get("random_seed", 20261022)
        self.timezone: str = config_dict.get("timezone", "Asia/Kolkata")
        
        # Storage
        storage = config_dict.get("storage", {})
        db_env = os.getenv("FULFILLSMART_DATABASE_PATH") or os.getenv("DATABASE_PATH")
        if db_env:
            self.database_path: Path = Path(db_env).resolve()
        else:
            db_rel = storage.get("database_path", "storage/fulfillsmart.db")
            self.database_path: Path = ROOT_DIR / db_rel
        self.storage_dir: Path = self.database_path.parent
        self.cache_size_mb: int = int(os.getenv("CACHE_SIZE_MB", str(storage.get("cache_size_mb", 64))))
        
        # Allocation policy
        alloc = config_dict.get("allocation_policy", {})
        self.ordering_policy: str = alloc.get("ordering_policy", "CHRONOLOGICAL_PRIMARY_PRIORITY_TIEBREAK")
        self.ordering_policy_desc: str = alloc.get("description", "")
        self.priority_ranks: Dict[str, int] = alloc.get("priority_ranks", {
            "CRITICAL": 1, "HIGH": 2, "NORMAL": 3, "LOW": 4
        })
        self.sunday_handling: str = alloc.get("sunday_handling", "SHIFT_TO_MONDAY")
        self.sunday_handling_desc: str = alloc.get("sunday_handling_description", "")
        self.distance_metric: str = alloc.get("distance_metric", "HAVERSINE_SPHERICAL_KM")
        self.single_node_preference: bool = alloc.get("single_node_preference", True)
        
        # Carrier policy
        carrier = config_dict.get("carrier_policy", {})
        self.strict_service_level: bool = carrier.get("strict_service_level", True)
        self.allow_silent_downgrades: bool = carrier.get("allow_silent_downgrades", False)
        self.cutoff_search_window_days: int = carrier.get("cutoff_search_window_days", 7)
        self.transit_days: Dict[str, int] = carrier.get("transit_days", {
            "SAME_DAY": 0, "EXPRESS": 2, "STANDARD": 4
        })
        self.exclude_sundays: bool = carrier.get("exclude_sundays", True)
        self.exclude_holidays: bool = carrier.get("exclude_holidays", True)
        
        # API and Security Configuration
        api_conf = config_dict.get("api", {})
        self.api_prefix: str = api_conf.get("prefix", "/api/v1")
        
        self.api_key: Optional[str] = os.getenv("FULFILLSMART_API_KEY")
        # Fail safely if production environment and key missing
        if self.environment in ["production", "prod"]:
            if not self.api_key:
                raise RuntimeError("FATAL: FULFILLSMART_API_KEY environment variable is required in production mode.")
        else:
            # In local development / testing, use the standard development key if not explicitly set
            if not self.api_key:
                self.api_key = "test-secret-key-2026"
            
        cors_env = os.getenv("CORS_ALLOWED_ORIGINS")
        if cors_env:
            self.cors_allowed_origins: List[str] = [
                origin.strip() for origin in cors_env.split(",") if origin.strip()
            ]
        else:
            self.cors_allowed_origins: List[str] = api_conf.get("cors_allowed_origins", [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:8000",
                "http://127.0.0.1:8000"
            ])
        self.trusted_proxies: List[str] = api_conf.get("trusted_proxies", [
            "127.0.0.1",
            "::1"
        ])

    def ensure_directories(self) -> None:
        """Ensure storage and runtime directories exist on Drive E:"""
        self.storage_dir.mkdir(parents=True, exist_ok=True)


def load_settings() -> Settings:
    if not CONFIG_FILE.exists():
        raise FileNotFoundError(f"Configuration file not found at {CONFIG_FILE}")
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    settings = Settings(data)
    settings.ensure_directories()
    return settings


# Global settings singleton
settings = load_settings()
