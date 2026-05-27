import { useCallback } from 'react';

export function useLauncher(appLauncherUrl) {
  const launchService = useCallback(async (service) => {
    if (service.launchType === 'native') {
      try {
        const res = await fetch(`${appLauncherUrl}/launch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId: service.id }),
        });
        if (!res.ok) throw new Error(`launch failed: ${res.status}`);
      } catch {
        // app-launcher unavailable or launch failed → fall back to web version.
        // Native services use a non-URL launchTarget (an app id), so navigate
        // to fallbackUrl instead. If none is defined, stay put.
        if (service.fallbackUrl) {
          window.location.href = service.fallbackUrl;
        }
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
