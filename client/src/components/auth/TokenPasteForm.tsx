import { useState, type FormEvent } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { fieldStyle, labelStyle, primaryButtonStyle, errorStyle, hintStyle } from './styles';

/**
 * Dev backdoor — paste a raw access token (e.g. from curl). The token is
 * verified by calling /api/v1/users/me before being persisted.
 */
export function TokenPasteForm(): React.JSX.Element {
  const pasteToken = useAuthStore((s) => s.pasteToken);
  const busy = useAuthStore((s) => s.busy);
  const error = useAuthStore((s) => s.error);

  const [token, setToken] = useState('');

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!token) return;
    try {
      await pasteToken(token.trim());
    } catch {
      // Error in store
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate>
      <label style={labelStyle}>Access token (JWT)</label>
      <textarea
        value={token}
        onChange={(e) => setToken(e.target.value)}
        rows={5}
        style={{ ...fieldStyle, fontFamily: 'ui-monospace, monospace', resize: 'vertical' }}
        disabled={busy}
        placeholder="eyJhbGciOiJIUzI1NiIs..."
      />
      <div style={hintStyle}>Used for testing — get one with curl + /api/v1/auth/login.</div>

      {error && <div style={errorStyle}>{error}</div>}

      <button type="submit" disabled={busy || !token} style={primaryButtonStyle}>
        {busy ? 'Verifying…' : 'Verify and continue'}
      </button>
    </form>
  );
}
