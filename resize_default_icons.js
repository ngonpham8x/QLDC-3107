import fs from "fs";
import sharp from "sharp";

async function run() {
  const src = "public/logo_default.png";
  if (!fs.existsSync(src)) {
    console.error("Source not found:", src);
    process.exit(1);
  }

  const tasks = [
    { file: "public/logo-192.png", size: 192 },
    { file: "public/logo-512.png", size: 512 },
    { file: "public/apple-touch-icon.png", size: 180 },
    { file: "public/favicon-32x32.png", size: 32 },
    { file: "public/favicon-16x16.png", size: 16 },
    { file: "public/favicon.png", size: 64 },
    { file: "public/favicon.ico", size: 64 }
  ];

  const trimmedBuffer = await sharp(src)
    .ensureAlpha()
    .trim()
    .resize(480, 480, {
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  const finalLogoBuffer = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    }
  })
    .composite([
      {
        input: trimmedBuffer,
        top: Math.floor((512 - 480) / 2),
        left: Math.floor((512 - 480) / 2)
      }
    ])
    .png()
    .toBuffer();

  await sharp(finalLogoBuffer).toFile("public/logo_default.png");

  for (const t of tasks) {
    const resized = await sharp(finalLogoBuffer)
      .resize(t.size, t.size, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toBuffer();

    if (t.file.endsWith(".ico")) {
      await sharp(resized).toFile(t.file);
    } else {
      await sharp(resized).toFile(t.file);
    }
    console.log("Wrote", t.file);
  }

  // Update manifest.json to reference the generated sizes (keep other fields intact)
  const manifestPath = "public/manifest.json";
  if (fs.existsSync(manifestPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      m.icons = [
        { src: "/logo-192.png", type: "image/png", sizes: "192x192" },
        { src: "/logo-512.png", type: "image/png", sizes: "512x512" }
      ];
      fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
      console.log("Updated manifest.json icons to logo-192.png and logo-512.png");
    } catch (err) {
      console.error("Failed to update manifest.json:", err);
    }
  }

  console.log("All resized icons created (content preserved).");
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
