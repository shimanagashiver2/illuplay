import { ICONS, populateSvg } from './icons.js';
import { computeLayout, exportCompositePng } from './renderer.js';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_EXT_RE = /\.(png|jpe?g|webp)$/i;

const state = {
  image: null,
  objectUrl: null,
  exportUrl: null,
  exportFile: null,
  fileName: '',
  naturalWidth: 0,
  naturalHeight: 0,
  progress: 35,
  minutes: 3,
  seconds: 45,
  isPlaying: false, // false => paused state (▶ icon), true => playing state (❚❚ icon)
  showCenterIcon: true,
  opacity: 100,
  accentColor: '#3b82f6'
};

// DOM elements
const fileInput = document.getElementById('fileInput');
const stageContainer = document.getElementById('stageContainer');
const dropzone = document.getElementById('dropzone');
const previewFrame = document.getElementById('previewFrame');
const previewImg = document.getElementById('previewImg');
const previewHint = document.getElementById('previewHint');

const fileNameLabel = document.getElementById('fileNameLabel');
const fileDimLabel = document.getElementById('fileDimLabel');
const changeImgBtn = document.getElementById('changeImgBtn');
const clearImgBtn = document.getElementById('clearImgBtn');

const playerOverlay = document.getElementById('playerOverlay');
const overlayGradient = document.getElementById('overlayGradient');
const overlayCenterBtn = document.getElementById('overlayCenterBtn');
const overlayCenterSvg = document.getElementById('overlayCenterSvg');
const overlayBottom = document.getElementById('overlayBottom');
const overlaySeekbar = document.getElementById('overlaySeekbar');
const overlaySeekProgress = document.getElementById('overlaySeekProgress');
const overlaySeekThumb = document.getElementById('overlaySeekThumb');
const overlayControlsRow = document.getElementById('overlayControlsRow');
const overlayPlayBtn = document.getElementById('overlayPlayBtn');
const overlayPlaySvg = document.getElementById('overlayPlaySvg');
const overlayVolumeWrap = document.getElementById('overlayVolumeWrap');
const overlayVolumeSvg = document.getElementById('overlayVolumeSvg');
const overlayTimeText = document.getElementById('overlayTimeText');
const overlayFullscreenWrap = document.getElementById('overlayFullscreenWrap');
const overlayFullscreenSvg = document.getElementById('overlayFullscreenSvg');

const progressSlider = document.getElementById('progressSlider');
const progressValue = document.getElementById('progressValue');
const minutesInput = document.getElementById('minutesInput');
const secondsInput = document.getElementById('secondsInput');
const calculatedTimeValue = document.getElementById('calculatedTimeValue');
const statePausedBtn = document.getElementById('statePausedBtn');
const statePlayingBtn = document.getElementById('statePlayingBtn');
const centerIconToggle = document.getElementById('centerIconToggle');
const colorSwatches = Array.from(document.querySelectorAll('.color-swatch[data-color]'));
const accentColorPicker = document.getElementById('accentColorPicker');
const accentColorValue = document.getElementById('accentColorValue');
const opacitySlider = document.getElementById('opacitySlider');
const opacityValue = document.getElementById('opacityValue');

const exportBtn = document.getElementById('exportBtn');
const exportMeta = document.getElementById('exportMeta');
const statusMsg = document.getElementById('statusMsg');
const retryHalfBtn = document.getElementById('retryHalfBtn');
const exportResult = document.getElementById('exportResult');
const exportResultImg = document.getElementById('exportResultImg');
const exportOpenLink = document.getElementById('exportOpenLink');
const exportShareBtn = document.getElementById('exportShareBtn');

