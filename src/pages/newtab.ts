/**
 * New Tab Page — generates inline HTML for the new tab page.
 *
 * Uses a data URL for instant loading (no file I/O, no network).
 * The page has a search box that posts to DuckDuckGo.
 */
export function getNewTabPageUrl(): string {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>New Tab</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: #0f0f1a;
    color: #e0e0e0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .container {
    text-align: center;
    width: 100%;
    max-width: 580px;
    padding: 0 24px;
  }

  .logo {
    font-size: 48px;
    font-weight: 700;
    background: linear-gradient(135deg, #6366f1, #818cf8, #a5b4fc);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 8px;
    letter-spacing: -1px;
  }

  .subtitle {
    font-size: 14px;
    color: #555;
    margin-bottom: 40px;
  }

  .search-form {
    width: 100%;
    position: relative;
  }

  .search-input {
    width: 100%;
    padding: 16px 20px;
    padding-left: 48px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.04);
    color: #e0e0e0;
    font-size: 16px;
    outline: none;
    transition: all 0.3s ease;
  }

  .search-input:focus {
    border-color: rgba(99, 102, 241, 0.5);
    background: rgba(255, 255, 255, 0.06);
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1), 0 8px 32px rgba(0,0,0,0.3);
  }

  .search-input::placeholder {
    color: #555;
  }

  .search-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 18px;
    color: #555;
    pointer-events: none;
  }

  .time {
    font-size: 64px;
    font-weight: 200;
    color: rgba(255,255,255,0.15);
    margin-bottom: 32px;
    letter-spacing: 4px;
    font-variant-numeric: tabular-nums;
  }

  .shortcuts {
    display: flex;
    gap: 24px;
    justify-content: center;
    margin-top: 48px;
  }

  .shortcut {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: #666;
    font-size: 12px;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .shortcut:hover { color: #a5b4fc; }

  .shortcut-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    transition: all 0.2s ease;
  }

  .shortcut:hover .shortcut-icon {
    background: rgba(99, 102, 241, 0.1);
    border-color: rgba(99, 102, 241, 0.3);
  }
</style>
</head>
<body>
  <div class="container">
    <div class="time" id="clock"></div>
    <div class="logo">Astra</div>
    <div class="subtitle">Protection. Privacy. Peace of mind.</div>
    <form class="search-form" action="https://duckduckgo.com/" method="GET">
      <span class="search-icon">🔍</span>
      <input
        class="search-input"
        type="text"
        name="q"
        placeholder="Search the web privately..."
        autofocus
      />
    </form>
    <div class="shortcuts">
      <a class="shortcut" href="https://github.com">
        <div class="shortcut-icon">🐙</div>
        GitHub
      </a>
      <a class="shortcut" href="https://youtube.com">
        <div class="shortcut-icon">▶️</div>
        YouTube
      </a>
      <a class="shortcut" href="https://reddit.com">
        <div class="shortcut-icon">🤖</div>
        Reddit
      </a>
      <a class="shortcut" href="https://news.ycombinator.com">
        <div class="shortcut-icon">📰</div>
        HN
      </a>
    </div>
  </div>
  <script>
    function updateClock() {
      const now = new Date();
      document.getElementById('clock').textContent =
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    updateClock();
    setInterval(updateClock, 1000);
  </script>
</body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
