"""
FulfillSmart API Server Entrypoint
Allows launching via: uvicorn src.main:app
"""
from src.api.main import app, create_app

__all__ = ["app", "create_app"]
