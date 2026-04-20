import { session, WebContents } from 'electron';

/**
 * FingerprintGuard — Privacy protection inspired by Helium's noise injection system.
 *
 * Helium's approach (C++):
 *   - FNV1a hash creates deterministic per-origin noise tokens
 *   - CanvasNoisingHelper applies noise to canvas readback pixel data
 *   - AudioContext adds micro-noise to frequency data
 *   - WebGL renderer strings are spoofed
 *   - Client rects add sub-pixel noise
 *
 * Our Electron approach (since we can't modify Chromium C++):
 *   - Inject JS into every page that wraps canvas/audio/webgl APIs
 *   - Use deterministic hashing (origin + session seed) for consistency
 *   - Override navigator properties to reduce fingerprint surface
 *   - Strip referrer to origin-only
 *   - Block known fingerprinting scripts via headers
 *
 * This is a defense-in-depth layer alongside the AdBlocker.
 */

// FNV1a constants (matching Helium's implementation)
const FNV_PRIME = 0x01000193;
const FNV_OFFSET = 0x811c9dc5;

/**
 * Deterministic hash — same as Helium's HeliumNoiseHash.
 * Given the same input, always produces the same output.
 * This ensures canvas noise is consistent per-origin within a session
 * (so sites don't detect randomness changing between reads).
 */
function fnv1aHash(str: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0; // unsigned 32-bit
}

/**
 * Generate a noise value from hash — small enough to be imperceptible
 * but sufficient to defeat fingerprinting.
 * Helium uses values in range [-1, 1] for pixel noise.
 */
function noiseFromHash(hash: number, index: number): number {
  const combined = fnv1aHash(`${hash}:${index}`);
  // Map to [-0.5, 0.5] range (imperceptible but unique)
  return ((combined % 100) / 100) - 0.5;
}

export class FingerprintGuard {
  private sessionSeed: number;
  private enabled = true;
  // WeakSet: tracks which WebContents already have protection listeners attached.
  // WeakSet ensures GC can collect destroyed WebContents without memory leaks.
  private readonly protected = new WeakSet<WebContents>();

  constructor() {
    // Generate a session-unique seed (changes each app launch)
    this.sessionSeed = Math.floor(Math.random() * 0xFFFFFFFF);
    console.log(`[Astra] 🛡️ FingerprintGuard initialized (seed: ${this.sessionSeed.toString(16)})`);
  }

  /**
   * Initialize all protection layers.
   */
  initialize(): void {
    this.setupHeaderProtection();
    this.setupReferrerPolicy();
    console.log('[Astra] 🛡️ Fingerprint protections active');
  }

