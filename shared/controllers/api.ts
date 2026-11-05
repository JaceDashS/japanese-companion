/** Platform transport contract bound by the common Expo runtime. */
export declare function apiUrl(path: string, query?: Record<string, unknown>): string;
export declare function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
