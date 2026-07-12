#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      args[key] = value;
      i++;
    }
  }
  return args;
}

function readSig(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8').trim();
}

function main() {
  const {
    channel,
    version,
    tag,
    output,
    'windows-exe': winExe,
    'macos-arm-dmg': macArm,
    'macos-x64-dmg': macX64,
    'linux-deb': linuxDeb,
    'linux-appimage': linuxAppImage,
  } = parseArgs(process.argv);

  if (!channel || !version || !tag || !output) {
    console.error(
      'Usage: generate-updater-manifest.mjs --channel <stable|beta> --version <X.Y.Z> --tag <vX.Y.Z> --output <path> [--windows-exe <path>] [--macos-arm-dmg <path>] [--macos-x64-dmg <path>] [--linux-deb <path>] [--linux-appimage <path>]'
    );
    process.exit(1);
  }

  const repo = 'quangtruong2003/SmoothScroll';
  const baseUrl = `https://github.com/${repo}/releases/download/${tag}`;
  const pubDate = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const manifest = {
    version,
    notes: `See full changelog at https://github.com/${repo}/releases/tag/${tag}`,
    pub_date: pubDate,
    platforms: {},
  };

  if (winExe) {
    const fileName = winExe.split(/[\\/]/).pop();
    const sig = readSig(`${winExe}.sig`);
    manifest.platforms['windows-x86_64'] = {
      signature: sig || '',
      url: `${baseUrl}/${fileName}`,
    };
  }

  if (macArm) {
    const fileName = macArm.split(/[\\/]/).pop();
    const sig = readSig(`${macArm}.sig`);
    manifest.platforms['darwin-aarch64'] = {
      signature: sig || '',
      url: `${baseUrl}/${fileName}`,
    };
  }

  if (macX64) {
    const fileName = macX64.split(/[\\/]/).pop();
    const sig = readSig(`${macX64}.sig`);
    manifest.platforms['darwin-x86_64'] = {
      signature: sig || '',
      url: `${baseUrl}/${fileName}`,
    };
  }

  if (linuxDeb) {
    const fileName = linuxDeb.split(/[\\/]/).pop();
    const sig = readSig(`${linuxDeb}.sig`);
    manifest.platforms['linux-x86_64'] = {
      signature: sig || '',
      url: `${baseUrl}/${fileName}`,
    };
  }

  if (linuxAppImage) {
    const fileName = linuxAppImage.split(/[\\/]/).pop();
    const sig = readSig(`${linuxAppImage}.sig`);
    if (!manifest.platforms['linux-x86_64']) {
      manifest.platforms['linux-x86_64'] = {
        signature: sig || '',
        url: `${baseUrl}/${fileName}`,
      };
    }
  }

  const outDir = dirname(output);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(output, JSON.stringify(manifest, null, 2));
  console.log(`Wrote ${channel} manifest to ${output}:`);
  console.log(JSON.stringify(manifest, null, 2));
}

main();