function formatTime(totalSec) {
  const safe = Math.max(0, Math.round(totalSec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function getTimes() {
  const totalSec = state.minutes * 60 + state.seconds;
  const currentSec = Math.round(totalSec * (state.progress / 100));
  return {
    totalSec,
    currentSec,
    currentStr: formatTime(currentSec),
    totalStr: formatTime(totalSec),
    label: formatTime(currentSec) + ' / ' + formatTime(totalSec)
  };
}

function showStatus(text, type) {
  statusMsg.textContent = text;
  statusMsg.className = 'status-msg ' + (type === 'error' ? 'is-error' : 'is-success');
  statusMsg.hidden = false;
}

function clearStatus() {
  statusMsg.hidden = true;
  statusMsg.textContent = '';
}

function clearExportResult() {
  if (state.exportUrl) {
    URL.revokeObjectURL(state.exportUrl);
    state.exportUrl = null;
  }
  state.exportFile = null;
  exportResult.hidden = true;
  exportResultImg.removeAttribute('src');
  exportOpenLink.removeAttribute('href');
  exportShareBtn.hidden = true;
  retryHalfBtn.hidden = true;
}

function syncAccentColorControls() {
  const normalized = state.accentColor.toLowerCase();
  accentColorValue.textContent = normalized.toUpperCase();
  accentColorPicker.value = normalized;
  for (const btn of colorSwatches) {
    const swatchColor = (btn.dataset.color || '').toLowerCase();
    btn.classList.toggle('is-active', swatchColor === normalized);
  }
}

function renderAll() {
  const times = getTimes();

  // Controls readout
  const pctStr = state.progress.toFixed(1).replace(/\.0$/, '') + '%';
  progressValue.textContent = pctStr;
  progressSlider.value = String(state.progress);
  calculatedTimeValue.textContent = '現在 ' + times.label;
  opacityValue.textContent = state.opacity + '%';
  opacitySlider.value = String(state.opacity);

  statePausedBtn.classList.toggle('is-active', !state.isPlaying);
  statePlayingBtn.classList.toggle('is-active', state.isPlaying);
  centerIconToggle.checked = state.showCenterIcon;
  syncAccentColorControls();

  // Preview overlay values
  const activeIcon = state.isPlaying ? ICONS.pause : ICONS.play;
  populateSvg(overlayPlaySvg, activeIcon);
  populateSvg(overlayCenterSvg, activeIcon);

  overlayCenterBtn.hidden = !state.showCenterIcon;
  overlaySeekProgress.style.width = state.progress + '%';
  overlaySeekProgress.style.backgroundColor = state.accentColor;
  overlaySeekThumb.style.left = state.progress + '%';
  overlaySeekThumb.style.backgroundColor = state.accentColor;
  overlaySeekbar.setAttribute('aria-valuenow', String(state.progress));
  overlayTimeText.textContent = times.label;
  playerOverlay.style.opacity = String(state.opacity / 100);

  syncPreviewScale();
}

function syncPreviewScale() {
  if (!state.image || previewFrame.hidden) return;
  const dispW = previewImg.clientWidth;
  const dispH = previewImg.clientHeight;
  if (!dispW || !dispH) return;

  const L = computeLayout(state.naturalWidth, state.naturalHeight);
  const ratio = dispW / state.naturalWidth;

  overlayGradient.style.height = (L.gradHeight * ratio) + 'px';

  overlayBottom.style.paddingLeft = (L.padX * ratio) + 'px';
  overlayBottom.style.paddingRight = (L.padX * ratio) + 'px';
  overlayBottom.style.paddingBottom = (L.padBottom * ratio) + 'px';

  overlaySeekbar.style.height = Math.max(1.5, L.trackH * ratio) + 'px';
  overlaySeekbar.style.marginBottom = (L.seekGap * ratio) + 'px';

  const thumbDia = Math.max(4, L.thumbR * 2 * ratio) + 'px';
  overlaySeekThumb.style.width = thumbDia;
  overlaySeekThumb.style.height = thumbDia;

  overlayControlsRow.style.height = (L.barH * ratio) + 'px';

  const iconPx = (L.iconSize * ratio) + 'px';
  overlayPlayBtn.style.width = iconPx;
  overlayPlayBtn.style.height = iconPx;
  overlayPlayBtn.style.marginRight = (L.iconGap * ratio) + 'px';
  overlayPlaySvg.style.width = iconPx;
  overlayPlaySvg.style.height = iconPx;

  overlayVolumeWrap.style.width = iconPx;
  overlayVolumeWrap.style.height = iconPx;
  overlayVolumeWrap.style.marginRight = (L.timeGap * ratio) + 'px';
  overlayVolumeSvg.style.width = iconPx;
  overlayVolumeSvg.style.height = iconPx;

  overlayTimeText.style.fontSize = Math.max(7, L.fontSize * ratio) + 'px';

  overlayFullscreenWrap.style.width = iconPx;
  overlayFullscreenWrap.style.height = iconPx;
  overlayFullscreenSvg.style.width = iconPx;
  overlayFullscreenSvg.style.height = iconPx;

  const centerPx = (L.centerSize * ratio) + 'px';
  const centerIconPx = (L.centerIconSize * ratio) + 'px';
  overlayCenterBtn.style.width = centerPx;
  overlayCenterBtn.style.height = centerPx;
  overlayCenterSvg.style.width = centerIconPx;
  overlayCenterSvg.style.height = centerIconPx;
}

function handleFile(file) {
  if (!file) return;
  clearStatus();
  clearExportResult();

  const isValidType = ALLOWED_MIME.has(file.type) || (!file.type && ALLOWED_EXT_RE.test(file.name));
  if (!isValidType) {
    showStatus('PNG・JPEG・WebP形式の画像ファイルを選択してください。', 'error');
    return;
  }

  const nextUrl = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
    }
    state.image = img;
    state.objectUrl = nextUrl;
    state.fileName = file.name || 'image';
    state.naturalWidth = img.naturalWidth;
    state.naturalHeight = img.naturalHeight;

    previewImg.src = nextUrl;
    stageContainer.classList.add('has-image');
    dropzone.hidden = true;
    previewFrame.hidden = false;
    previewHint.hidden = false;
    changeImgBtn.hidden = false;
    clearImgBtn.hidden = false;

    fileNameLabel.textContent = state.fileName;
    fileDimLabel.textContent = state.naturalWidth + ' × ' + state.naturalHeight + ' px';
    fileDimLabel.hidden = false;

    exportBtn.disabled = false;
    exportMeta.textContent = '出力サイズ: ' + state.naturalWidth + ' × ' + state.naturalHeight + ' px（PNG）';

    requestAnimationFrame(renderAll);
  };

  img.onerror = () => {
    URL.revokeObjectURL(nextUrl);
    showStatus('画像の読み込みに失敗しました。別の画像でお試しください。', 'error');
  };

  img.src = nextUrl;
}

function clearImage() {
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
  }
  state.image = null;
  state.objectUrl = null;
  state.fileName = '';
  state.naturalWidth = 0;
  state.naturalHeight = 0;

  previewImg.removeAttribute('src');
  stageContainer.classList.remove('has-image');
  previewFrame.hidden = true;
  previewHint.hidden = true;
  dropzone.hidden = false;
  changeImgBtn.hidden = true;
  clearImgBtn.hidden = true;

  fileNameLabel.textContent = '画像が未選択です';
  fileDimLabel.hidden = true;
  exportBtn.disabled = true;
  exportMeta.textContent = '画像をアップロードすると書き出しできます';
  fileInput.value = '';
  clearStatus();
  clearExportResult();
}

