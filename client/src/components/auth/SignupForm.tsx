import { useState, type FormEvent } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { fieldStyle, labelStyle, primaryButtonStyle, errorStyle, hintStyle } from './styles';

export function SignupForm(): React.JSX.Element {
  const signup = useAuthStore((s) => s.signup);
  const busy = useAuthStore((s) => s.busy);
  const error = useAuthStore((s) => s.error);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');

  const passwordOk = password.length >= 8;
  const formValid = email && username.length >= 2 && fullName && passwordOk;

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!formValid) return;
    try {
      await signup({ email, username, fullName, password });
    } catch {
      // Error in store
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

      <label style={labelStyle}>Username</label>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        minLength={2}
        maxLength={50}
        required
        style={fieldStyle}
        disabled={busy}
      />

      <label style={labelStyle}>Full name</label>
      <input
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        autoComplete="name"
        maxLength={100}
        required
        style={fieldStyle}
        disabled={busy}
      />

      <label style={labelStyle}>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        required
        style={fieldStyle}
        disabled={busy}
      />
      <div style={hintStyle}>Min 8 characters.</div>

      {error && <div style={errorStyle}>{error}</div>}

      <button type="submit" disabled={busy || !formValid} style={primaryButtonStyle}>
        {busy ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
}
