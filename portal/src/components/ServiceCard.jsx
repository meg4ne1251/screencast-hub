import { useState, useEffect } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';

export default function ServiceCard({ service, onSelect, onFocus }) {
  const [imgError, setImgError] = useState(false);
  const { ref, focused } = useFocusable({
    onEnterPress: () => onSelect(service),
  });

  useEffect(() => {
    if (focused && onFocus) onFocus();
  }, [focused, onFocus]);

  return (
    <div
      ref={ref}
      className={`service-card ${focused ? 'service-card--focused' : ''}`}
      onClick={() => onSelect(service)}
      style={{
        '--service-color': service.color,
      }}
    >
      <div className="service-card__shine" />
      {!imgError ? (
        <img
          className="service-card__icon"
          src={service.icon}
          alt={service.name}
          draggable={false}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="service-card__icon service-card__icon--fallback">
          {service.name.charAt(0)}
        </div>
      )}
      <div className="service-card__name">{service.name}</div>
      <div className="service-card__desc">{service.description}</div>
    </div>
  );
}