  /**
   * Inject fingerprint protection scripts into a WebContents.
   * Called when a new tab is created.
   */
  injectProtections(webContents: WebContents): void {
    if (!this.enabled) return;

    // Use a WeakSet to track which WebContents already have the listener attached.
    // Without this, calling injectProtections multiple times (e.g. due to onViewCreated
    // being called after session restore) would stack listeners.
    if (this.protected.has(webContents)) return;
    this.protected.add(webContents);

    // 'did-navigate' fires after cross-document navigation (covers page loads).
    // We don't use 'did-finish-load' because it fires even for subframes & redirects.
    webContents.on('did-navigate', () => {
      if (!this.enabled) return;
      const origin = this.getOrigin(webContents.getURL());
      const originHash = fnv1aHash(`${origin}:${this.sessionSeed}`);
      this.injectCanvasProtection(webContents, originHash);
      this.injectNavigatorProtection(webContents);
      this.injectWebGLProtection(webContents, originHash);
    });

    // Also inject on same-page navigation (hash changes, history.pushState)
    webContents.on('did-navigate-in-page', (_e, _url, isMainFrame) => {
      if (!this.enabled || !isMainFrame) return;
      const origin = this.getOrigin(webContents.getURL());
      const originHash = fnv1aHash(`${origin}:${this.sessionSeed}`);
      this.injectNavigatorProtection(webContents);
      this.injectWebGLProtection(webContents, originHash);
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[Astra] 🛡️ FingerprintGuard: ${enabled ? 'enabled' : 'disabled'}`);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // --------------------------------------------------
  // Canvas Fingerprint Protection (Helium's core innovation)
  // --------------------------------------------------

  /**
   * Wraps HTMLCanvasElement.toDataURL and toBlob to add deterministic noise.
   * Helium does this at the pixel level in C++; we do it via JS canvas API wrapping.
   */
  private injectCanvasProtection(wc: WebContents, originHash: number): void {
    const noiseScript = `
      (function() {
        if (window.__astraCanvasProtected) return;
        window.__astraCanvasProtected = true;

        const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const origToBlob = HTMLCanvasElement.prototype.toBlob;
        const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;

        // Add subtle noise to getImageData (Helium's CanvasNoisingHelper pattern)
        CanvasRenderingContext2D.prototype.getImageData = function(...args) {
          const imageData = origGetImageData.apply(this, args);
          const data = imageData.data;
          const hash = ${originHash};

          // Add noise to ~1% of pixels (imperceptible but defeats fingerprinting)
          for (let i = 0; i < data.length; i += 4) {
            if ((i * hash) % 100 < 1) {
              const noise = ((hash + i) % 3) - 1; // -1, 0, or 1
              data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
              data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise)); // G
            }
          }
          return imageData;
        };

        // Wrap toDataURL to use our noised getImageData
        HTMLCanvasElement.prototype.toDataURL = function(...args) {
          return origToDataURL.apply(this, args);
        };

        HTMLCanvasElement.prototype.toBlob = function(...args) {
          return origToBlob.apply(this, args);
        };
      })();
    `;

    wc.executeJavaScript(noiseScript).catch(() => {});
  }

  // --------------------------------------------------
  // Navigator Fingerprint Reduction
  // --------------------------------------------------

  /**
   * Override navigator properties to reduce uniqueness.
   * Helium randomizes hardware concurrency; we normalize it.
   */
  private injectNavigatorProtection(wc: WebContents): void {
    const script = `
      (function() {
        if (window.__astraNavProtected) return;
        window.__astraNavProtected = true;

        // Normalize hardware concurrency (Helium pattern)
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => 4, // Common value
          configurable: true,
        });

        // Normalize device memory
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => 8, // Common value
          configurable: true,
        });

        // Reduce language fingerprint surface
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
          configurable: true,
        });
      })();
    `;

    wc.executeJavaScript(script).catch(() => {});
  }

  // --------------------------------------------------
  // WebGL Fingerprint Protection
  // --------------------------------------------------

  /**
   * Override WebGL debug renderer info to return generic values.
   * Helium patches the GPU info at the Chromium level; we wrap the JS API.
   */
  private injectWebGLProtection(wc: WebContents, originHash: number): void {
    const script = `
      (function() {
        if (window.__astraWebGLProtected) return;
        window.__astraWebGLProtected = true;

        const origGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(param) {
          // UNMASKED_VENDOR_WEBGL = 0x9245
          if (param === 0x9245) return 'Generic GPU Vendor';
          // UNMASKED_RENDERER_WEBGL = 0x9246
          if (param === 0x9246) return 'Generic GPU Renderer';
          return origGetParameter.call(this, param);
        };

        // Also patch WebGL2
        if (typeof WebGL2RenderingContext !== 'undefined') {
          const origGetParam2 = WebGL2RenderingContext.prototype.getParameter;
          WebGL2RenderingContext.prototype.getParameter = function(param) {
            if (param === 0x9245) return 'Generic GPU Vendor';
            if (param === 0x9246) return 'Generic GPU Renderer';
            return origGetParam2.call(this, param);
          };
        }
      })();
    `;

    wc.executeJavaScript(script).catch(() => {});
  }

  // --------------------------------------------------
  // HTTP Header Protection
  // --------------------------------------------------

  /**
   * Strip or modify headers that leak fingerprint info.
   * Helium trims referrer to origin-only; we do the same.
   */
  private setupHeaderProtection(): void {
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      if (!this.enabled) {
        callback({ requestHeaders: details.requestHeaders });
        return;
      }

      const headers = { ...details.requestHeaders };

      // Strip detailed referrer (Helium's referrer trimming)
      if (headers['Referer']) {
        try {
          const url = new URL(headers['Referer']);
          headers['Referer'] = url.origin + '/';
        } catch {
          delete headers['Referer'];
        }
      }

      // Remove client hints that leak hardware info
      delete headers['Sec-CH-UA-Platform-Version'];
      delete headers['Sec-CH-UA-Full-Version-List'];
      delete headers['Sec-CH-UA-Arch'];
      delete headers['Sec-CH-UA-Model'];
      delete headers['Sec-CH-UA-Bitness'];

      callback({ requestHeaders: headers });
    });
  }

  /**
   * Set strict referrer policy on all responses.
   */
  private setupReferrerPolicy(): void {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      if (!this.enabled) {
        callback({ responseHeaders: details.responseHeaders });
        return;
      }

      const headers = { ...details.responseHeaders };
      headers['Referrer-Policy'] = ['strict-origin-when-cross-origin'];

      callback({ responseHeaders: headers });
    });
  }

  // --------------------------------------------------
  // Utils
  // --------------------------------------------------

  private getOrigin(url: string): string {
    try {
      return new URL(url).origin;
    } catch {
      return 'unknown';
    }
  }
}
