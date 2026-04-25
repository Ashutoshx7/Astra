import React, { useState, useEffect } from 'react';

interface FaviconProps {
  src: string;
  isLoading: boolean;
}

const Favicon = React.memo<FaviconProps>(({ src, isLoading }) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => { setImgError(false); }, [src]);

  if (isLoading) return <span className="spinner">⟳</span>;

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

  return <span>{src || '🌐'}</span>;
});

Favicon.displayName = 'Favicon';

export default Favicon;
