import React, { useState, useEffect } from 'react';

interface FaviconProps {
  src: string;
  isLoading: boolean;
}

/* Zen globe fallback — matches zen-browser's default tab-icon */
const GlobeSvg = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
    <circle cx="8" cy="8" r="6.5"/>
    <ellipse cx="8" cy="8" rx="3" ry="6.5"/>
    <line x1="1.5" y1="8" x2="14.5" y2="8"/>
  </svg>
);

const Favicon = React.memo<FaviconProps>(({ src, isLoading }) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => { setImgError(false); }, [src]);

  if (isLoading) {
    return (
      <svg className="spinner" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5" opacity="0.5"/>
      </svg>
    );
  }

  if (src && src.startsWith('http') && !imgError) {
    return (
      <img
        src={src}
        className="favicon-img"
        onError={() => setImgError(true)}
        alt=""
        loading="lazy"
      />
    );
  }

  return <GlobeSvg />;
});

Favicon.displayName = 'Favicon';

export default Favicon;