function canShareFile(file) {
  return typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] });
}

async function runExport(scale = 1) {
  if (!state.image) return;
  clearStatus();
  clearExportResult();

  exportBtn.disabled = true;
  const times = getTimes();

  try {
    const { blob, width, height } = await exportCompositePng(
      state.image,
      state.naturalWidth,
      state.naturalHeight,
      {
        progress: state.progress,
        isPlaying: state.isPlaying,
        showCenterIcon: state.showCenterIcon,
        opacity: state.opacity,
        accentColor: state.accentColor,
        timeLabel: times.label,
        scale
      }
    );

    const baseName = state.fileName.replace(/\.[^.]+$/, '') || 'illustration';
    const outFileName = baseName + '_player.png';
    const downloadUrl = URL.createObjectURL(blob);

    state.exportUrl = downloadUrl;
    if (typeof File === 'function') {
      state.exportFile = new File([blob], outFileName, { type: 'image/png' });
    }

    // Trigger standard file download
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = outFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Populate in-app browser / mobile fallback preview
    exportResultImg.src = downloadUrl;
    exportOpenLink.href = downloadUrl;
    exportShareBtn.hidden = !(state.exportFile && canShareFile(state.exportFile));
    exportResult.hidden = false;

    showStatus('PNG画像を書き出しました（' + width + ' × ' + height + ' px）', 'success');
  } catch (err) {
    if (scale === 1 && state.naturalWidth * state.naturalHeight > 4000000) {
      showStatus('高解像度のためブラウザのメモリ上限に達しました。下の「50%サイズで再試行」をお試しください。', 'error');
      retryHalfBtn.hidden = false;
    } else {
      showStatus(err && err.message ? err.message : 'PNG書き出し中にエラーが発生しました。', 'error');
    }
  } finally {
    exportBtn.disabled = !state.image;
  }
}

// Initialize static SVG icons
populateSvg(overlayVolumeSvg, ICONS.volume);
populateSvg(overlayFullscreenSvg, ICONS.fullscreen);

// Event bindings: File Upload
dropzone.addEventListener('click', () => {
  fileInput.click();
});

dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

