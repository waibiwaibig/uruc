type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

function normalizeError(payload: unknown, status: number): Error & { code?: string; status?: number } {
  const data = payload as { error?: string; code?: string } | null;
  const message = data?.error ?? `Request failed (${status})`;
  const error = new Error(message) as Error & { code?: string; status?: number };
  error.code = data?.code;
  error.status = status;
  return error;
}

export async function requestJson<T>(basePath: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${basePath}${path}`, {
    ...options,
    credentials: options.credentials ?? 'same-origin',
    headers,
    body: isFormData
      ? (options.body as FormData)
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw normalizeError(payload, response.status);
  }

  return payload as T;
}
