import { ICONS, drawIconOnCanvas } from './icons.js';

export function computeLayout(W, H) {
  const base = Math.min(W, H * 1.4);
  const S = base / 1000;

  return {
    gradHeight: Math.min(H, 145 * S),
    padX: 22 * S,
    padBottom: 13 * S,
    trackH: Math.max(1.5, 4.5 * S),
    thumbR: 7 * S,
    seekGap: 12 * S,
    barH: 38 * S,
    iconSize: 26 * S,
    iconGap: 17 * S,
    timeGap: 16 * S,
    fontSize: 15 * S,
    centerSize: 76 * S,
    centerIconSize: 34 * S
  };
}

function drawPlayerOverlay(ctx, W, H, options) {
  const { progress, isPlaying, showCenterIcon, accentColor, timeLabel } = options;
  const L = computeLayout(W, H);

  // 1. Bottom gradient background
  const gradTop = H - L.gradHeight;
  const grad = ctx.createLinearGradient(0, gradTop, 0, H);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.38)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.82)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, gradTop, W, L.gradHeight);

  // 2. Center Play/Pause Icon
  if (showCenterIcon) {
    const cx = W / 2;
    const cy = H / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, L.centerSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
    ctx.fill();
    ctx.restore();

    const centerIcon = isPlaying ? ICONS.pause : ICONS.play;
    drawIconOnCanvas(
      ctx,
      centerIcon,
      cx - L.centerIconSize / 2,
      cy - L.centerIconSize / 2,
      L.centerIconSize
    );
  }

  // 3. Seekbar
  const trackX = L.padX;
  const trackW = Math.max(0, W - L.padX * 2);
  const seekBottom = H - L.padBottom - L.barH - L.seekGap;
  const seekTop = seekBottom - L.trackH;
  const seekCenterY = seekTop + L.trackH / 2;
  const progressW = trackW * (progress / 100);

  // Gray track
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(trackX, seekTop, trackW, L.trackH);

  // Accent progress
  ctx.fillStyle = accentColor;
  ctx.fillRect(trackX, seekTop, progressW, L.trackH);

  // Accent circular thumb
  ctx.beginPath();
  ctx.arc(trackX + progressW, seekCenterY, L.thumbR, 0, Math.PI * 2);
  ctx.fillStyle = accentColor;
  ctx.fill();

  // 4. Bottom control row
  const rowCenterY = H - L.padBottom - L.barH / 2;
  const iconTopY = rowCenterY - L.iconSize / 2;
  let curX = L.padX;

  drawIconOnCanvas(ctx, isPlaying ? ICONS.pause : ICONS.play, curX, iconTopY, L.iconSize);
  curX += L.iconSize + L.iconGap;

  drawIconOnCanvas(ctx, ICONS.volume, curX, iconTopY, L.iconSize);
  curX += L.iconSize + L.timeGap;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.font = '500 ' + L.fontSize + 'px "Roboto", system-ui, -apple-system, "Segoe UI", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(timeLabel, curX, rowCenterY);
  ctx.restore();

  drawIconOnCanvas(ctx, ICONS.fullscreen, W - L.padX - L.iconSize, iconTopY, L.iconSize);
}

/**
 * Render the image and player overlay into a PNG Blob.
 * Optimizes Canvas memory by avoiding an offscreen canvas at 100% opacity
 * and releasing intermediate canvas buffers before toBlob().
 */
export function exportCompositePng(image, naturalWidth, naturalHeight, options) {
  const { opacity, scale = 1 } = options;
  const W = Math.max(1, Math.round(naturalWidth * scale));
  const H = Math.max(1, Math.round(naturalHeight * scale));

  return new Promise((resolve, reject) => {
    const mainCanvas = document.createElement('canvas');
    mainCanvas.width = W;
    mainCanvas.height = H;
    const mainCtx = mainCanvas.getContext('2d');
    if (!mainCtx) {
      reject(new Error('Canvasの初期化に失敗しました。'));
      return;
    }

    mainCtx.drawImage(image, 0, 0, W, H);

    const uiAlpha = Math.min(1, Math.max(0, opacity / 100));
    if (uiAlpha === 1) {
      drawPlayerOverlay(mainCtx, W, H, options);
    } else if (uiAlpha > 0) {
      const uiCanvas = document.createElement('canvas');
      uiCanvas.width = W;
      uiCanvas.height = H;
      const uiCtx = uiCanvas.getContext('2d');
      if (!uiCtx) {
        mainCanvas.width = 0;
        mainCanvas.height = 0;
        reject(new Error('UI合成用Canvasの初期化に失敗しました。'));
        return;
      }

      drawPlayerOverlay(uiCtx, W, H, options);

      mainCtx.save();
      mainCtx.globalAlpha = uiAlpha;
      mainCtx.drawImage(uiCanvas, 0, 0);
      mainCtx.restore();

      // Release offscreen buffer immediately to reduce peak memory on mobile browsers
      uiCanvas.width = 0;
      uiCanvas.height = 0;
    }

    try {
      mainCanvas.toBlob((blob) => {
        mainCanvas.width = 0;
        mainCanvas.height = 0;
        if (!blob) {
          reject(new Error('PNGの生成に失敗しました。画像サイズが大きすぎる可能性があります。'));
          return;
        }
        resolve({ blob, width: W, height: H });
      }, 'image/png');
    } catch (err) {
      mainCanvas.width = 0;
      mainCanvas.height = 0;
      reject(err);
    }
  });
}
