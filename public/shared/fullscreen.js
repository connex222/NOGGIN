/* NOGGIN: accessible, gesture-initiated fullscreen on TV and phones. */
(() => {
  'use strict';
  const root = document.documentElement;
  const supported = () => typeof root.requestFullscreen === 'function' && typeof document.exitFullscreen === 'function';
  const active = () => Boolean(document.fullscreenElement);
  let autoAttempted = false;
  const style = document.createElement('style');
  style.textContent = `
    #noggin-fullscreen-control{position:fixed;top:max(12px,env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right));z-index:2147483000;min-height:44px;padding:10px 14px;border:2px solid var(--collection-fullscreen-border,rgba(255,255,255,.6));border-radius:10px;background:var(--collection-fullscreen-bg,#14223a);color:var(--collection-fullscreen-color,#fff);font:700 13px/1.2 system-ui,sans-serif;letter-spacing:.035em;box-shadow:0 4px 18px rgba(0,0,0,.4);cursor:pointer}
    #noggin-fullscreen-control:focus-visible{outline:3px solid #ffdb58;outline-offset:3px}
    #noggin-fullscreen-control:disabled{opacity:.65;cursor:not-allowed}
    #noggin-fullscreen-control{box-sizing:border-box;max-width:calc(100vw - 24px);white-space:nowrap}
    #noggin-fullscreen-control.collection-fullscreen-compact{min-width:44px;width:44px;padding:8px;letter-spacing:0;text-align:center}
    #noggin-fullscreen-control.collection-fullscreen-docked{position:relative!important;top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;margin:4px 8px 4px auto;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle}
    body{min-height:100dvh}
  `;
  document.head.appendChild(style);
  // Keep the display toggle clear of other interactive elements on every screen.
  let placementQueued = false;
  function placeControl() {
    placementQueued = false;
    const control = document.getElementById('noggin-fullscreen-control');
    if (!control) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const inset = 12;
    // Respect live text, status indicators and artwork as well as clickable controls.
    // Ignore broad containers: only small, individually readable regions are obstacles.
    const selector = 'button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"]), h1, h2, h3, h4, h5, h6, p, label, output, [role="status"], [role="timer"], [data-score], [data-room-code], img, svg, canvas, video';
    const obstacles = [...document.querySelectorAll(selector)].slice(0, 650)
      .filter(el => el !== control && !control.contains(el) && !el.contains(control))
      .filter(el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
        const interactive = el.matches('button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])');
        return !interactive || cs.pointerEvents !== 'none';
      })
      .map(el => ({
        rect: el.getBoundingClientRect(),
        interactive: el.matches('button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])')
      }))
      .filter(({rect:r, interactive}) => r.width > 0 && r.height > 0 && (interactive || (r.width < width * .8 && r.height < height * .6)) && r.bottom > 0 && r.top < height && r.right > 0 && r.left < width)
      .map(({rect}) => rect);
    function findPosition(compact) {
      control.classList.toggle('collection-fullscreen-compact', compact);
      sync();
      const bw = control.offsetWidth || (compact ? 44 : 150);
      const bh = control.offsetHeight || 44;
      if (width < bw + 2 * inset || height < bh + 2 * inset) return null;
      const right = width - bw - inset;
      const bottom = height - bh - inset;
      const free = (x, y) => !obstacles.some(r => x < r.right + 8 && x + bw > r.left - 8 && y < r.bottom + 8 && y + bh > r.top - 8);
      const candidates = [[right, inset], [inset, inset], [right, bottom], [inset, bottom]];
      for (let y = inset + bh + 12; y + bh <= bottom; y += bh + 12) candidates.push([right, y], [inset, y]);
      return candidates.find(([x, y]) => free(x, y)) || null;
    }
    let position = findPosition(false);
    if (!position) position = findPosition(true);
    if (position) {
      control.classList.remove('collection-fullscreen-docked');
      const staleStrip = document.getElementById('collection-fullscreen-strip');
      if (staleStrip) staleStrip.style.display = 'none';
      if (control.parentElement !== document.body) document.body.appendChild(control);
      control.style.position = 'fixed';
      control.style.visibility = '';
      control.style.left = Math.round(position[0]) + 'px';
      control.style.top = Math.round(position[1]) + 'px';
      control.style.right = 'auto';
      control.style.bottom = 'auto';
      sync();
      return;
    }
    // A short or crowded screen has no safe floating position. Dock IN FLOW
    // instead of hiding the only fullscreen exit or covering other buttons.
    const slots = [
      document.querySelector('[data-collection-fullscreen-slot]'),
      document.querySelector('header .header-actions, header .toolbar, header .sound-tools, .mobile-topbar'),
      document.querySelector('header, [role="banner"]')
    ];
    const host = slots.find(el => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width >= 96 && el.getBoundingClientRect().height > 0);
    if (host) {
      const priorStrip = document.getElementById('collection-fullscreen-strip');
      if (priorStrip) priorStrip.style.display = 'none';
      if (control.parentElement !== host) host.appendChild(control);
      control.classList.add('collection-fullscreen-docked', 'collection-fullscreen-compact');
      control.style.visibility = '';
      sync();
    } else {
      // Rare fullscreen layouts with no header: reserve a dedicated strip in
      // document flow. Unlike a floating control, this does not cover buttons.
      let strip = document.getElementById('collection-fullscreen-strip');
      if (!strip) {
        strip = document.createElement('div');
        strip.id = 'collection-fullscreen-strip';
        strip.style.cssText = 'position:relative;z-index:2147483000;display:flex;justify-content:flex-end;min-height:48px;box-sizing:border-box;padding:2px max(12px,env(safe-area-inset-right)) 2px 8px;background:rgba(9,19,35,.94)';
        document.body.insertBefore(strip, document.body.firstChild);
      }
      strip.style.display = 'flex';
      if (control.parentElement !== strip) strip.appendChild(control);
      control.classList.add('collection-fullscreen-docked', 'collection-fullscreen-compact');
      control.style.visibility = '';
      sync();
    }
  }
  function schedulePlacement() {
    if (placementQueued) return;
    placementQueued = true;
    requestAnimationFrame(placeControl);
  }
  window.addEventListener('resize', schedulePlacement, {passive:true});
  window.addEventListener('scroll', schedulePlacement, {passive:true});
  document.addEventListener('fullscreenchange', schedulePlacement);
  const observer = new MutationObserver(mutations => {
    if (mutations.some(m => !m.target.closest?.('#noggin-fullscreen-control'))) schedulePlacement();
  });
  observer.observe(document.documentElement, {childList:true,subtree:true});
  function sync() {
    const control = document.getElementById('noggin-fullscreen-control');
    if (!control) return;
    const on = active();
    control.textContent = on ? (control.classList.contains('collection-fullscreen-compact') ? '⤢' : '⤢ EXIT FULLSCREEN') : (control.classList.contains('collection-fullscreen-compact') ? '⛶' : '⛶ FULLSCREEN');
    control.title = on ? 'Exit fullscreen' : 'Enter fullscreen';
    control.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Enter fullscreen');
    control.setAttribute('aria-pressed', String(on));
  }
  function request() {
    if (!supported() || active()) return;
    // Must happen directly inside the trusted user activation event.
    try { Promise.resolve(root.requestFullscreen()).then(sync).catch(sync); } catch (_) { sync(); }
  }
  function mount() {
    if (document.getElementById('noggin-fullscreen-control')) return;
    const button = document.createElement('button');
    button.id = 'noggin-fullscreen-control';
    button.type = 'button';
    button.disabled = !supported();
    if (button.disabled) button.title = 'Use your browser fullscreen control where supported';
    button.addEventListener('click', () => {
      autoAttempted = true;
      if (active()) {
        try { Promise.resolve(document.exitFullscreen()).then(sync).catch(sync); } catch (_) { sync(); }
      } else request();
    });
    document.body.appendChild(button);
    sync();
    schedulePlacement();
  }
  // A browser disallows fullscreen without user activation. Use the first
  // deliberate game-start action, not a load timer or text-field focus.
  document.addEventListener('click', event => {
    if (autoAttempted || active() || !supported() || !event.isTrusted) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('#noggin-fullscreen-control, input, textarea, select, a, [contenteditable="true"]')) return;
    const trigger = target.closest('button, [role="button"], input[type="submit"]');
    if (!trigger || trigger.disabled) return;
    autoAttempted = true;
    request();
  }, true);
  document.addEventListener('fullscreenchange', sync);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
