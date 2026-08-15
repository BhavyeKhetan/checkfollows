// Regenerates every raster logo asset from public/logo.svg (the single
// source of truth for the mark). Run after changing the bolt/circle in
// logo.svg so logo.png, icon.png, apple-icon.png, and favicon.ico stay
// pixel-identical to the SVG.
const sharp = require("sharp");
const fs = require("fs");

const svg = fs.readFileSync("public/logo.svg");

function assembleIco(pngs) {
  const count = pngs.length;
  const headerSize = 6 + 16 * count;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(count, 4); // image count

  const images = [];
  let offset = headerSize;
  pngs.forEach((p, i) => {
    const base = 6 + i * 16;
    const w = p.size >= 256 ? 0 : p.size;
    header.writeUInt8(w, base + 0); // width
    header.writeUInt8(w, base + 1); // height
    header.writeUInt8(0, base + 2); // palette count
    header.writeUInt8(0, base + 3); // reserved
    header.writeUInt16LE(1, base + 4); // planes
    header.writeUInt16LE(32, base + 6); // bits per pixel
    header.writeUInt32LE(p.buf.length, base + 8); // bytes in resource
    header.writeUInt32LE(offset, base + 12); // image offset
    images.push(p.buf);
    offset += p.buf.length;
  });

  return Buffer.concat([header, ...images]);
}

async function main() {
  await sharp(svg).resize(512, 512).png().toFile("public/logo.png");
  console.log("wrote public/logo.png (512x512)");

  await sharp(svg).resize(48, 48).png().toFile("public/icon.png");
  console.log("wrote public/icon.png (48x48)");

  await sharp(svg).resize(180, 180).png().toFile("src/app/apple-icon.png");
  console.log("wrote src/app/apple-icon.png (180x180)");

  const sizes = [16, 32, 48];
  const pngs = [];
  for (const s of sizes) {
    pngs.push({ size: s, buf: await sharp(svg).resize(s, s).png().toBuffer() });
  }
  fs.writeFileSync("public/favicon.ico", assembleIco(pngs));
  console.log("wrote public/favicon.ico (16/32/48)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
