import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
const knight = readFileSync('public/pieces/wN.svg', 'utf8').replace(
  /<\?xml[^>]*\?>/,
  '',
);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="104" fill="#375f42"/><svg x="110" y="98" width="292" height="292" viewBox="0 0 45 45">${knight.replace(/<svg[^>]*>/, '').replace('</svg>', '')}</svg><circle cx="391" cy="393" r="16" fill="#b3ca88"/></svg>`;
writeFileSync('public/favicon.svg', svg);
for (const size of [192, 512])
  writeFileSync(
    `public/icon-${size}.png`,
    new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng(),
  );
console.log('Created PWA icons.');
