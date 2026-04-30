import { create } from 'zustand';
import * as authApi from '../services/auth-api';
import type { AuthUser } from '../services/auth-api';

const STORAGE_KEY = 'fenice.auth';

interface PersistedAuth {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

function readPersisted(): PersistedAuth | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAuth;
    if (!parsed.accessToken || !parsed.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(value: PersistedAuth | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (value === null) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  busy: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (input: {
    email: string;
    username: string;
    fullName: string;
    password: string;
  }) => Promise<void>;
  /** Pastes a raw token (dev backdoor for testing without form). */
  pasteToken: (accessToken: string, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Try to refresh the access token. Logs out on failure. */
  tryRefresh: () => Promise<boolean>;
  clearError: () => void;
}

const persisted = readPersisted();

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: persisted?.accessToken ?? null,
  refreshToken: persisted?.refreshToken ?? null,
  user: persisted?.user ?? null,
  busy: false,
  error: null,

  login: async (email, password) => {
    set({ busy: true, error: null });
    try {
      const res = await authApi.login(email, password);
      writePersisted({
        accessToken: res.tokens.access,
        refreshToken: res.tokens.refresh,
        user: res.user,
      });
      set({
        accessToken: res.tokens.access,
        refreshToken: res.tokens.refresh,
        user: res.user,
        busy: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      set({ busy: false, error: message });
      throw err;
    }
  },

  signup: async (input) => {
    set({ busy: true, error: null });
    try {
      const res = await authApi.signup(input);
      writePersisted({
        accessToken: res.tokens.access,
        refreshToken: res.tokens.refresh,
        user: res.user,
      });
      set({
        accessToken: res.tokens.access,
        refreshToken: res.tokens.refresh,
        user: res.user,
        busy: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      set({ busy: false, error: message });
      throw err;
    }
  },

  pasteToken: async (accessToken, refreshToken) => {
    set({ busy: true, error: null });
    try {
      const user = await authApi.fetchMe(accessToken);
      const persistedValue: PersistedAuth = {
        accessToken,
        refreshToken: refreshToken ?? '',
        user,
      };
      writePersisted(persistedValue);
      set({
        accessToken,
        refreshToken: refreshToken ?? null,
        user,
        busy: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token rejected';
      set({ busy: false, error: message });
      throw err;
    }
  },

  logout: async () => {
    const token = get().accessToken;
    if (token) {
      // Fire-and-forget — local state is cleared regardless
      try {
        await authApi.logout(token);
      } catch {
        // Ignore network errors
      }
    }
    writePersisted(null);
    set({ accessToken: null, refreshToken: null, user: null, error: null });
  },

  tryRefresh: async () => {
    const { refreshToken, user } = get();
    if (!refreshToken || !user) return false;
    try {
      const tokens = await authApi.refresh(refreshToken);
      writePersisted({
        accessToken: tokens.access,
        refreshToken: tokens.refresh,
        user,
      });
      set({ accessToken: tokens.access, refreshToken: tokens.refresh });
      return true;
    } catch {
      writePersisted(null);
      set({ accessToken: null, refreshToken: null, user: null });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

/** Test-only: reset the store and storage. */
export function resetAuthForTest(): void {
  writePersisted(null);
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    user: null,
    busy: false,
    error: null,
  });
}
