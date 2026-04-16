import { WebContentsView, session } from 'electron';
import { DownloadItem as AstraDownloadItem, IPC } from '../types';

/**
 * DownloadManager — tracks file downloads.
 *
 * Listens on the DEFAULT SESSION (shared by all tabs) instead of
 * per-view. This avoids registering duplicate 'will-download' handlers
 * when multiple tabs share the same session.
 */
export class DownloadManager {
  private readonly downloads: Map<string, AstraDownloadItem> = new Map();
  private downloadCounter = 0;
  private initialized = false;

  constructor(
    private readonly sidebarView: WebContentsView,
  ) {}

  /**
   * Attach download listener to the default session ONCE.
   * Previous implementation attached per-view which caused duplicate events.
   */
  attachToView(_view: WebContentsView): void {
    // Only register once on the shared session
    if (this.initialized) return;
    this.initialized = true;

    session.defaultSession.on('will-download', (_event, item) => {
      const id = `dl-${++this.downloadCounter}`;

      const download: AstraDownloadItem = {
        id,
        filename: item.getFilename(),
        url: item.getURL(),
        totalBytes: item.getTotalBytes(),
        receivedBytes: 0,
        state: 'progressing',
      };

      this.downloads.set(id, download);
      this.sendUpdate(download);

      item.on('updated', (_event, state) => {
        download.receivedBytes = item.getReceivedBytes();
        download.totalBytes = item.getTotalBytes();
        download.state = state === 'interrupted' ? 'interrupted' : 'progressing';
        this.sendUpdate(download);
      });

      item.once('done', (_event, state) => {
        download.receivedBytes = item.getReceivedBytes();
        download.state = state === 'completed' ? 'completed' : 'cancelled';
        this.sendUpdate(download);

        // Cleanup after 5 seconds
        setTimeout(() => this.downloads.delete(id), 5000);
      });
    });
  }

  private sendUpdate(download: AstraDownloadItem): void {
    this.sidebarView.webContents.send(IPC.DOWNLOAD_UPDATED, download);
  }
}
