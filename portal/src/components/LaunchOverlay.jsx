import { useState, useEffect } from 'react';

export default function LaunchOverlay({ service }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [service]);

  if (!service) return null;

  return (
    <div className="launch-overlay">
      {!imgError ? (
        <img
          className="launch-overlay__icon"
          src={service.icon}
          alt={service.name}
          draggable={false}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="launch-overlay__icon launch-overlay__icon--fallback">
          {service.name.charAt(0)}
        </div>
      )}
      <div className="launch-overlay__name">{service.name}</div>
      <div className="launch-overlay__status">起動中...</div>
    </div>
  );
}
