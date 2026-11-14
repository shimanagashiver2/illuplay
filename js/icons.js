const SVG_NS = 'http://www.w3.org/2000/svg';

// Custom SVG paths in 24x24 viewBox (shared identically between DOM SVG and Canvas Path2D)
export const ICONS = {
  play: {
    fills: ['M8.5 5v14l11-7z'],
    strokes: []
  },
  pause: {
    fills: ['M6.5 5h4v14h-4z', 'M13.5 5h4v14h-4z'],
    strokes: []
  },
  volume: {
    fills: ['M3.5 9.25v5.5h3.75L12 19.25V4.75L7.25 9.25H3.5z'],
    strokes: [
      { d: 'M15.2 8.8a4.5 4.5 0 0 1 0 6.4', width: 1.9, cap: 'round', join: 'round' },
      { d: 'M17.8 6.2a8.2 8.2 0 0 1 0 11.6', width: 1.9, cap: 'round', join: 'round' }
    ]
  },
  fullscreen: {
    fills: [
      'M4 9.5V4h5.5v2H6v3.5H4z',
      'M14.5 4H20v5.5h-2V6h-3.5V4z',
      'M18 14.5h2V20h-5.5v-2H18v-3.5z',
      'M4 14.5h2V18h3.5v2H4v-5.5z'
    ],
    strokes: []
  }
};

export function populateSvg(svgEl, iconDef) {
  while (svgEl.firstChild) {
    svgEl.removeChild(svgEl.firstChild);
  }
  for (const d of iconDef.fills) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'currentColor');
    svgEl.appendChild(p);
  }
  for (const s of iconDef.strokes) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', s.d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', String(s.width));
    p.setAttribute('stroke-linecap', s.cap);
    p.setAttribute('stroke-linejoin', s.join);
    svgEl.appendChild(p);
  }
}

export function drawIconOnCanvas(ctx, iconDef, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';

  for (const d of iconDef.fills) {
    ctx.fill(new Path2D(d));
  }
  for (const s of iconDef.strokes) {
    ctx.lineWidth = s.width;
    ctx.lineCap = s.cap;
    ctx.lineJoin = s.join;
    ctx.stroke(new Path2D(s.d));
  }
  ctx.restore();
}
