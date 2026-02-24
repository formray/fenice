import { Scene } from './components/Scene';
import { HUD } from './components/HUD';
import { SidePanel } from './components/SidePanel';
import { BuilderPromptBar } from './components/BuilderPromptBar';
import { CosmosSettings } from './components/CosmosSettings';
import { useWorldSocket } from './hooks/useWorldSocket';

const WS_TOKEN = import.meta.env.VITE_WS_TOKEN as string | undefined;

export function App(): React.JSX.Element {
  useWorldSocket(WS_TOKEN ?? '');

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Scene />
      <HUD />
      <SidePanel />
      <BuilderPromptBar />
      <CosmosSettings />
    </div>
  );
}
