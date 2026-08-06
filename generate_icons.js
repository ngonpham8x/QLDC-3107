import fs from "fs";
import path from "path";
import sharp from "sharp";

// Perfect vector replica of official Phường Bình Minh logo with pure white circular emblem
const createBinhMinhLogoSvg = (size = 512) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- Clean White Circle Container -->
  <circle cx="256" cy="256" r="256" fill="#ffffff"/>

  <!-- Centered Emblem Scaled slightly so outer ring stroke is 100% inside canvas -->
  <g transform="translate(25.6, 25.6) scale(0.9)">
    <!-- Outer Dark Green Ring -->
    <circle cx="256" cy="256" r="242" fill="none" stroke="#007a3e" stroke-width="16"/>
    <circle cx="256" cy="256" r="234" fill="#ffffff"/>

    <!-- 1. SUN RAYS AT TOP (Yellow/Orange) -->
    <g transform="translate(256, 230)">
      <!-- Radiating Sun Rays -->
      <path d="M -130,-70 L -115,-135 L -95,-128 Z" fill="#ffaa00"/>
      <path d="M -95,-85 L -75,-150 L -55,-142 Z" fill="#ffaa00"/>
      <path d="M -60,-95 L -35,-162 L -15,-155 Z" fill="#ffaa00"/>
      <path d="M -20,-100 L 0,-168 L 20,-168 Z" fill="#ffaa00"/>
      <path d="M 20,-100 L 35,-162 L 55,-155 Z" fill="#ffaa00"/>
      <path d="M 60,-95 L 75,-150 L 95,-142 Z" fill="#ffaa00"/>
      <path d="M 95,-85 L 115,-135 L 130,-125 Z" fill="#ffaa00"/>
    </g>

    <!-- 2. STYLIZED 'B' LETTER (Green Modern Buildings on left & Bird Head on right) -->
    <!-- Left Green High-rise Buildings -->
    <path d="M 100,280 L 100,160 L 140,135 L 140,280 Z" fill="#007a3e"/>
    <path d="M 150,280 L 150,110 L 190,85 L 190,280 Z" fill="#007a3e"/>
    <path d="M 200,280 L 200,95 L 240,115 L 240,280 Z" fill="#007a3e"/>

    <!-- Right Green Bird Curve / Wing of 'B' -->
    <path d="M 230,85 C 330,80 430,130 430,240 C 430,340 330,390 230,390 C 290,360 380,320 380,240 C 380,160 300,110 230,85 Z" fill="#007a3e"/>
    <!-- Bird Beak/Head dot -->
    <circle cx="370" cy="225" r="4" fill="#ffffff"/>

    <!-- 3. DARK BLUE MOUNTAIN AND TRADITIONAL TOWER/PAGODA IN CENTER -->
    <!-- Dark Blue Mountain Triangle -->
    <path d="M 95,320 L 256,190 L 417,320 Z" fill="#0d1b7a"/>
    
    <!-- White Outline Pagoda Structure -->
    <g stroke="#ffffff" stroke-width="4" fill="#0d1b7a">
      <!-- Pagoda Roof 1 -->
      <path d="M 206,305 L 256,270 L 306,305 L 296,320 L 216,320 Z"/>
      <!-- Pagoda Roof 2 -->
      <path d="M 226,275 L 256,245 L 286,275 L 278,285 L 234,285 Z"/>
      <!-- Tower Pillar -->
      <path d="M 246,245 L 256,170 L 266,245 Z" fill="#0d1b7a"/>
    </g>

    <!-- 4. VIETNAM RED FLAG WITH YELLOW STAR ATOP TOWER -->
    <g transform="translate(256, 150)">
      <!-- Flag Pole -->
      <line x1="0" y1="20" x2="0" y2="-12" stroke="#ffffff" stroke-width="2.5"/>
      <!-- Red Flag waving -->
      <path d="M 0,-12 C 12,-16 20,-8 32,-12 L 32,5 C 20,9 12,1 0,5 Z" fill="#da251d"/>
      <!-- Yellow Star -->
      <polygon points="16,-7 18,-2 23,-2 19,1 21,6 16,3 11,6 13,1 9,-2 14,-2" fill="#ffff00"/>
    </g>

    <!-- 5. TEXT: "PHƯỜNG BÌNH MINH" (Center below mountain) -->
    <text x="256" y="345" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="20" fill="#007a3e" text-anchor="middle" letter-spacing="1">
      PHƯỜNG
    </text>
    <text x="256" y="375" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="26" fill="#007a3e" text-anchor="middle" letter-spacing="1.5">
      BÌNH MINH
    </text>

    <!-- 6. BOTTOM BANNER / ARCS FOR SLOGAN -->
    <!-- Circular Path for Red Text (Left Slogan) -->
    <path id="sloganArcLeft" d="M 80,310 A 210,210 0 0,0 256,462" fill="none"/>
    <!-- Circular Path for Gold Text (Right Slogan) -->
    <path id="sloganArcRight" d="M 256,462 A 210,210 0 0,0 432,310" fill="none"/>

    <!-- Red Text: ĐOÀN KẾT - THÂN THIỆN -->
    <text font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="17" fill="#cc0000">
      <textPath href="#sloganArcLeft" startOffset="50%" text-anchor="middle">
        ĐOÀN KẾT - THÂN THIỆN
      </textPath>
    </text>

    <!-- Gold/Yellow Text: PHÁT TRIỂN - VĂN MINH -->
    <text font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="17" fill="#d48800">
      <textPath href="#sloganArcRight" startOffset="50%" text-anchor="middle">
        PHÁT TRIỂN - VĂN MINH
      </textPath>
    </text>
  </g>
</svg>
`;

async function generateLogoFiles() {
  const svgBuf = Buffer.from(createBinhMinhLogoSvg(512));

  // Write PNGs
  await sharp(svgBuf).resize(512, 512).png().toFile("public/logo_phuong_binh_minh_official_1782824466988.png");
  await sharp(svgBuf).resize(512, 512).png().toFile("public/logo-512.png");
  await sharp(svgBuf).resize(512, 512).png().toFile("public/logo.png");
  await sharp(svgBuf).resize(192, 192).png().toFile("public/logo-192.png");
  await sharp(svgBuf).resize(180, 180).png().toFile("public/apple-touch-icon.png");
  await sharp(svgBuf).resize(64, 64).png().toFile("public/favicon.ico");

  // Also update src/assets/images
  if (!fs.existsSync("src/assets/images")) {
    fs.mkdirSync("src/assets/images", { recursive: true });
  }
  await sharp(svgBuf).resize(512, 512).png().toFile("src/assets/images/logo_phuong_binh_minh_official_1782824466988.png");

  console.log("Successfully rendered official Phường Bình Minh logo to all assets!");
}

generateLogoFiles().catch(console.error);
