// @ts-check
(function () {
  'use strict';

  const REPO = 'quangtruong2003/SmoothScroll';
  const FALLBACK_VERSION = '0.1.15';

  /** @returns {'win'|'mac'|'other'} */
  function detectOS() {
    const ua = navigator.userAgent;
    if (/Mac|iPhone|iPad/.test(ua)) return 'mac';
    if (/Windows/.test(ua)) return 'win';
    return 'other';
  }

  /** @param {number} bytes */
  function formatSize(bytes) {
    if (!bytes || bytes <= 0) return '';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  }

  /**
   * @typedef {Object} ReleaseAsset
   * @property {string} name
   * @property {string} browser_download_url
   * @property {number} [size]
   */

  /** @type {ReleaseAsset[]} */
  const FALLBACK_ASSETS = [
    { name: `SmoothScroll_${FALLBACK_VERSION}_x64-setup.exe`, browser_download_url: `https://github.com/${REPO}/releases/download/v${FALLBACK_VERSION}/SmoothScroll_${FALLBACK_VERSION}_x64-setup.exe`, size: 2800480 },
    { name: `SmoothScroll_${FALLBACK_VERSION}_x64_en-US.msi`, browser_download_url: `https://github.com/${REPO}/releases/download/v${FALLBACK_VERSION}/SmoothScroll_${FALLBACK_VERSION}_x64_en-US.msi`, size: 3850240 },
    { name: `SmoothScroll_${FALLBACK_VERSION}_x64_vi-VN.msi`, browser_download_url: `https://github.com/${REPO}/releases/download/v${FALLBACK_VERSION}/SmoothScroll_${FALLBACK_VERSION}_x64_vi-VN.msi`, size: 3850240 },
    { name: `SmoothScroll_${FALLBACK_VERSION}_x64_zh-CN.msi`, browser_download_url: `https://github.com/${REPO}/releases/download/v${FALLBACK_VERSION}/SmoothScroll_${FALLBACK_VERSION}_x64_zh-CN.msi`, size: 3846144 },
    { name: `SmoothScroll_${FALLBACK_VERSION}_aarch64.dmg`, browser_download_url: `https://github.com/${REPO}/releases/download/v${FALLBACK_VERSION}/SmoothScroll_${FALLBACK_VERSION}_aarch64.dmg`, size: 5340325 },
    { name: `SmoothScroll_${FALLBACK_VERSION}_x64.dmg`, browser_download_url: `https://github.com/${REPO}/releases/download/v${FALLBACK_VERSION}/SmoothScroll_${FALLBACK_VERSION}_x64.dmg`, size: 5606173 },
  ];

  /** @param {ReleaseAsset[]} assets @param {'win'|'mac'|'other'} os */
  function pickPrimaryAsset(assets, os) {
    if (os === 'mac') {
      return assets.find(a => /aarch64\.dmg$/.test(a.name)) || assets.find(a => /\.dmg$/.test(a.name));
    }
    return assets.find(a => /x64-setup\.exe$/.test(a.name));
  }

  /** @param {string} elId @param {string} href */
  function setHref(elId, href) {
    const el = /** @type {HTMLAnchorElement|null} */ (document.getElementById(elId));
    if (el) el.href = href;
  }

  /** @param {string} elId @param {string} text */
  function setText(elId, text) {
    const el = document.getElementById(elId);
    if (el) el.textContent = text;
  }

  /**
   * @param {ReleaseAsset[]} assets
   * @param {string} version
   * @param {'win'|'mac'|'other'} os
   */
  function applyAll(assets, version, os) {
    const primary = pickPrimaryAsset(assets, os);
    if (primary) {
      setHref('cta-primary', primary.browser_download_url);
      setHref('cta-how', primary.browser_download_url);
      setHref('cta-floating', primary.browser_download_url);
    }

    const trustEl = /** @type {HTMLElement|null} */ (document.getElementById('trust-line'));
    if (trustEl) {
      const sizeStr = primary && primary.size ? formatSize(primary.size) : '';
      const tpl = trustEl.dataset.tpl || 'v{version}  ·  free  ·  {size}  ·  no signup';
      const fallbackSize = trustEl.dataset.fallbackSize || '4.2 MB';
      trustEl.textContent = tpl
        .replace('{version}', version)
        .replace('{size}', sizeStr || fallbackSize);
    }

    setText('floating-version', `v${version}`);

    const others = document.getElementById('other-downloads');
    if (others) {
      others.innerHTML = '';
      assets.forEach(a => {
        const p = document.createElement('p');
        const link = document.createElement('a');
        link.href = a.browser_download_url;
        link.className = 'download-link';
        link.rel = 'noopener';
        const sizeStr = a.size ? formatSize(a.size) : '';
        link.textContent = sizeStr ? `${a.name} (${sizeStr})` : a.name;
        p.appendChild(link);
        others.appendChild(p);
      });
    }
  }

  async function init() {
    const os = detectOS();

    // Always wire fallback first so the page is interactive even before the API responds.
    applyAll(FALLBACK_ASSETS, FALLBACK_VERSION, os);

    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { 'Accept': 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error('API error ' + res.status);
      const data = await res.json();
      const version = String(data.tag_name || '').replace(/^v/, '') || FALLBACK_VERSION;

      /** @type {ReleaseAsset[]} */
      const assets = (data.assets || [])
        .filter(/** @param {any} a */(a) => !/\.sig$/.test(a.name) && a.name !== 'latest.json')
        .map(/** @param {any} a */(a) => ({
          name: a.name,
          browser_download_url: a.browser_download_url,
          size: a.size,
        }));

      if (assets.length) applyAll(assets, version, os);
    } catch (err) {
      // Graceful degradation: keep fallback wiring in place.
      console.warn('[SmoothScroll] Could not fetch GitHub release:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
