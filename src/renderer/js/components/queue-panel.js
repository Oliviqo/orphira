/**
 * COSMIC PLAYER - VIRTUALIZED QUEUE PANEL MANAGER
 * Виртуализированный менеджер очереди без конфликтов верстки (60 FPS)
 */
class QueuePanelManager {
  constructor() {
    this.panelEl = null;
    this.contentEl = null;
    this.badgeEl = null;
    this.countTagEl = null;
    this.durationTagEl = null;
    this.itemHeight = 56;
    this.buffer = 8;
    this.draggedQueueId = null;
  }

  init() {
    this.panelEl = document.getElementById('queue-panel');
    this.contentEl = document.getElementById('queue-content');
    this.badgeEl = document.getElementById('ui-queue-badge');
    this.countTagEl = document.getElementById('queue-count-tag');
    this.durationTagEl = document.getElementById('queue-duration-tag');

    if (this.contentEl) {
      this.contentEl.addEventListener('scroll', () => this.render());
    }

    document.querySelectorAll('.queue-toggle-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this.toggle();
      };
    });

    document.getElementById('btn-close-queue')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });

    document.getElementById('btn-clear-queue')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearQueue(false);
    });

    document.getElementById('btn-clear-played-queue')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearPlayed();
    });

    document.getElementById('btn-save-queue-pl')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.saveQueueAsPlaylist();
    });

    this.update();
  }

  toggle() {
    if (!this.panelEl) this.panelEl = document.getElementById('queue-panel');
    if (!this.panelEl) return;
    const isHidden = this.panelEl.classList.contains('hidden');
    if (isHidden) {
      this.show();
    } else {
      this.hide();
    }
  }

 show() {
 if (!this.panelEl) this.panelEl = document.getElementById('queue-panel');
 if (!this.panelEl) return;
 this.panelEl.classList.remove('hidden');
 document.querySelectorAll('.queue-toggle-btn').forEach(btn => btn.classList.add('active'));
 this.render();
 setTimeout(() => this.centerActiveTrack(), 80);
 }

 hide() {
 if (!this.panelEl) this.panelEl = document.getElementById('queue-panel');
 if (!this.panelEl) return;
 this.panelEl.classList.add('hidden');
 document.querySelectorAll('.queue-toggle-btn').forEach(btn => btn.classList.remove('active'));
 }

  clearQueue(onlyPlayed = false) {
    if (!window.state.queue) return;
    if (onlyPlayed) {
      this.clearPlayed();
      return;
    }
    window.state.queue = [];
    window.state.currentQueueId = null;
    if (window.State?.saveQueueToConfig) window.State.saveQueueToConfig();
    this.update();
    if (window.Toast) {
      const msg = window.i18n?.t('toast_queue_cleared') || "Очередь очищена";
      window.Toast.info(msg);
    }
  }
  clearPlayed() {
    const queue = window.state.queue || [];
    if (queue.length === 0) return;
    const curQueueId = window.state.currentQueueId;
    const curTrackId = window.state.currentTrackId;

    let curIdx = -1;
    if (curQueueId) {
      curIdx = queue.findIndex(t => t.queueId === curQueueId);
    } else if (curTrackId) {
      curIdx = queue.findIndex(t => t.id === curTrackId);
    }

    const initialLen = queue.length;

    window.state.queue = queue.filter((t, idx) => {
      if (curQueueId && t.queueId === curQueueId) return true;
      if (t.played) return false;
      if (curIdx !== -1 && idx < curIdx) return false;
      return true;
    });

    if (window.state.queue.length < initialLen) {
      if (window.State?.saveQueueToConfig) window.State.saveQueueToConfig();
      this.update();
      if (window.Toast) {
        const msg = window.i18n?.t('toast_played_cleared') || "Сыгранные треки очищены";
        window.Toast.info(msg);
      }
    }
  }

  saveQueueAsPlaylist() {
    const queue = window.state.queue || [];
    if (queue.length === 0) {
      if (window.Toast) window.Toast.warn(window.i18n?.t('lyrics_empty') || "Очередь пуста");
      return;
    }
    if (typeof showPrompt === 'function') {
      showPrompt('Save Queue as Playlist', 'Queue Playlist', (name) => {
        if (name && name.trim()) {
          const trackIds = queue.map(t => t.id);
          const newPl = {
            id: Date.now().toString(),
            name: name.trim(),
            tracks: trackIds,
            pinned: false
          };
          if (!window.state.playlists) window.state.playlists = [];
          window.state.playlists.push(newPl);
          window.api.db.savePlaylists(window.state.playlists);
          if (window.Playlists) window.Playlists.render();
          if (window.Toast) window.Toast.success(`Плейлист "${newPl.name}" сохранен`);
        }
      });
    }
  }
  removeTrack(index) {
    const queue = window.state.queue || [];
    if (index < 0 || index >= queue.length) return;
    const targetTrack = queue[index];
    if (!targetTrack) return;
    const targetQueueId = targetTrack.queueId;
    
    const domItem = this.contentEl?.querySelector(`.queue-item[data-index="${index}"]`);
    const performRemoval = () => {
      const currentQueue = window.state.queue || [];
      const actualIdx = currentQueue.findIndex(t => t.queueId === targetQueueId);
      if (actualIdx === -1) return;

      const removed = currentQueue[actualIdx];
      const curQueueId = window.state?.currentQueueId;
      const isCurrent = Boolean(curQueueId && removed.queueId && removed.queueId === curQueueId);

      currentQueue.splice(actualIdx, 1);
      if (window.State?.saveQueueToConfig) {
        window.State.saveQueueToConfig();
      }

      if (isCurrent) {
        window.state.currentQueueId = null;
        if (window.State) {
          window.State.playNext();
        }
      } else {
        this.update();
      }
    };

    if (domItem) {
      domItem.classList.add('removing');
      setTimeout(performRemoval, 190);
    } else {
      performRemoval();
    }
  }


  update(skipCenter = false) {
    const queue = window.state.queue || [];
    const queueLength = queue.length;
    if (!this.countTagEl) this.countTagEl = document.getElementById('queue-count-tag');
    if (!this.badgeEl) this.badgeEl = document.getElementById('ui-queue-badge');
    if (!this.durationTagEl) this.durationTagEl = document.getElementById('queue-duration-tag');
    if (this.countTagEl) this.countTagEl.textContent = queueLength;
    if (this.badgeEl) this.badgeEl.classList.toggle('hidden', queueLength === 0);
    if (this.durationTagEl) {
      const curQueueId = window.state?.currentQueueId;
      let remainingQueue = [];

      if (curQueueId) {
        const curIdx = queue.findIndex(t => t.queueId === curQueueId);
        if (curIdx !== -1) {
          remainingQueue = queue.slice(curIdx).filter((t, i) => i === 0 || !t.played);
        } else {
          remainingQueue = queue.filter(t => !t.played);
        }
      } else {
        remainingQueue = queue.filter(t => !t.played);
      }

      const totalSec = remainingQueue.reduce((acc, t) => acc + (t.duration || 0), 0);
      const formatted = window.formatTime ? window.formatTime(totalSec) : `${Math.floor(totalSec / 60)}m`;
      this.durationTagEl.textContent = formatted;
    }
    if (this.panelEl && !this.panelEl.classList.contains('hidden')) {
      this.render();
      if (!skipCenter) {
        setTimeout(() => this.centerActiveTrack(), 40);
      }
  
    }

 window.PluginRuntime?.emit(
 'queue.changed',
 {
 count:
 queueLength
 }
 );

  }


  centerActiveTrack() {
    if (!this.contentEl) return;
    const curQueueId = window.state?.currentQueueId;
    const curTrackId = window.state?.currentTrackId;
    const queue = window.state.queue || [];
    let curIdx = -1;
    if (curQueueId) {
      curIdx = queue.findIndex(t => t.queueId === curQueueId);
    }
    if (curIdx === -1 && curTrackId) {
      curIdx = queue.findIndex(t => t.id === curTrackId);
    }
    if (curIdx !== -1) {
      const containerHeight = this.contentEl.clientHeight || 500;
      const targetTop = curIdx * this.itemHeight - (containerHeight / 2) + (this.itemHeight / 2);
      this.contentEl.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth'
      });
    }
  }

  render() {
    if (!this.contentEl) this.contentEl = document.getElementById('queue-content');
    if (!this.contentEl) return;
    const queue = window.state.queue || [];
 if (queue.length === 0) {
 this.contentEl.innerHTML = `
 <div class="queue-placeholder">
 <div class="queue-empty-circle">
 <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
 <line x1="8" y1="6" x2="21" y2="6"></line>
 <line x1="8" y1="12" x2="21" y2="12"></line>
 <line x1="8" y1="18" x2="16" y2="18"></line>
 <line x1="3" y1="6" x2="3.01" y2="6"></line>
 <line x1="3" y1="12" x2="3.01" y2="12"></line>
 <line x1="3" y1="18" x2="3.01" y2="18"></line>
 </svg>
 </div>
          <div class="queue-empty-title" data-i18n="queue_empty_title">${window.i18n?.t('queue_empty_title') || 'Очередь пуста'}</div>
          <div class="queue-empty-desc" data-i18n="queue_empty_desc">${window.i18n?.t('queue_empty_desc') || 'Кликни по треку чтобы добавить, двойной клик — играть сразу'}</div>
 </div>
 `;
 return;
 }
    let spacer = this.contentEl.querySelector('.queue-vs-spacer');
    if (!spacer) {
      spacer = document.createElement('div');
      spacer.className = 'queue-vs-spacer';
      spacer.style.width = '100%';
      spacer.style.pointerEvents = 'none';
      this.contentEl.appendChild(spacer);
    }
    spacer.style.height = `${queue.length * this.itemHeight}px`;

    const scrollTop = this.contentEl.scrollTop;
    const clientHeight = this.contentEl.clientHeight || 500;
    let start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
    let end = Math.min(queue.length - 1, Math.floor((scrollTop + clientHeight) / this.itemHeight) + this.buffer);

    Array.from(this.contentEl.children).forEach(child => {
      if (!child.classList.contains('queue-vs-spacer')) {
        this.contentEl.removeChild(child);
      }
    });

    const fragment = document.createDocumentFragment();
    const currentTrackId = window.state?.currentTrackId;
    const currentQueueId = window.state?.currentQueueId;
    const isPlaying = window.AudioEngine?.isPlaying;
    const keepPlayed = window.state?.config?.queueKeepPlayed || false;

    let curTrackIdx = -1;
    if (currentQueueId) {
      curTrackIdx = queue.findIndex(t => t.queueId === currentQueueId);
    }
    if (curTrackIdx === -1 && currentTrackId) {
      curTrackIdx = queue.findIndex(t => t.id === currentTrackId);
    }

    for (let i = start; i <= end; i++) {
      const track = queue[i];
      if (!track) continue;

      const item = document.createElement('div');
      item.dataset.index = i;
      item.dataset.queueId = track.queueId || '';
      item.setAttribute('draggable', 'true');
      item.style.position = 'absolute';
      item.style.top = `${i * this.itemHeight}px`;
      item.style.left = '4px';
      item.style.right = '4px';
      item.style.height = `${this.itemHeight - 6}px`;

      const isCurrent = Boolean(currentQueueId && track.queueId && track.queueId === currentQueueId);
      const isPlayed = keepPlayed && (track.played || (curTrackIdx !== -1 && i < curTrackIdx)) && !isCurrent;

      item.className = `queue-item ${isCurrent ? (isPlaying ? 'playing' : 'active') : ''} ${isPlayed ? 'played' : ''}`;

      const coverUrl = track.coverPath ? `media://${encodeURIComponent(track.coverPath)}` : '';
      const cover = document.createElement('div');
      cover.className = 'queue-item-cover';
      if (coverUrl) {
        cover.style.backgroundImage = `url("${coverUrl}")`;
      } else {
        cover.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
      }

      const info = document.createElement('div');
      info.className = 'queue-item-info';

      const title = document.createElement('div');
      title.className = 'queue-item-title';
      title.textContent = track.title || 'Unknown Title';

      const artistAlbum = document.createElement('div');
      artistAlbum.className = 'queue-item-artist-album';
      const albumStr = track.album && track.album !== 'Unknown Album' ? ` • ${track.album}` : '';
      artistAlbum.textContent = `${track.artist || 'Unknown Artist'}${albumStr}`;

      info.appendChild(title);
      info.appendChild(artistAlbum);
      item.appendChild(cover);
      item.appendChild(info);

      item.addEventListener('click', () => {
        if (window.State) {
          window.State.playTrack(track, true, 'queue', window.state.queue);
        }
        this.update();
      });

      item.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        this.draggedQueueId = track.queueId;
        e.dataTransfer.setData('text/queue-id', track.queueId);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => item.classList.add('is-dragging'), 0);
      });

      item.addEventListener('dragover', (e) => {
        if (!this.draggedQueueId || this.draggedQueueId === track.queueId) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        const rect = item.getBoundingClientRect();
        const isAbove = (e.clientY - rect.top) < (rect.height / 2);
        this.contentEl.querySelectorAll('.queue-item').forEach(el => {
          if (el !== item) el.classList.remove('drop-above', 'drop-below');
        });
        item.classList.toggle('drop-above', isAbove);
        item.classList.toggle('drop-below', !isAbove);
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drop-above', 'drop-below');
      });

      item.addEventListener('drop', (e) => {
        if (!this.draggedQueueId || this.draggedQueueId === track.queueId) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = item.getBoundingClientRect();
        const isAbove = (e.clientY - rect.top) < (rect.height / 2);
        const sourceIdx = queue.findIndex(t => t.queueId === this.draggedQueueId);
        let targetIdx = queue.findIndex(t => t.queueId === track.queueId);
        if (sourceIdx !== -1 && targetIdx !== -1) {
          if (!isAbove) targetIdx++;
          if (sourceIdx < targetIdx) targetIdx--;
          const movedTrack = queue.splice(sourceIdx, 1)[0];
          queue.splice(targetIdx, 0, movedTrack);
          if (window.State?.saveQueueToConfig) window.State.saveQueueToConfig();
        }
        this._clearDragStyles();
        this.update(true);
      });

      item.addEventListener('dragend', () => this._clearDragStyles());

      if (isCurrent && isPlaying) {
        const eqBars = document.createElement('div');
        eqBars.className = 'queue-playing-bars';
        eqBars.innerHTML = `<span class="bar bar1"></span><span class="bar bar2"></span><span class="bar bar3"></span>`;
        item.appendChild(eqBars);
      }

      const removeBtn = document.createElement('button');
      removeBtn.className = 'queue-item-remove';
      removeBtn.title = 'Удалить из очереди';
      removeBtn.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTrack(i);
      });

      item.appendChild(removeBtn);
      fragment.appendChild(item);
    }
    this.contentEl.appendChild(fragment);
  }

  _clearDragStyles() {
    this.draggedQueueId = null;
    if (!this.contentEl) return;
    this.contentEl.querySelectorAll('.queue-item').forEach(item => {
      item.classList.remove('is-dragging', 'drop-above', 'drop-below');
    });
  }

}

window.QueuePanel = new QueuePanelManager();