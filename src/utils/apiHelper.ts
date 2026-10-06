/**
 * Safe API request utility with content-type checking and robust error handling.
 * Prevents "JSON.parse: unexpected character" errors when servers return HTML (e.g. 404s, Vercel redirects, or offline proxies).
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  isHtmlFallback?: boolean;
}

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch(url, {
      ...options,
      signal: options?.signal || controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options?.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!text || text.trim().length === 0) {
      return {
        success: false,
        message: 'Empty response from server',
      };
    }

    // Check if the response is HTML (e.g., Vercel SPA routing returning index.html or 404 page)
    const trimmed = text.trim();
    if (trimmed.startsWith('<') || trimmed.toLowerCase().includes('<!doctype html') || !contentType.includes('application/json')) {
      // If content is HTML, try parsing as JSON just in case, otherwise report fallback
      try {
        const json = JSON.parse(text);
        return {
          success: response.ok && (json.success !== false),
          data: json.data || json,
          message: json.message,
        };
      } catch {
        return {
          success: false,
          isHtmlFallback: true,
          message: 'Cloud sync server endpoint is not active on this domain. Operating in local mode.',
        };
      }
    }

    try {
      const json = JSON.parse(text);
      return {
        success: response.ok && (json.success !== false),
        data: json.data || json,
        message: json.message,
      };
    } catch {
      return {
        success: false,
        message: 'Invalid JSON payload received from server',
      };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        message: 'Connection timed out while reaching the cloud server',
      };
    }
    return {
      success: false,
      message: err.message || 'Network request failed',
    };
  }
}
