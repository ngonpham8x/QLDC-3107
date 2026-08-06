import sharp from "sharp";
import fs from "fs";
import path from "path";

async function cleanLogo() {
  const sourcePath = "src/assets/images/logo_phuong_binh_minh_official_1782824466988.png";
  if (!fs.existsSync(sourcePath)) {
    console.error("Source file not found:", sourcePath);
    return;
  }

  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const cx = width / 2;
  const cy = height / 2;
  
  // Emblem circle max radius is ~250px. Use 254px to ensure zero clipping of the outer ring!
  const maxCircleRadius = 254; 

  // Process each pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > maxCircleRadius) {
        // Outside the emblem circle: make transparent
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
      } else {
        // Inside or on the emblem circle:
        // Replace gray/white checkerboard pattern pixels with pure white
        const diffRG = Math.abs(r - g);
        const diffGB = Math.abs(g - b);
        const diffRB = Math.abs(r - b);
        const maxDiff = Math.max(diffRG, diffGB, diffRB);
        
        const avg = (r + g + b) / 3;
        if (maxDiff < 22 && avg > 150) {
          // Replace gray checkerboard square with pure white
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = 255;
        }
      }
    }
  }

  // Create clean full 512x512 PNG with a tiny white margin (scaled to 500x500 inside 512x512)
  // so that when rendered inside rounded-full frames, not a single pixel is clipped at any border!
  const cleanedRaw = await sharp(data, {
    raw: { width, height, channels }
  })
  .png()
  .toBuffer();

  // Scale slightly inside 512x512 canvas with solid/transparent padding
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
      input: await sharp(cleanedRaw).resize(496, 496, { fit: "contain" }).toBuffer(),
      top: 8,
      left: 8
    }
  ])
  .png()
  .toBuffer();

  // Save back to source file
  fs.writeFileSync(sourcePath, finalLogoBuffer);

  // Sync to all public asset locations:
  await sharp(finalLogoBuffer).resize(512, 512).png().toFile("public/logo_phuong_binh_minh_official_1782824466988.png");
  await sharp(finalLogoBuffer).resize(512, 512).png().toFile("public/logo-512.png");
  await sharp(finalLogoBuffer).resize(512, 512).png().toFile("public/logo.png");
  await sharp(finalLogoBuffer).resize(192, 192).png().toFile("public/logo-192.png");
  await sharp(finalLogoBuffer).resize(180, 180).png().toFile("public/apple-touch-icon.png");
  await sharp(finalLogoBuffer).resize(64, 64).png().toFile("public/favicon.ico");

  // Write manifest.json
  const manifestContent = {
    short_name: "Ninh Phú",
    name: "Quản lý Tổ Dân Phố Ninh Phú",
    icons: [
      { src: "/logo-192.png", type: "image/png", sizes: "192x192" },
      { src: "/logo-192.png", type: "image/png", sizes: "192x192", purpose: "maskable" },
      { src: "/logo-512.png", type: "image/png", sizes: "512x512" },
      { src: "/logo-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" }
    ],
    start_url: "/",
    background_color: "#047857",
    theme_color: "#047857",
    display: "standalone"
  };
  fs.writeFileSync("public/manifest.json", JSON.stringify(manifestContent, null, 2));

  console.log("Successfully cleaned logo with full uncropped circular frame!");
}

cleanLogo().catch(console.error);
