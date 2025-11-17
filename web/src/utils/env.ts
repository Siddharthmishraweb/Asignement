export const getApiBaseUrl = (): string => {
  const apiUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (!apiUrl) {
    console.warn(
      "VITE_API_URL not found in environment, using default: http://localhost:3003",
    );
    return "http://localhost:3003";
  }
  return apiUrl;
};
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  return `${baseUrl}/${cleanEndpoint}`;
};
export const buildStreamUrl = (
  endpoint: string,
  params?: Record<string, string>,
): string => {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  const url = `${baseUrl}/${cleanEndpoint}`;
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams(params);
    return `${url}?${searchParams.toString()}`;
  }
  return url;
};
