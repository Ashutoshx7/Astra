import { session } from 'electron';
import { ElectronBlocker } from '@ghostery/adblocker-electron';
import fetch from 'cross-fetch';

/**
 * AdBlocker — initializes Ghostery's ad blocker on the default session.
 *
 * Downloads EasyList + EasyPrivacy filter lists and blocks matching
 * network requests across ALL WebContentsViews sharing the default session.
 *
 * This runs once at app startup and covers all tabs automatically.
 */
export class AdBlocker {
  private blockedCount = 0;

  /** Initialize the blocker. Call this BEFORE creating any windows. */
  async initialize(): Promise<void> {
    try {
      const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
      blocker.enableBlockingInSession(session.defaultSession);

      blocker.on('request-blocked', () => {
        this.blockedCount++;
      });

      console.log('[Astra] 🛡️ Ad blocker enabled — ads & trackers will be blocked');
    } catch (err) {
      console.error('[Astra] Ad blocker failed to initialize:', err);
    }
  }

  /** Get total blocked request count */
  getBlockedCount(): number {
    return this.blockedCount;
  }
}
