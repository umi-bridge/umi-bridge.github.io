(() => {
  'use strict';
  const assetVideo = name => `assets/videos/${name}.mp4`;
  const assetPoster = name => `assets/images/${name}.jpg`;
  const tasks = {
    transfer: {
      cup: { title: 'cup placement', note: 'Selected execution with a paper cup absent from our training demonstrations. Demonstration and execution were recorded separately.' },
      gum: { title: 'snack placement with gum', note: 'Selected snack-placement example with gum. Demonstration and execution were recorded separately.' },
      candy: { title: 'snack placement with a candy box', note: 'Selected snack-placement example with a candy box. Demonstration and execution were recorded separately.' }
    },
    performance: {
      folding: { title: 'Shirt Folding', rates: { naive: 60, dynamics: 20, ours: 85 } },
      wiping: { title: 'Stain Wiping', rates: { naive: 75, dynamics: 60, ours: 90 } },
      sorting: { title: 'Produce Sorting', rates: { naive: 85, dynamics: 80, ours: 100 } }
    }
  };
  let videoMetadata = {};
  const speedBadge = video => {
    const badge = video.parentElement.querySelector('.speed-badge');
    if (!badge) return;
    const filename = (video.getAttribute('src') || '').split('/').pop();
    const item = videoMetadata[filename] || videoMetadata[filename?.replace('.mp4', '')];
    if (!item) return;
    const segments = item.speedLabels || item.segments || [];
    const segment = segments.find(part => video.currentTime >= part.start && video.currentTime < part.end) || (video.ended ? segments.at(-1) : null);
    badge.textContent = segment?.label || item.label || (item.baseSpeed ? `${item.baseSpeed}×` : 'Variable speed');
  };
  fetch('assets/video-metadata.json').then(response => response.ok ? response.json() : {}).then(data => {
    videoMetadata = data.videos || data;
    document.querySelectorAll('.video-frame video').forEach(speedBadge);
  }).catch(() => {});

  document.querySelectorAll('[role="tablist"]').forEach(list => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const selectTab = tab => {
      if (tab.getAttribute('aria-selected') === 'true') return;
      const experiment = tab.closest('[data-experiment]');
      const type = experiment.dataset.experiment;
      const key = tab.dataset.key;
      const task = tasks[type][key];
      tabs.forEach(button => {
        const selected = button === tab;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
      experiment.querySelector('[role="tabpanel"]').setAttribute('aria-labelledby', tab.id);
      experiment.querySelectorAll('video[data-slot]').forEach(video => {
        video.pause();
        const name = `${type}-${key}-${video.dataset.slot}`;
        video.src = assetVideo(name);
        video.poster = assetPoster(name);
        video.setAttribute('aria-label', `${video.dataset.slot === 'umi' ? 'UMI demonstration' : video.dataset.slot === 'ours' ? 'UMI-Bridge execution' : video.dataset.slot === 'naive' ? 'Naive Co-training' : 'Dynamics-Only LAM'} · ${task.title}`);
        video.load();
        speedBadge(video);
      });
      if (task.note) document.getElementById('transfer-note').textContent = task.note;
      if (task.rates) Object.entries(task.rates).forEach(([name, rate]) => { experiment.querySelector(`[data-rate="${name}"]`).textContent = `${rate}%`; });
      resetGroupButton(experiment);
    };
    tabs.forEach(tab => {
      tab.addEventListener('click', () => selectTab(tab));
      tab.addEventListener('keydown', event => {
        const index = tabs.indexOf(tab);
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        tabs[next].focus();
        selectTab(tabs[next]);
      });
    });
  });

  function resetGroupButton(experiment) {
    const button = experiment.querySelector('[data-play-group]');
    const videos = [...experiment.querySelectorAll('video')];
    const playing = videos.some(video => !video.paused && !video.ended);
    const started = videos.some(video => video.currentTime > 0);
    button.innerHTML = playing ? '<span aria-hidden="true">Ⅱ</span> Pause all' : `<span aria-hidden="true">${started ? '↻' : '▶'}</span> ${started ? 'Replay' : 'Play'} ${videos.length === 2 ? 'both' : 'all'}`;
  }
  document.querySelectorAll('[data-play-group]').forEach(button => {
    button.addEventListener('click', async () => {
      const experiment = button.closest('[data-experiment]');
      const videos = [...experiment.querySelectorAll('video')];
      if (videos.some(video => !video.paused && !video.ended)) {
        videos.forEach(video => video.pause());
      } else {
        document.querySelectorAll('video').forEach(video => { if (!videos.includes(video)) video.pause(); });
        videos.forEach(video => { video.currentTime = 0; video.muted = true; });
        const results = await Promise.allSettled(videos.map(video => video.play()));
        const failed = results.some(result => result.status === 'rejected');
        experiment.querySelector('.playback-status').textContent = failed ? 'Use the individual video controls to start playback.' : 'Playing selected videos.';
      }
      resetGroupButton(experiment);
    });
  });
  document.querySelectorAll('.video-frame video').forEach(video => {
    video.addEventListener('timeupdate', () => speedBadge(video));
    ['play', 'pause', 'ended'].forEach(event => video.addEventListener(event, () => resetGroupButton(video.closest('[data-experiment]'))));
  });
  document.querySelectorAll('details').forEach(details => details.addEventListener('toggle', () => {
    if (!details.open) details.querySelectorAll('video').forEach(video => video.pause());
  }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) document.querySelectorAll('video').forEach(video => video.pause()); });

  const dialog = document.getElementById('figure-dialog');
  const dialogImage = document.getElementById('dialog-image');
  document.querySelectorAll('[data-zoom]').forEach(button => button.addEventListener('click', () => {
    dialogImage.src = button.dataset.zoom;
    dialogImage.alt = button.querySelector('img').alt;
    dialog.showModal();
  }));
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });

  document.getElementById('copy-citation').addEventListener('click', async event => {
    const button = event.currentTarget;
    const value = document.getElementById('bibtex').textContent;
    let copied = false;
    try { await navigator.clipboard.writeText(value); copied = true; }
    catch {
      const range = document.createRange();
      range.selectNodeContents(document.getElementById('bibtex'));
      const selection = window.getSelection();
      selection.removeAllRanges(); selection.addRange(range);
      try { copied = document.execCommand('copy'); } catch {}
      if (copied) selection.removeAllRanges();
    }
    button.textContent = copied ? 'Copied!' : 'Select & copy';
    document.getElementById('copy-status').textContent = copied ? 'BibTeX copied to clipboard.' : 'Citation selected. Press Control+C or Command+C to copy.';
    window.setTimeout(() => { button.textContent = 'Copy BibTeX'; }, 2500);
  });
})();
