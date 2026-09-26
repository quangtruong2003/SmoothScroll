// One-shot downloader for the bundled default-game icons (48x48 PNG).
// Steam titles come from the official Cloudflare CDN; the remaining titles
// are fetched manually at execution time (see the plan's Task 1 notes).
// Re-running the script skips existing files, re-runs the resize pass over
// oversized files, and exits non-zero listing any icon still missing.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src", "assets", "games");
mkdirSync(outDir, { recursive: true });

const STEAM = {
  csgo: 730,
  cs2: 730,
  dota2: 570,
  apexlegends: 1172470,
  rainbowsix: 359550,
  pubg: 578080,
  gta5: 271590,
  rdr2: 1174180,
  eldenring: 1245620,
  cyberpunk2077: 1091500,
  witcher3: 292030,
  rocketleague: 252950,
  warframe: 230410,
  factorio: 427520,
  terraria: 105600,
  stardewvalley: 413150,
  ets2: 227300,
  ats: 270880,
  dishonored2: 403640,
};

// Not on Steam — fetch the official icon PNG manually and save it as
// src/assets/games/<name>.png before finishing this task.
const MANUAL = [
  "leagueoflegends",
  "valorant",
  "fortniteclient-win64-shipping",
  "minecraftlauncher",
  "javaw",
  "overwatch",
  "overwatch2",
  "wow",
  "ffxiv_dx11",
];

const FULL_LIST = [...Object.keys(STEAM), ...MANUAL];

const RESIZE_PS = (file) =>
  `Add-Type -AssemblyName System.Drawing; ` +
  `$src=[System.Drawing.Image]::FromFile('${file}'); ` +
  `$scale=[Math]::Min(48/$src.Width,48/$src.Height); ` +
  `if($scale -ge 1){$src.Dispose(); exit 0}; ` +
  `$w=[int]([Math]::Ceiling($src.Width*$scale)); $h=[int]([Math]::Ceiling($src.Height*$scale)); ` +
  `$bmp=New-Object System.Drawing.Bitmap($w,$h); ` +
  `$g=[System.Drawing.Graphics]::FromImage($bmp); ` +
  `$g.InterpolationMode='HighQualityBicubic'; ` +
  `$g.DrawImage($src,0,0,$w,$h); $g.Dispose(); $src.Dispose(); ` +
  `$bmp.Save('${file}',[System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()`;

for (const [name, appId] of Object.entries(STEAM)) {
  const dest = join(outDir, `${name}.png`);
  if (existsSync(dest) && statSync(dest).size > 1024) continue;
  const url = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/logo.png`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(1, 4).toString("binary") !== "PNG") throw new Error("not a PNG");
    writeFileSync(dest, buf);
    console.log(`downloaded ${name}.png (${buf.length} bytes)`);
  } catch (err) {
    console.error(`FAILED ${name}: ${err.message}`);
  }
}

// Resize every oversized file to a 48px longest side.
for (const name of FULL_LIST) {
  const dest = join(outDir, `${name}.png`);
  if (!existsSync(dest)) continue;
  if (statSync(dest).size <= 20 * 1024) continue;
  execFileSync("powershell", ["-NoProfile", "-Command", RESIZE_PS(dest)]);
  console.log(`resized ${name}.png -> ${statSync(dest).size} bytes`);
}

const missing = FULL_LIST.filter((name) => {
  const dest = join(outDir, `${name}.png`);
  return !existsSync(dest) || statSync(dest).size < 1024;
});

if (missing.length > 0) {
  console.error(`\nStill missing (fetch manually):\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
console.log("\nAll 28 icons present.");
