"""
FulfillSmart API Middleware & Exception Handlers
Provides:
1. Request ID sanitization & bounding (max 64 chars, alphanumeric/dash/underscore).
2. Process execution timing header (X-Process-Time-Ms).
3. Trusted proxy X-Forwarded-Proto verification and HTTPS-conditional HSTS.
4. Genuine RFC 7807 Problem Details exception handlers (application/problem+json).
"""
import re
import time
import uuid
import logging
from typing import Callable
from datetime import datetime, timezone
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from src.config import settings
from src.api.schemas.common import RFC7807ProblemDetails

logger = logging.getLogger("fulfillsmart.api")

REQUEST_ID_REGEX = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class RequestTracingAndSecurityMiddleware(BaseHTTPMiddleware):
    """
    Manages request tracing ID, execution timing, security headers,
    and trusted proxy HTTPS verification.
    """
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.perf_counter()

        # 1. Request ID Sanitization & Bounding
        incoming_req_id = request.headers.get("x-request-id", "").strip()
        if incoming_req_id and REQUEST_ID_REGEX.match(incoming_req_id):
            request_id = incoming_req_id
        else:
            request_id = f"req-{uuid.uuid4().hex[:12]}"

        request.state.request_id = request_id

        # 2. Process Request
        response = await call_next(request)

        # 3. Execution Timing Header
        duration_ms = (time.perf_counter() - start_time) * 1000.0
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"

        # 4. Standard Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"

        # 5. HTTPS-Conditional HSTS (Trust X-Forwarded-Proto only from configured trusted proxies)
        is_https = False
        if request.url.scheme == "https":
            is_https = True
        else:
            client_ip = request.client.host if request.client else ""
            forwarded_proto = request.headers.get("x-forwarded-proto", "").lower()
            if forwarded_proto == "https" and client_ip in settings.trusted_proxies:
                is_https = True

        if is_https:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


def create_problem_details_response(
    status_code: int,
    title: str,
    detail: str,
    error_code: str,
    request: Request,
    invalid_params: list = None
) -> JSONResponse:
    """Creates a genuine RFC 7807 Problem Details response."""
    request_id = getattr(request.state, "request_id", f"req-{uuid.uuid4().hex[:12]}")
    problem = RFC7807ProblemDetails(
        type=f"https://fulfillsmart.internal/errors/{error_code.lower()}",
        title=title,
        status=status_code,
        detail=detail,
        instance=str(request.url.path),
        error_code=error_code,
        invalid_params=invalid_params,
        request_id=request_id,
        timestamp=datetime.now(timezone.utc).isoformat()
    )
    return JSONResponse(
        status_code=status_code,
        content=problem.model_dump(exclude_none=True),
        media_type="application/problem+json",
        headers={"X-Request-ID": request_id}
    )


# RFC 9110 renamed 422 to UNPROCESSABLE_CONTENT; fallback safely without accessing deprecated attribute
if hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT"):
    HTTP_422_UNPROCESSABLE_STATUS = status.HTTP_422_UNPROCESSABLE_CONTENT
else:
    HTTP_422_UNPROCESSABLE_STATUS = 422


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Converts FastAPI/Starlette HTTPException to RFC 7807 Problem Details."""
    error_code_map = {
        status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
        status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
        status.HTTP_403_FORBIDDEN: "FORBIDDEN",
        status.HTTP_404_NOT_FOUND: "NOT_FOUND",
        status.HTTP_409_CONFLICT: "STATE_CONFLICT",
        HTTP_422_UNPROCESSABLE_STATUS: "UNPROCESSABLE_CONTENT",
        status.HTTP_500_INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
        status.HTTP_503_SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE"
    }
    error_code = error_code_map.get(exc.status_code, "HTTP_ERROR")
    return create_problem_details_response(
        status_code=exc.status_code,
        title=exc.detail if isinstance(exc.detail, str) else "HTTP Request Error",
        detail=str(exc.detail),
        error_code=error_code,
        request=request
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Converts Pydantic validation errors to 422 RFC 7807 Problem Details."""
    invalid_params = []
    for err in exc.errors():
        loc = ".".join(str(l) for l in err.get("loc", []))
        invalid_params.append({
            "field": loc,
            "issue": err.get("msg", "Validation error"),
            "type": err.get("type", "value_error")
        })

    return create_problem_details_response(
        status_code=HTTP_422_UNPROCESSABLE_STATUS,
        title="Request Validation Failed",
        detail=f"The request body or parameters failed validation on {len(invalid_params)} field(s).",
        error_code="VALIDATION_ERROR",
        request=request,
        invalid_params=invalid_params
    )



async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catches all unhandled exceptions and returns clean 500 RFC 7807 Problem Details."""
    request_id = getattr(request.state, "request_id", "unknown")
    logger.exception(f"Unhandled error for request {request_id}: {str(exc)}")
    return create_problem_details_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        title="Internal Server Error",
        detail="An unexpected internal server error occurred while processing the request.",
        error_code="INTERNAL_SERVER_ERROR",
        request=request
    )
