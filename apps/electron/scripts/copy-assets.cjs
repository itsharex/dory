const fs = require('node:fs');
const path = require('node:path');

const assets = [
  {
    src: path.join(__dirname, '../main/splash.html'),
    dest: path.join(__dirname, '../dist-electron/main/splash.html'),
  },
];

for (const asset of assets) {
  fs.mkdirSync(path.dirname(asset.dest), { recursive: true });
  fs.copyFileSync(asset.src, asset.dest);
}
