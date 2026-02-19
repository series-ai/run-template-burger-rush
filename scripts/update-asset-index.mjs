import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, basename } from 'path';
import { fileURLToPath } from 'url';

// ---- CONFIGURATION ----
const INDEX_SUFFIX = 'Assets';
const LEGACY_INDEX_NAMES = ['Core.stow Asset List'];
const CDN_ASSETS_DIR = 'public/cdn-assets';
const TARGET_FILES = ['CLAUDE.md', 'AGENTS.md'];
const MIN_PREFIX_SAVINGS = 10;

const TYPE_KEYS = {
  1: 'mesh',
  2: 'texture',
  3: 'audio',
  4: 'material',
  5: 'skinned_mesh',
  6: 'animation',
};

// ---- RESOLVE PROJECT ROOT ----
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---- HELPERS ----

function longestCommonPrefix(strings) {
  if (strings.length === 0) return '';
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix === '') return '';
    }
  }
  return prefix;
}

function compactGroup(key, items) {
  if (items.length === 1) return `${key}:${items[0]}`;

  const prefix = longestCommonPrefix(items);
  const savings = prefix.length * items.length - (prefix.length + items.length);

  if (prefix.length > 0 && savings > MIN_PREFIX_SAVINGS) {
    const suffixes = items.map((i) => i.slice(prefix.length));
    return `${key}:${prefix}{${suffixes.join(',')}}`;
  }
  return `${key}:{${items.join(',')}}`;
}

/** Recursively find all .stow files under a directory */
function findStowFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findStowFiles(full));
    } else if (entry.endsWith('.stow')) {
      results.push(full);
    }
  }
  return results;
}

/** Create a StowKitReader with WASM initialized from the filesystem */
async function createReader() {
  const { StowKitReader } = await import('@stowkit/reader');
  const wasmPath = join(ROOT, 'node_modules/@stowkit/reader/dist/stowkit_reader.wasm');

  if (!existsSync(wasmPath)) {
    throw new Error(`WASM file not found at ${wasmPath}`);
  }

  const reader = new StowKitReader();
  const wasmBytes = readFileSync(wasmPath);

  // Helper to read strings from WASM memory (needed for log imports)
  function readWasmString(ptr, len) {
    if (!reader.memory) return '';
    return new TextDecoder().decode(new Uint8Array(reader.memory.buffer, ptr, len));
  }

  const imports = {
    env: {
      js_console_log: (ptr, len) => {
        // silent in build script
      },
      js_console_error: (ptr, len) => {
        const msg = readWasmString(ptr, len);
        console.error('[StowKit]', msg);
      },
    },
  };

  const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
  reader.wasm = instance.exports;
  reader.memory = reader.wasm.memory;
  reader.isReady = true;
  return reader;
}

/** Build index line for a single .stow file */
function buildIndexLine(stowFilename, relativePath, assets) {
  // Group assets by type
  const groups = {};
  for (const asset of assets) {
    const typeKey = TYPE_KEYS[asset.type];
    if (!typeKey) continue; // skip unknown types (e.g. type 0)
    if (!groups[typeKey]) groups[typeKey] = [];
    if (asset.name) groups[typeKey].push(asset.name);
  }

  const label = `${stowFilename} ${INDEX_SUFFIX}`;
  const parts = [`[${label}]`, `path:${relativePath}`];

  // Consistent ordering of type groups
  const typeOrder = ['mesh', 'skinned_mesh', 'texture', 'audio', 'material', 'animation'];
  for (const typeKey of typeOrder) {
    const items = groups[typeKey];
    if (!items || items.length === 0) continue;
    items.sort();
    parts.push(compactGroup(typeKey, items));
  }

  return parts.join('|');
}

function updateFile(filePath, indexLines) {
  // Build set of names to remove: all new index names + legacy names
  const namesToRemove = [
    ...indexLines.map((_, i) => indexLines[i].match(/^\[([^\]]+)\]/)?.[1]).filter(Boolean),
    ...LEGACY_INDEX_NAMES,
  ];

  let lines = [];
  if (existsSync(filePath)) {
    lines = readFileSync(filePath, 'utf-8').split('\n');
    // Remove any existing index lines (current or legacy names)
    lines = lines.filter((l) => {
      return !namesToRemove.some((name) => l.startsWith(`[${name}]`));
    });
  }

  // Trim trailing empty lines, append index lines, ensure trailing newline
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  lines.push(...indexLines);

  writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}

// ---- MAIN ----
async function main() {
  const cdnDir = join(ROOT, CDN_ASSETS_DIR);
  const stowFiles = findStowFiles(cdnDir);

  if (stowFiles.length === 0) {
    console.log('No .stow files found in', CDN_ASSETS_DIR);
    process.exit(0);
  }

  let reader;
  try {
    reader = await createReader();
  } catch (err) {
    console.error('Failed to initialize StowKit reader:', err.message);
    process.exit(1);
  }

  const indexLines = [];

  for (const stowPath of stowFiles) {
    const relativePath = relative(cdnDir, stowPath).replace(/\\/g, '/');
    const filename = basename(stowPath);

    try {
      const buffer = readFileSync(stowPath);
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      await reader.open(arrayBuffer);
      const assets = reader.listAssets();

      const line = buildIndexLine(filename, relativePath, assets);
      indexLines.push(line);

      console.log(`  ${filename}: ${assets.length} assets`);

      // Close current file before opening next
      if (reader.wasm.closeStow) reader.wasm.closeStow();
    } catch (err) {
      console.error(`  Failed to process ${filename}:`, err.message);
    }
  }

  if (indexLines.length === 0) {
    console.log('No assets extracted.');
    process.exit(0);
  }

  for (const file of TARGET_FILES) {
    const filePath = join(ROOT, file);
    updateFile(filePath, indexLines);
    console.log(`Updated ${file}`);
  }
}

main();
