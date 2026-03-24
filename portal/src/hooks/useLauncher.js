import { useCallback } from 'react';

export function useLauncher(appLauncherUrl) {
  const launchService = useCallback(async (service) => {
    if (service.launchType === 'native') {
      try {
        await fetch(`${appLauncherUrl}/launch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId: service.id }),
        });
      } catch {
        // app-launcher not available, fallback to browser
        window.location.href = service.launchTarget;
      }
    } else {
      window.location.href = service.launchTarget;
    }
  }, [appLauncherUrl]);

  const focusPortal = useCallback(async () => {
    try {
      await fetch(`${appLauncherUrl}/focus-portal`, { method: 'POST' });
    } catch {
      // ignore
    }
  }, [appLauncherUrl]);

  return { launchService, focusPortal };
}
