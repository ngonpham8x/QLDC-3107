import fs from "fs";
import path from "path";
import sharp from "sharp";

async function syncPublicIcons() {
  const sourcePath = "src/assets/images/logo_phuong_binh_minh_official_1782824466988.png";
  if (!fs.existsSync(sourcePath)) {
    console.error("Source file does not exist:", sourcePath);
    return;
  }

  if (!fs.existsSync("public")) {
    fs.mkdirSync("public", { recursive: true });
  }

  // Copy directly
  fs.copyFileSync(sourcePath, "public/logo_phuong_binh_minh_official_1782824466988.png");
  fs.copyFileSync(sourcePath, "public/logo.png");

  // Resize using sharp for PWA icons and favicons
  await sharp(sourcePath).resize(512, 512).png().toFile("public/logo-512.png");
  await sharp(sourcePath).resize(192, 192).png().toFile("public/logo-192.png");
  await sharp(sourcePath).resize(180, 180).png().toFile("public/apple-touch-icon.png");
  await sharp(sourcePath).resize(64, 64).png().toFile("public/favicon.ico");

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

  console.log("Successfully synced all app/web icons from src/assets/images/logo_phuong_binh_minh_official_1782824466988.png!");
}

syncPublicIcons().catch(console.error);