changeImgBtn.addEventListener('click', () => {
  fileInput.click();
});

clearImgBtn.addEventListener('click', clearImage);

fileInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) handleFile(file);
});

// Drag and drop on entire stage
let dragDepth = 0;
stageContainer.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  stageContainer.classList.add('is-dragover');
});

stageContainer.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy';
  }
});

stageContainer.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    stageContainer.classList.remove('is-dragover');
  }
});

stageContainer.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  stageContainer.classList.remove('is-dragover');
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// Controls bindings
progressSlider.addEventListener('input', () => {
  state.progress = Math.min(100, Math.max(0, parseFloat(progressSlider.value) || 0));
  renderAll();
});

function updateDurationFromInputs(clampStrict) {
  let m = parseInt(minutesInput.value, 10);
  let s = parseInt(secondsInput.value, 10);
  if (Number.isNaN(m) || m < 0) m = 0;
  if (m > 999) m = 999;
  if (Number.isNaN(s) || s < 0) s = 0;
  if (s > 59) s = 59;

  state.minutes = m;
  state.seconds = s;

  if (clampStrict) {
    minutesInput.value = String(m);
    secondsInput.value = String(s);
  }
  renderAll();
}

minutesInput.addEventListener('input', () => updateDurationFromInputs(false));
minutesInput.addEventListener('blur', () => updateDurationFromInputs(true));
secondsInput.addEventListener('input', () => updateDurationFromInputs(false));
secondsInput.addEventListener('blur', () => updateDurationFromInputs(true));

statePausedBtn.addEventListener('click', () => {
  state.isPlaying = false;
  renderAll();
});

statePlayingBtn.addEventListener('click', () => {
  state.isPlaying = true;
  renderAll();
});

overlayPlayBtn.addEventListener('click', () => {
  state.isPlaying = !state.isPlaying;
  renderAll();
});

overlayCenterBtn.addEventListener('click', () => {
  state.isPlaying = !state.isPlaying;
  renderAll();
});

centerIconToggle.addEventListener('change', () => {
  state.showCenterIcon = centerIconToggle.checked;
  renderAll();
});

for (const btn of colorSwatches) {
  btn.addEventListener('click', () => {
    if (btn.dataset.color) {
      state.accentColor = btn.dataset.color;
      renderAll();
    }
  });
}

accentColorPicker.addEventListener('input', () => {
  state.accentColor = accentColorPicker.value;
  renderAll();
});

opacitySlider.addEventListener('input', () => {
  state.opacity = Math.min(100, Math.max(0, parseInt(opacitySlider.value, 10) || 0));
  renderAll();
});

// Interactive seekbar scrubbing on preview
function seekFromPointer(clientX) {
  const rect = overlaySeekbar.getBoundingClientRect();
  if (!rect.width) return;
  const pct = ((clientX - rect.left) / rect.width) * 100;
  const clamped = Math.min(100, Math.max(0, Math.round(pct * 2) / 2));
  state.progress = clamped;
  renderAll();
}

let isSeeking = false;
overlaySeekbar.addEventListener('pointerdown', (e) => {
  isSeeking = true;
  overlaySeekbar.setPointerCapture(e.pointerId);
  seekFromPointer(e.clientX);
});
overlaySeekbar.addEventListener('pointermove', (e) => {
  if (!isSeeking) return;
  seekFromPointer(e.clientX);
});
overlaySeekbar.addEventListener('pointerup', (e) => {
  if (!isSeeking) return;
  isSeeking = false;
  if (overlaySeekbar.hasPointerCapture(e.pointerId)) {
    overlaySeekbar.releasePointerCapture(e.pointerId);
  }
});
overlaySeekbar.addEventListener('pointercancel', () => {
  isSeeking = false;
});

exportBtn.addEventListener('click', () => runExport(1));
retryHalfBtn.addEventListener('click', () => runExport(0.5));

exportShareBtn.addEventListener('click', async () => {
  if (!state.exportFile || !canShareFile(state.exportFile)) return;
  try {
    await navigator.share({
      files: [state.exportFile],
      title: state.exportFile.name
    });
  } catch (err) {
    if (err && err.name !== 'AbortError') {
      showStatus('共有シートを開けませんでした。上の画像を長押しして保存してください。', 'error');
    }
  }
});

// Keep preview overlay scaled cleanly on window or image resize
if (typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(() => {
    syncPreviewScale();
  });
  ro.observe(previewImg);
}
window.addEventListener('resize', syncPreviewScale);

// Initial render
renderAll();
