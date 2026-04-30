import { useState, type FormEvent } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { fieldStyle, labelStyle, primaryButtonStyle, errorStyle } from './styles';

export function LoginForm(): React.JSX.Element {
  const login = useAuthStore((s) => s.login);
  const busy = useAuthStore((s) => s.busy);
  const error = useAuthStore((s) => s.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch {
      // Error is already in the store
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate>
      <label style={labelStyle}>Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
        style={fieldStyle}
        disabled={busy}
      />

      <label style={labelStyle}>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
        style={fieldStyle}
        disabled={busy}
      />

      {error && <div style={errorStyle}>{error}</div>}

      <button type="submit" disabled={busy || !email || !password} style={primaryButtonStyle}>
        {busy ? 'Connecting…' : 'Sign in'}
      </button>
    </form>
  );
}
