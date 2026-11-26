'use strict';

const { screen } = require('electron');

function sanitizeBounds(saved) {
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return null;
  const w = Number(saved.width) || 0;
  const h = Number(saved.height) || 0;
  const visible = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    const ix = Math.min(saved.x + w, a.x + a.width) - Math.max(saved.x, a.x);
    const iy = Math.min(saved.y + h, a.y + a.height) - Math.max(saved.y, a.y);
    return ix > 80 && iy > 60;
  });
  return visible ? { x: saved.x, y: saved.y, width: w, height: h } : null;
}

module.exports = { sanitizeBounds };
