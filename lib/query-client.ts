import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const CLOUD_RUN_BACKEND = "https://repair-backend-3siuld7gbq-el.a.run.app";
const SESSION_KEY = "mobi_session_token_v2";

export function getApiUrl(): string {
  if (Platform.OS === "web") {
    // Ensure we are using the correct production backend for web
    return "https://repair-backend-3siuld7gbq-el.a.run.app";
  }
  return CLOUD_RUN_BACKEND;
}

async function getSessionToken(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(SESSION_KEY);
    if (token) return token;
    const legacyToken = await AsyncStorage.getItem("mobi_session_token");
    if (legacyToken) {
      await AsyncStorage.setItem(SESSION_KEY, legacyToken);
    }
    return legacyToken;
  } catch {
    return null;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    try {
      const json = JSON.parse(text);
      const msg = json.message || json.error || text;
      throw new Error(msg);
    } catch (e: any) {
      if (e.message && !e.message.includes('JSON')) throw e;
      throw new Error(text || `Request failed (${res.status})`);
    }
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const isFormData = data instanceof FormData;
  const sessionToken = await getSessionToken();

  const headers: Record<string, string> = {};
  if (!isFormData && data) headers["Content-Type"] = "application/json";
  if (sessionToken) headers["x-session-token"] = sessionToken;

  const fetchOptions: RequestInit = {
    method,
    headers,
    body: isFormData ? (data as any) : (data ? JSON.stringify(data) : undefined),
  };

  if (Platform.OS === "web") {
    // Removed credentials: "include" as it was causing 401 Invalid Session errors on web 
    // when the browser doesn't have the session cookie, but we are manually sending 
    // the x-session-token header.
  }

  const res = await fetch(url.toString(), fetchOptions);

  if (res.status === 401 && !route.includes('/api/otp/') && !route.includes('/api/auth/')) {
    console.log('[API] 401 Unauthorized for', route, '— session token may be missing');
    try {
      const cloned = res.clone();
      const body = await cloned.json();
      if (body.message === 'Invalid session') {
        await AsyncStorage.removeItem(SESSION_KEY);
        console.log('[API] Cleared stale session token');
      }
    } catch {}
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const sessionToken = await getSessionToken();
    const headers: Record<string, string> = {};
    if (sessionToken) headers["x-session-token"] = sessionToken;

    const fetchOptions: RequestInit = { headers };
    if (Platform.OS === "web") {
      // Removed credentials: "include" to match apiRequest behavior
    }

    const res = await fetch(url.toString(), fetchOptions);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000,
      retry: 2,
    },
    mutations: {
      retry: false,
    },
  },
});
