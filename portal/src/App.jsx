import { init } from '@noriginmedia/norigin-spatial-navigation';
import { useConfig } from './hooks/useConfig';
import Portal from './components/Portal';

init({
  debug: false,
  visualDebug: false,
});

export default function App() {
  const { config, error } = useConfig();

  if (error) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0f',
        color: '#fff',
        fontFamily: 'sans-serif',
      }}>
        <p>設定の読み込みに失敗しました: {error}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0f',
        color: '#fff',
      }}>
        <div style={{ opacity: 0.5, fontSize: '18px' }}>読み込み中...</div>
      </div>
    );
  }

  return <Portal config={config} />;
}
