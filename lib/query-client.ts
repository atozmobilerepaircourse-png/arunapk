import { Platform } from "react-native";
import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CLOUD_RUN_BACKEND = "https://repair-backend-3siuld7gbq-el.a.run.app";
const SESSION_KEY = "mobi_session_token";

export function getApiUrl(): string {
  if (__DEV__ && Platform.OS !== 'web') {
    // For local development on physical devices/emulators
    return "http://localhost:5000";
  }
  if (Platform.OS === 'web' && window.location.hostname.includes('replit.dev')) {
    // For Replit web preview
    return `https://${window.location.hostname.split(':')[0]}/`;
  }
  return CLOUD_RUN_BACKEND;
}

async function getSessionToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
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

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: isFormData ? (data as any) : (data ? JSON.stringify(data) : undefined),
    credentials: "include",
  });

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

    const res = await fetch(url.toString(), {
      headers,
      credentials: "include",
    });

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
