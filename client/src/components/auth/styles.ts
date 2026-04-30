/** Shared inline styles for the auth forms. */

export const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  marginBottom: 12,
  background: 'rgba(0, 0, 12, 0.6)',
  border: '1px solid rgba(94, 170, 221, 0.25)',
  borderRadius: 4,
  color: '#fff',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  color: '#5eaadd',
  marginBottom: 4,
};

export const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  marginTop: 6,
  background: 'linear-gradient(135deg, rgba(0, 245, 255, 0.18) 0%, rgba(0, 245, 255, 0.08) 100%)',
  border: '1px solid rgba(0, 245, 255, 0.55)',
  borderRadius: 4,
  color: '#cbe6ff',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

export const errorStyle: React.CSSProperties = {
  marginBottom: 10,
  padding: '8px 10px',
  background: 'rgba(255, 60, 60, 0.12)',
  border: '1px solid rgba(255, 100, 100, 0.4)',
  borderRadius: 4,
  color: '#ff8888',
  fontSize: 11,
};

export const hintStyle: React.CSSProperties = {
  marginTop: -6,
  marginBottom: 12,
  fontSize: 10,
  color: '#7895b8',
};
