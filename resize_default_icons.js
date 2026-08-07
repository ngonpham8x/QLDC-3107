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
    { file: "public/favicon.png", size: 64 },
    { file: "public/favicon.ico", size: 64 }
  ];

  for (const t of tasks) {
    // Preserve content: use 'contain' so image is not cropped and aspect ratio kept.
    await sharp(src)
      .resize(t.size, t.size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(t.file);
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
