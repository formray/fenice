import { Scene } from './components/Scene';
import { HUD } from './components/HUD';
import { SidePanel } from './components/SidePanel';
import { BuilderPromptBar } from './components/builder/BuilderPromptBar';
import { CosmosSettings } from './components/CosmosSettings';
import { AgentPanel } from './components/AgentPanel';
import { AuthGate } from './components/auth/AuthGate';
import { UserMenu } from './components/auth/UserMenu';
import { useAuthStore } from './stores/auth.store';
import { useWorldSocket } from './hooks/useWorldSocket';

function AuthenticatedApp(): React.JSX.Element {
  const accessToken = useAuthStore((s) => s.accessToken) ?? '';
  useWorldSocket(accessToken);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Scene />
      <HUD />
      <UserMenu />
      <SidePanel />
      <BuilderPromptBar />
      <CosmosSettings />
      <AgentPanel />
    </div>
  );
}

export function App(): React.JSX.Element {
  return (
    <AuthGate>
      <AuthenticatedApp />
    </AuthGate>
  );
}
