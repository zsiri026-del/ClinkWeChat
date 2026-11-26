'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const SVG_PATH = path.join(ROOT, 'assets', 'icon-master.svg');
const OUT_PNG = path.join(ROOT, 'assets', 'icon-v2.png');
const OUT_ICO = path.join(ROOT, 'assets', 'icon-v2.ico');
const SIZES = [256, 128, 64, 48, 32, 16];

function buildMultiIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(entries.length * 16);
  let offset = header.length + dir.length;
  entries.forEach(({ size, png }, idx) => {
    const base = idx * 16;
    dir[base] = size >= 256 ? 0 : size;
    dir[base + 1] = size >= 256 ? 0 : size;
    dir[base + 2] = 0;
    dir[base + 3] = 0;
    dir.writeUInt16LE(1, base + 4);
    dir.writeUInt16LE(32, base + 6);
    dir.writeUInt32LE(png.length, base + 8);
    dir.writeUInt32LE(offset, base + 12);
    offset += png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  try {
    const svg = fs.readFileSync(SVG_PATH, 'utf8');
    const html = `<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden;">${svg}</body></html>`;

    const win = new BrowserWindow({
      width: 512,
      height: 512,
      show: false,
      frame: false,
      transparent: true,
      webPreferences: { offscreen: true, contextIsolation: true },
    });

    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await new Promise((r) => setTimeout(r, 200));

    const master = await win.webContents.capturePage();
    const entries = SIZES.map((size) => ({
      size,
      png: master.resize({ width: size, height: size, quality: 'best' }).toPNG(),
    }));

    fs.writeFileSync(OUT_PNG, entries[0].png);
    fs.writeFileSync(OUT_ICO, buildMultiIco(entries));
    win.destroy();
    console.log('Generated icon-v2.png and 6-size icon-v2.ico successfully.');
    app.exit(0);
  } catch (err) {
    console.error(err);
    app.exit(1);
  }
});
