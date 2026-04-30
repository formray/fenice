import { useState, type ReactNode } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { TokenPasteForm } from './TokenPasteForm';

type Mode = 'login' | 'signup' | 'paste';

interface AuthGateProps {
  children: ReactNode;
}

/**
 * Renders children when authenticated, otherwise shows the login/signup
 * UI gated on top of a dark cosmic background.
 */
export function AuthGate({ children }: AuthGateProps): React.JSX.Element {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [mode, setMode] = useState<Mode>('login');

  if (accessToken) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(circle at 50% 30%, #1a2240 0%, #050714 50%, #000004 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      <div
        style={{
          width: 380,
          padding: 28,
          background: 'rgba(8, 14, 28, 0.92)',
          border: '1px solid rgba(0, 245, 255, 0.25)',
          borderRadius: 8,
          boxShadow: '0 0 60px rgba(0, 245, 255, 0.08), 0 24px 60px rgba(0, 0, 0, 0.6)',
          color: '#cbe6ff',
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: '#5eaadd',
            marginBottom: 4,
          }}
        >
          FENICE
        </div>
        <div style={{ fontSize: 18, color: '#fff', marginBottom: 22 }}>
          {mode === 'login' && 'Sign in to the cosmos'}
          {mode === 'signup' && 'Create your account'}
          {mode === 'paste' && 'Paste an access token'}
        </div>

        {mode === 'login' && <LoginForm />}
        {mode === 'signup' && <SignupForm />}
        {mode === 'paste' && <TokenPasteForm />}

        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid rgba(94, 170, 221, 0.18)',
            display: 'flex',
            gap: 14,
            fontSize: 11,
            color: '#7895b8',
          }}
        >
          {mode !== 'login' && (
            <button type="button" onClick={() => setMode('login')} style={modeButtonStyle}>
              Sign in
            </button>
          )}
          {mode !== 'signup' && (
            <button type="button" onClick={() => setMode('signup')} style={modeButtonStyle}>
              Create account
            </button>
          )}
          {mode !== 'paste' && (
            <button type="button" onClick={() => setMode('paste')} style={modeButtonStyle}>
              Paste token
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const modeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#5eaadd',
  cursor: 'pointer',
  padding: 0,
  font: 'inherit',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};
