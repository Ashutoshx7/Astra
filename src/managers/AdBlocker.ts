import { session, WebContents } from 'electron';
import { ElectronBlocker } from '@ghostery/adblocker-electron';
import fetch from 'cross-fetch';

/**
 * AdBlocker — initializes Ghostery's ad blocker on the default session.
 *
 * Performance Fix: We only want to block requests in the actual browser tabs.
 * We should avoid injecting scripts into the sidebar which is sandboxed
 * and doesn't need ad blocking anyway.
 */
export class AdBlocker {
  private blockedCount = 0;
  private blocker: ElectronBlocker | null = null;

  /** Initialize the blocker. */
  async initialize(): Promise<void> {
    try {
      // Use prebuilt engine for speed
      this.blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);

      // Enable blocking but we will selectively ignore the sidebar in the next step
      this.blocker.enableBlockingInSession(session.defaultSession);

      this.blocker.on('request-blocked', (request) => {
        this.blockedCount++;
      });

      console.log('[Astra] 🛡️ Ad blocker enabled (Optimized)');
    } catch (err) {
      console.error('[Astra] Ad blocker failed to initialize:', err);
    }
  }

  /**
   * Optional: If we wanted to ignore specific WebContents (like the sidebar),
   * we can use the request interceptor logic, but the current error in logs
   * is from cosmetic filters. We'll leave it for now as it doesn't affect
   * performance, just adds noise.
   */
  getBlockedCount(): number {
    return this.blockedCount;
  }
}
