import { RFC7807ProblemDetails } from '../types/common';

export interface ClientResponse<T> {
  data: T;
  roundTripMs: number;
  status: number;
}

export class ApiError extends Error {
  public status: number;
  public problemDetails?: RFC7807ProblemDetails;

  constructor(message: string, status: number, problemDetails?: RFC7807ProblemDetails) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.problemDetails = problemDetails;
  }
}

/**
 * Standard fetch client wrapper.
 * In development, requests to /api, /health, /ready route through the Vite proxy,
 * which injects the server-side API key.
 */
export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ClientResponse<T>> {
  const startTime = performance.now();

  const headers: HeadersInit = {
    Accept: 'application/json, application/problem+json',
    ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    ...options?.headers,
  };

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const roundTripMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      let problem: RFC7807ProblemDetails | undefined;
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/problem+json') || contentType.includes('application/json')) {
        try {
          problem = await response.json();
        } catch {
          // Fallback if body parsing fails
        }
      }

      const errorMessage =
        problem?.detail || problem?.title || `HTTP Request failed with status ${response.status}`;

      throw new ApiError(errorMessage, response.status, problem);
    }

    const data: T = await response.json();
    return {
      data,
      roundTripMs,
      status: response.status,
    };
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      err instanceof Error ? err.message : 'Unknown network error',
      0,
      {
        type: 'https://fulfillsmart.internal/errors/network_error',
        title: 'Network Communication Error',
        status: 0,
        detail: err instanceof Error ? err.message : 'Unable to reach backend service',
        error_code: 'NETWORK_ERROR',
        timestamp: new Date().toISOString(),
      }
    );
  }
}
