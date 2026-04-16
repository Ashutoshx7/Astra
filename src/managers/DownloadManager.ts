import { WebContentsView, ipcMain } from 'electron';
import { DownloadItem as AstraDownloadItem, IPC } from '../types';

/**
 * DownloadManager — tracks file downloads across all tabs.
 *
 * Listens for 'will-download' on each tab's webContents and sends
 * progress updates to the sidebar via IPC.
 */
export class DownloadManager {
  private readonly downloads: Map<string, AstraDownloadItem> = new Map();
  private downloadCounter = 0;

  constructor(
    private readonly sidebarView: WebContentsView,
  ) {}

  /** Attach download listener to a tab's WebContentsView */
  attachToView(view: WebContentsView): void {
    view.webContents.session.on('will-download', (_event, item) => {
      const id = `dl-${++this.downloadCounter}`;
      const filename = item.getFilename();
      const url = item.getURL();

      const download: AstraDownloadItem = {
        id,
        filename,
        url,
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

        // Remove from active downloads after 5 seconds
        setTimeout(() => this.downloads.delete(id), 5000);
      });
    });
  }

  /** Send download update to sidebar */
  private sendUpdate(download: AstraDownloadItem): void {
    this.sidebarView.webContents.send(IPC.DOWNLOAD_UPDATED, download);
  }
}
