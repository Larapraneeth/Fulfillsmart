/**
 * Standard API envelope directly matching backend Pydantic ApiResponseEnvelope<T>
 */
export interface ApiResponseEnvelope<T> {
  status: string; // "success"
  data: T;
  request_id?: string | null;
  process_time_ms?: number | null;
}

/**
 * Genuine RFC 7807 Problem Details schema (Content-Type: application/problem+json)
 */
export interface RFC7807ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string | null;
  error_code: string;
  invalid_params?: Array<{
    field: string;
    issue: string;
    type: string;
  }> | null;
  request_id?: string | null;
  timestamp: string;
}
