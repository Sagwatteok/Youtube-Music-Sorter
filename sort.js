// ==UserScript==
// @name         YTMusic Playlist Sorter & Adder
// @namespace    http://tampermonkey.net/
// @version      3.3
// @match        https://music.youtube.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  let lastChecked = null;

  function getPlaylistItems() {
    const container = document.querySelector('ytmusic-playlist-shelf-renderer #contents');
    if (!container) return [];
    return Array.from(container.querySelectorAll(':scope > ytmusic-responsive-list-item-renderer'));
  }

  async function getAuthHeader() {
    const sapisid = document.cookie.split(';')
      .find(c => c.trim().startsWith('SAPISID='))?.split('=')[1];
    if (!sapisid) return null;
    const ts = Math.floor(Date.now() / 1000);
    const str = `${ts} ${sapisid} https://music.youtube.com`;
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    return `SAPISIDHASH ${ts}_${hash}`;
  }

  function getApiConfig() {
    const cfg = window.ytcfg?.data_ ?? {};
    return {
      apiKey: cfg.INNERTUBE_API_KEY,
      context: { client: { clientName: 'WEB_REMIX', clientVersion: cfg.INNERTUBE_CLIENT_VERSION, hl: 'ko' } }
    };
  }

  async function fetchMyPlaylists() {
    const auth = await getAuthHeader();
    const { apiKey, context } = getApiConfig();
    const res = await fetch(`https://music.youtube.com/youtubei/v1/browse?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': auth, 'X-Origin': 'https://music.youtube.com', 'X-Goog-AuthUser': '0' },
      body: JSON.stringify({ context, browseId: 'FEmusic_liked_playlists' })
    });
    const data = await res.json();
    const items = data?.contents?.singleColumnBrowseResultsRenderer
      ?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents?.[0]
      ?.gridRenderer?.items ?? [];

    return items.map(item => {
      const r = item.musicTwoRowItemRenderer;
      if (!r) return null;
      const title = r.title?.runs?.[0]?.text;
      const browseId = r.navigationEndpoint?.browseEndpoint?.browseId;
      if (!browseId?.startsWith('VL')) return null;
      return { title, playlistId: browseId.slice(2) };
    }).filter(Boolean);
  }

  async function addToPlaylist(videoIds, playlistId) {
    const auth = await getAuthHeader();
    const { apiKey, context } = getApiConfig();
    const actions = videoIds.map(id => ({ action: 'ACTION_ADD_VIDEO', addedVideoId: id }));
    const res = await fetch(`https://music.youtube.com/youtubei/v1/browse/edit_playlist?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': auth, 'X-Origin': 'https://music.youtube.com', 'X-Goog-AuthUser': '0' },
      body: JSON.stringify({ context, playlistId, actions })
    });
    const data = await res.json();
    console.log('[YTMusic Adder] 응답:', data);
    return data?.status === 'STATUS_SUCCEEDED';
  }

  function getVideoId(item) {
    const link = item.querySelector('a[href*="watch?v="]');
    if (!link) return null;
    return new URLSearchParams(new URL(link.href).search).get('v');
  }

  // ── createElement로만 요소 생성 (innerHTML 미사용) ────
  function el(tag, style, text) {
    const e = document.createElement(tag);
    if (style) e.style.cssText = style;
    if (text) e.textContent = text;
    return e;
  }

  function injectCheckboxes() {
    getPlaylistItems().forEach(item => {
      if (item.querySelector('.yt-custom-cb')) return;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'yt-custom-cb';
      cb.style.cssText = 'width:18px;height:18px;cursor:pointer;flex-shrink:0;accent-color:#f03;margin:0 8px 0 4px;';
      cb.addEventListener('click', (e) => {
        const allCbs = Array.from(document.querySelectorAll('.yt-custom-cb'));
        if (e.shiftKey && lastChecked) {
          const start = allCbs.indexOf(lastChecked);
          const end = allCbs.indexOf(cb);
          const [from, to] = start < end ? [start, end] : [end, start];
          allCbs.slice(from, to + 1).forEach(c => c.checked = cb.checked);
        }
        lastChecked = cb;
        updateSelectedCount();
      });
      item.style.cssText = 'display:flex;align-items:center;';
      item.prepend(cb);
    });
    updateSelectedCount();
  }

  function updateSelectedCount() {
    const countEl = document.getElementById('yt-selected-count');
    if (!countEl) return;
    const count = document.querySelectorAll('.yt-custom-cb:checked').length;
    countEl.textContent = count > 0 ? `${count}곡 선택됨` : '';
  }

  async function showPlaylistPicker(videoIds) {
    document.getElementById('yt-pl-picker')?.remove();

    const overlay = el('div', 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:2147483647;display:flex;align-items:center;justify-content:center;');
    overlay.id = 'yt-pl-picker';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const modal = el('div', 'background:#212121;border-radius:12px;padding:24px;min-width:320px;max-width:400px;max-height:500px;display:flex;flex-direction:column;gap:12px;');

    const title = el('h3', 'color:#fff;margin:0;font-size:16px;', '재생목록 선택');
    const subtitle = el('p', 'color:#aaa;margin:0;font-size:13px;', `${videoIds.length}곡을 추가합니다`);
    const list = el('div', 'overflow-y:auto;max-height:300px;display:flex;flex-direction:column;gap:6px;');
    const loading = el('p', 'color:#aaa;font-size:13px;', '불러오는 중...');
    list.appendChild(loading);

    const closeBtn = el('button', 'background:#333;color:#eee;border:none;padding:8px;border-radius:6px;cursor:pointer;margin-top:4px;', '닫기');
    closeBtn.onclick = () => overlay.remove();

    modal.appendChild(title);
    modal.appendChild(subtitle);
    modal.appendChild(list);
    modal.appendChild(closeBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    try {
      const playlists = await fetchMyPlaylists();
      list.textContent = ''; // loading 제거

      if (playlists.length === 0) {
        list.appendChild(el('p', 'color:#aaa;font-size:13px;', '재생목록이 없어요.'));
        return;
      }

      playlists.forEach(({ title: plTitle, playlistId }) => {
        const btn = el('button', 'background:#333;color:#eee;border:none;padding:10px 14px;border-radius:6px;cursor:pointer;text-align:left;font-size:14px;', plTitle);
        btn.onmouseenter = () => btn.style.background = '#444';
        btn.onmouseleave = () => btn.style.background = '#333';
        btn.onclick = async () => {
          btn.textContent = '추가 중...';
          btn.disabled = true;
          try {
            const ok = await addToPlaylist(videoIds, playlistId);
            if (ok) {
              btn.textContent = '✅ 추가 완료!';
              btn.style.color = '#4caf50';
              document.querySelectorAll('.yt-custom-cb:checked').forEach(cb => cb.checked = false);
              updateSelectedCount();
              setTimeout(() => overlay.remove(), 1500);
            } else {
              btn.textContent = '❌ 실패. 콘솔을 확인해주세요.';
              btn.style.color = '#f44336';
              btn.disabled = false;
            }
          } catch(e) {
            console.error('[YTMusic Adder] 오류:', e);
            btn.textContent = '❌ 오류 발생';
            btn.style.color = '#f44336';
            btn.disabled = false;
          }
        };
        list.appendChild(btn);
      });
    } catch(e) {
      console.error('[YTMusic Adder] 재생목록 로드 오류:', e);
      list.textContent = '';
      list.appendChild(el('p', 'color:#f44;', '재생목록을 불러오지 못했어요.'));
    }
  }

  function getVal(item, selector) {
    return item.querySelector(selector)?.textContent.trim() ?? '';
  }

  function sortPlaylist(method) {
    const items = getPlaylistItems();
    if (items.length === 0) { alert('곡 목록을 찾지 못했어요.'); return; }
    const container = items[0].parentElement;

    items.sort((a, b) => {
      const titleA  = getVal(a, 'yt-formatted-string.title');
      const titleB  = getVal(b, 'yt-formatted-string.title');
      const artistA = getVal(a, '.secondary-flex-columns yt-formatted-string:first-child');
      const artistB = getVal(b, '.secondary-flex-columns yt-formatted-string:first-child');
      const albumA  = getVal(a, '.secondary-flex-columns yt-formatted-string:nth-child(2)');
      const albumB  = getVal(b, '.secondary-flex-columns yt-formatted-string:nth-child(2)');

      switch (method) {
        case 'az':           return titleA.localeCompare(titleB, 'ko');
        case 'za':           return titleB.localeCompare(titleA, 'ko');
        case 'artist':       return artistA.localeCompare(artistB, 'ko');
        case 'album':        return albumA.localeCompare(albumB, 'ko');
        case 'artist_album': {
          const cmp = artistA.localeCompare(artistB, 'ko');
          return cmp !== 0 ? cmp : albumA.localeCompare(albumB, 'ko');
        }
      }
      return 0;
    });

    const fragment = document.createDocumentFragment();
    items.forEach(item => fragment.appendChild(item));
    container.appendChild(fragment);
    setTimeout(injectCheckboxes, 300);
  }

  function injectSortBar() {
    if (document.getElementById('yt-pl-sorter')) return;

    const bar = el('div', 'position:fixed;top:65px;right:20px;z-index:9999;background:#212121;padding:8px 12px;border-radius:10px;display:flex;flex-wrap:wrap;gap:8px;max-width:460px;box-shadow:0 2px 10px rgba(0,0,0,0.5);');
    bar.id = 'yt-pl-sorter';

    [
      { label: '🔤 A→Z',            sort: 'az' },
      { label: '🔤 Z→A',            sort: 'za' },
      { label: '🎤 아티스트',        sort: 'artist' },
      { label: '💿 앨범',            sort: 'album' },
      { label: '🎤💿 아티스트+앨범', sort: 'artist_album' },
    ].forEach(({ label, sort }) => {
      const btn = el('button', 'background:#333;color:#eee;border:none;font-size:13px;padding:6px 12px;border-radius:6px;cursor:pointer;', label);
      btn.onmouseenter = () => btn.style.background = '#555';
      btn.onmouseleave = () => btn.style.background = '#333';
      btn.onclick = () => sortPlaylist(sort);
      bar.appendChild(btn);
    });

    bar.appendChild(el('div', 'width:100%;height:1px;background:#444;'));

    const selectAllBtn = el('button', 'background:#333;color:#eee;border:none;font-size:13px;padding:6px 12px;border-radius:6px;cursor:pointer;', '☑ 전체선택');
    selectAllBtn.onclick = () => {
      const allCbs = document.querySelectorAll('.yt-custom-cb');
      const allChecked = Array.from(allCbs).every(cb => cb.checked);
      allCbs.forEach(cb => cb.checked = !allChecked);
      updateSelectedCount();
    };
    bar.appendChild(selectAllBtn);

    const countEl = el('span', 'color:#aaa;font-size:13px;line-height:32px;');
    countEl.id = 'yt-selected-count';
    bar.appendChild(countEl);

    const addBtn = el('button', 'background:#f03;color:#fff;border:none;font-size:13px;padding:6px 12px;border-radius:6px;cursor:pointer;', '➕ 재생목록에 추가');
    addBtn.onclick = () => {
      const checked = Array.from(document.querySelectorAll('.yt-custom-cb:checked'));
      if (checked.length === 0) { alert('곡을 먼저 선택해주세요!'); return; }
      const videoIds = checked
        .map(cb => cb.closest('ytmusic-responsive-list-item-renderer'))
        .filter(Boolean)
        .map(getVideoId)
        .filter(Boolean);
      if (videoIds.length === 0) { alert('videoId를 찾지 못했어요.'); return; }
      showPlaylistPicker(videoIds);
    };
    bar.appendChild(addBtn);

    document.body.appendChild(bar);
    setTimeout(injectCheckboxes, 500);
  }

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      document.getElementById('yt-pl-sorter')?.remove();
      document.querySelectorAll('.yt-custom-cb').forEach(cb => cb.remove());
    }
    if (location.href.includes('/playlist')) {
      injectSortBar();
    } else {
      document.getElementById('yt-pl-sorter')?.remove();
    }
  }, 1000);

  injectSortBar();
})();