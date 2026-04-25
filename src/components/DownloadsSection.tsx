import React from 'react';
import type { DownloadItem } from '../types/renderer';

interface DownloadsSectionProps {
  downloads: DownloadItem[];
}

const DownloadsSection: React.FC<DownloadsSectionProps> = ({ downloads }) => {
  const active = downloads.filter((d) => d.state === 'progressing');
  if (active.length === 0) return null;

  return (
    <div className="downloads-section">
      {active.map((dl) => (
        <div key={dl.id} className="download-item">
          <span className="download-icon">📥</span>
          <div className="download-info">
            <span className="download-name">{dl.filename}</span>
            <div className="download-progress-bar">
              <div
                className="download-progress-fill"
                style={{
                  width: dl.totalBytes > 0
                    ? `${(dl.receivedBytes / dl.totalBytes) * 100}%`
                    : '0%',
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DownloadsSection;
