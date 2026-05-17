// @ts-check
(function () {
  'use strict';

  // ── Scroll spy for header nav ────────────────────────────────────────
  function initScrollSpy() {
    const sections = document.querySelectorAll('section[id]');
    if (!sections.length) return;
    const navLinks = document.querySelectorAll('.header-nav a[href^="#"]');

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            navLinks.forEach(a => {
              a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
            });
          }
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    sections.forEach(s => obs.observe(s));
  }

  // ── Header shrink on scroll ──────────────────────────────────────────
  function initHeaderShrink() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const onScroll = () => header.classList.toggle('shrunken', window.scrollY > 100);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── Smooth scroll for anchor links ───────────────────────────────────
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const href = a.getAttribute('href');
        if (!href || href === '#') return;
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // ── Install tabs ────────────────────────────────────────────────────
  function initInstallTabs() {
    const tabs = /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('.install-tab'));
    const panels = document.querySelectorAll('.install-panel');
    if (!tabs.length) return;

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const platform = tab.dataset.platform;
        if (!platform) return;
        tabs.forEach(t => {
          const isActive = t === tab;
          t.classList.toggle('active', isActive);
          t.setAttribute('aria-selected', String(isActive));
        });
        panels.forEach(p => p.classList.toggle('active', p.id === `panel-${platform}`));
      });
    });

    const params = new URLSearchParams(location.search);
    const paramPlatform = params.get('platform');
    if (paramPlatform) {
      const match = /** @type {HTMLButtonElement|null} */ (document.querySelector(`.install-tab[data-platform="${paramPlatform}"]`));
      if (match) match.click();
      return;
    }
    const ua = navigator.userAgent;
    const isMac = /Mac|iPhone|iPad/.test(ua);
    const defaultTab = /** @type {HTMLButtonElement|null} */ (document.querySelector(`.install-tab[data-platform="${isMac ? 'mac' : 'win'}"]`));
    if (defaultTab) defaultTab.click();
  }

  // ── Screenshot lightbox ──────────────────────────────────────────────
  function initLightbox() {
    const dialog = /** @type {HTMLDialogElement|null} */ (document.getElementById('lightbox-dialog'));
    if (!dialog || typeof dialog.showModal !== 'function') return;

    document.querySelectorAll('[data-lightbox]').forEach(img => {
      img.addEventListener('click', () => {
        const src = img.getAttribute('data-lightbox') || img.getAttribute('src') || '';
        const alt = img.getAttribute('alt') || '';
        const imgEl = dialog.querySelector('img');
        if (imgEl) {
          imgEl.src = src;
          imgEl.alt = alt;
        }
        dialog.showModal();
      });
    });

    dialog.addEventListener('click', e => {
      if (e.target === dialog) dialog.close();
    });
  }

  // ── Floating download bar ────────────────────────────────────────────
  function initFloatingBar() {
    const bar = document.querySelector('.floating-bar');
    const hero = document.querySelector('.hero');
    if (!bar || !hero) return;

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        bar.classList.toggle('visible', !entry.isIntersecting);
      });
    }, { threshold: 0, rootMargin: '-80px 0px 0px 0px' });

    obs.observe(hero);
  }

  // ── Copy buttons in install code blocks ────────────────────────────
  function initCopyButtons() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const block = btn.closest('.code-block');
        if (!block) return;
        const pre = block.querySelector('pre');
        if (!pre) return;
        const text = (pre.textContent || '').trim();
        const orig = btn.textContent || 'Copy';
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = btn.getAttribute('data-copied') || 'Copied!';
        } catch {
          btn.textContent = '—';
        }
        setTimeout(() => { btn.textContent = orig; }, 1500);
      });
    });
  }

  // ── "Other downloads" toggle ────────────────────────────────────────
  function initOtherDownloads() {
    const btn = document.getElementById('toggle-other');
    const panel = document.getElementById('other-downloads');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      panel.classList.toggle('open', !expanded);
    });
  }

  // ── Language switcher ───────────────────────────────────────────────
  function initLangSwitcher() {
    const dropdown = /** @type {HTMLSelectElement|null} */ (document.getElementById('lang-dropdown'));
    if (!dropdown) return;
    dropdown.addEventListener('change', () => {
      const lang = dropdown.value;
      try { localStorage.setItem('ssc-lang', lang); } catch { /* ignore */ }
      // Build a target path that works on any host (GitHub Pages or localhost).
      const here = location.pathname;
      const stripped = here.replace(/\/(en|vi|zh)\/?$/, '/');
      const base = stripped.endsWith('/') ? stripped : stripped + '/';
      location.assign(`${base}${lang}/`);
    });
  }

  // ── Init all ────────────────────────────────────────────────────────
  function init() {
    initScrollSpy();
    initHeaderShrink();
    initSmoothScroll();
    initInstallTabs();
    initLightbox();
    initFloatingBar();
    initCopyButtons();
    initOtherDownloads();
    initLangSwitcher();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
