import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "public", "app-icon-source.png");

const sizes = [192, 512, 1024];

for (const size of sizes) {
  const out = path.join(__dirname, "public", `app-icon-${size}.png`);
  await sharp(src)
    .resize(size, size, { fit: "contain", background: { r: 10, g: 10, b: 10, alpha: 1 } })
    .png()
    .toFile(out);
  console.log(`Created ${out}`);
}

await sharp(src)
  .resize(512, 512, { fit: "contain", background: { r: 10, g: 10, b: 10, alpha: 1 } })
  .png()
  .toFile(path.join(__dirname, "public", "app-icon.png"));
console.log("Updated app-icon.png (512x512)");
