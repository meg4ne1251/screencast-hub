import { useState, useCallback } from 'react';
import {
  useFocusable,
  FocusContext,
} from '@noriginmedia/norigin-spatial-navigation';
import Clock from './Clock';
import ServiceCard from './ServiceCard';
import LaunchOverlay from './LaunchOverlay';
import { useLauncher } from '../hooks/useLauncher';

export default function Portal({ config }) {
  const { services, portalName, subtitle, columns, appLauncherUrl, theme } =
    config;

  const [launched, setLaunched] = useState(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const { launchService } = useLauncher(appLauncherUrl || 'http://localhost:3001');
  const { ref, focusKey } = useFocusable();

  const handleSelect = useCallback(
    async (service) => {
      setLaunched(service);
      // Give the overlay a moment to show before navigating
      await new Promise((r) => setTimeout(r, 600));

      if (service.launchType === 'native') {
        // Native app launch — clear overlay after a timeout regardless of API response
        const timeout = setTimeout(() => setLaunched(null), 3000);
        try {
          await launchService(service);
        } finally {
          clearTimeout(timeout);
          setLaunched(null);
        }
      } else {
        // Browser navigation — SPA will unload, no need to clear
        await launchService(service);
      }
    },
    [launchService]
  );

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        className="portal"
        style={{
          background: theme?.bgGradient,
          fontFamily: theme?.fontFamily,
        }}
      >
        {/* Background decorative orbs */}
        <div className="portal__orb portal__orb--top" />
        <div className="portal__orb portal__orb--bottom" />

        {/* Header */}
        <header className="portal__header">
          <div>
            <h1 className="portal__title">{portalName}</h1>
            <p className="portal__subtitle">{subtitle}</p>
          </div>
          <Clock />
        </header>

        {/* Service grid */}
        <main className="portal__main">
          <div
            className="portal__grid"
            style={{
              gridTemplateColumns: `repeat(${columns || 3}, 220px)`,
            }}
          >
            {services.map((service, index) => (
              <ServiceCard
                key={service.id}
                service={service}
                onSelect={handleSelect}
                onFocus={() => setFocusIndex(index)}
              />
            ))}
          </div>
        </main>

        {/* Footer hint */}
        <footer className="portal__footer">
          <div className="portal__dots">
            {services.map((_, i) => (
              <div
                key={i}
                className={`portal__dot ${focusIndex === i ? 'portal__dot--active' : ''}`}
              />
            ))}
          </div>
          <p className="portal__hint">
            ← → ↑ ↓ で選択 &nbsp;&nbsp; Enter で起動 &nbsp;&nbsp; ESC で戻る
          </p>
        </footer>

        {/* Launch overlay */}
        <LaunchOverlay service={launched} />
      </div>
    </FocusContext.Provider>
  );
}
