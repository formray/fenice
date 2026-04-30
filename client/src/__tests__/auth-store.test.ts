import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore, resetAuthForTest } from '../stores/auth.store';
import { tokenExpiry, isExpired } from '../services/auth-api';

const fakeUser = {
  id: 'u1',
  email: 'a@b.com',
  username: 'alice',
  fullName: 'Alice',
  role: 'agent',
  active: true,
  emailVerified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const futureExp = Math.floor((Date.now() + 60_000) / 1000);
const pastExp = Math.floor((Date.now() - 60_000) / 1000);

function jwt(exp: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp }));
  return `${header}.${payload}.fakesig`;
}

const okResponse = (body: unknown): Response =>
  ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  }) as unknown as Response;

const errResponse = (status: number, message = 'bad'): Response =>
  ({
    ok: false,
    status,
    statusText: 'ERR',
    json: () => Promise.resolve({ error: { message } }),
  }) as unknown as Response;

describe('auth.store', () => {
  beforeEach(() => {
    resetAuthForTest();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetAuthForTest();
  });

  describe('login', () => {
    it('stores access/refresh/user on success and persists to localStorage', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        okResponse({
          user: fakeUser,
          tokens: { access: jwt(futureExp), refresh: 'r-1' },
        })
      );

      await useAuthStore.getState().login('a@b.com', 'secret123!');

      expect(useAuthStore.getState().accessToken).toBeTruthy();
      expect(useAuthStore.getState().user?.email).toBe('a@b.com');
      expect(useAuthStore.getState().error).toBeNull();
      const persisted = JSON.parse(localStorage.getItem('fenice.auth') ?? 'null');
      expect(persisted?.user?.email).toBe('a@b.com');
    });

    it('surfaces server error in store and re-throws', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(errResponse(401, 'Bad credentials'));

      await expect(useAuthStore.getState().login('a@b.com', 'wrong')).rejects.toThrow();
      expect(useAuthStore.getState().error).toBe('Bad credentials');
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  describe('signup', () => {
    it('stores tokens + user on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        okResponse({
          user: fakeUser,
          tokens: { access: jwt(futureExp), refresh: 'r-2' },
        })
      );

      await useAuthStore.getState().signup({
        email: 'a@b.com',
        username: 'alice',
        fullName: 'Alice',
        password: 'secret123!',
      });

      expect(useAuthStore.getState().user?.username).toBe('alice');
    });
  });

  describe('pasteToken', () => {
    it('verifies the token by hitting /users/me before storing', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okResponse(fakeUser));

      await useAuthStore.getState().pasteToken(jwt(futureExp));

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/users/me',
        expect.objectContaining({
          headers: { Authorization: expect.stringMatching(/^Bearer /) as string },
        })
      );
      expect(useAuthStore.getState().user).toEqual(fakeUser);
    });

    it('rejects an invalid token', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(errResponse(401, 'Invalid token'));

      await expect(useAuthStore.getState().pasteToken('not-a-real-token')).rejects.toThrow();
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().error).toBe('Invalid token');
    });
  });

  describe('logout', () => {
    it('clears state and localStorage even if the network call fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network'));
      useAuthStore.setState({
        accessToken: jwt(futureExp),
        refreshToken: 'r-x',
        user: fakeUser,
      });
      localStorage.setItem(
        'fenice.auth',
        JSON.stringify({ accessToken: 'x', refreshToken: 'r-x', user: fakeUser })
      );

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
      expect(localStorage.getItem('fenice.auth')).toBeNull();
    });
  });

  describe('tryRefresh', () => {
    it('updates tokens and returns true on success', async () => {
      useAuthStore.setState({
        accessToken: jwt(pastExp),
        refreshToken: 'r-old',
        user: fakeUser,
      });
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        okResponse({ access: jwt(futureExp), refresh: 'r-new' })
      );

      const ok = await useAuthStore.getState().tryRefresh();
      expect(ok).toBe(true);
      expect(useAuthStore.getState().refreshToken).toBe('r-new');
    });

    it('clears state and returns false on failure', async () => {
      useAuthStore.setState({
        accessToken: jwt(pastExp),
        refreshToken: 'r-bad',
        user: fakeUser,
      });
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        errResponse(401, 'Invalid refresh token')
      );

      const ok = await useAuthStore.getState().tryRefresh();
      expect(ok).toBe(false);
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('returns false without a refresh token', async () => {
      const ok = await useAuthStore.getState().tryRefresh();
      expect(ok).toBe(false);
    });
  });
});

describe('auth-api token helpers', () => {
  it('tokenExpiry returns ms epoch for valid JWT', () => {
    const t = jwt(futureExp);
    expect(tokenExpiry(t)).toBe(futureExp * 1000);
  });

  it('tokenExpiry returns null for malformed token', () => {
    expect(tokenExpiry('not-a-jwt')).toBeNull();
  });

  it('isExpired is true for past exp, false for future exp', () => {
    expect(isExpired(jwt(pastExp))).toBe(true);
    expect(isExpired(jwt(futureExp))).toBe(false);
  });
});
