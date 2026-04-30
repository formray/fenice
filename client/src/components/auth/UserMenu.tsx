import { useState } from 'react';
import { useAuthStore } from '../../stores/auth.store';

/**
 * HUD overlay (top-left) showing the current user with role badge and logout.
 */
export function UserMenu(): React.JSX.Element | null {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const roleColor = roleColors[user.role] ?? '#5eaadd';

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 10,
        fontFamily: 'ui-monospace, monospace',
        fontSize: 11,
        color: '#cbe6ff',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: 'rgba(8, 14, 28, 0.85)',
          border: '1px solid rgba(94, 170, 221, 0.25)',
          borderRadius: 6,
          backdropFilter: 'blur(6px)',
          color: '#cbe6ff',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 11,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: roleColor,
            boxShadow: `0 0 6px ${roleColor}`,
          }}
        />
        <span>{user.username}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span style={{ opacity: 0.6 }}>{user.role}</span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 6,
            padding: '10px 12px',
            background: 'rgba(8, 14, 28, 0.92)',
            border: '1px solid rgba(94, 170, 221, 0.25)',
            borderRadius: 6,
            backdropFilter: 'blur(6px)',
            minWidth: 200,
          }}
        >
          <div style={{ fontSize: 11, color: '#fff', marginBottom: 2 }}>{user.fullName}</div>
          <div style={{ fontSize: 10, color: '#7895b8', marginBottom: 10 }}>{user.email}</div>
          <button
            type="button"
            onClick={() => void logout()}
            style={{
              width: '100%',
              padding: '6px 10px',
              background: 'rgba(255, 60, 60, 0.08)',
              border: '1px solid rgba(255, 100, 100, 0.3)',
              borderRadius: 4,
              color: '#ff8888',
              fontFamily: 'inherit',
              fontSize: 11,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const roleColors: Record<string, string> = {
  superAdmin: '#ff00aa',
  admin: '#ff8800',
  employee: '#ffaa00',
  agent: '#aa55ff',
  client: '#5eaadd',
  vendor: '#5eaadd',
  user: '#cbe6ff',
};
