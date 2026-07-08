/**
 * `src/cli/commands/web/config-page.ts` — the PURE pieces of the `web` authoring flow
 * (RFC 0001 RFC0-CLI path 3: "CLI serves a local web form; the developer makes visual
 * binding choices; the CLI writes the JSON from those choices").
 *
 * All IO (the http server, fs, opening a browser) lives in {@link ./index}. This module is
 * pure + fully unit-testable: it builds the payload the page loads, renders the
 * self-contained HTML (inline CSS/JS — no bundler, no framework, no external request), and
 * applies the choices the page posts back onto the suggested spec.
 *
 * @module
 */
import {
  type AssetSourceSpec,
  type AssetSpec,
  BIOME_KEYWORDS,
  GAMEPLAY_CATEGORIES,
  type GameplayCategory,
  stripAssetCategory,
} from '../../../asset-source';

/** The JSON the config page fetches on load: the suggested spec + the choice vocabularies. */
export interface WebConfigPayload {
  readonly spec: AssetSourceSpec;
  readonly biomes: readonly string[];
  readonly categories: readonly GameplayCategory[];
}

/** Build the initial payload the page renders from. */
export function buildWebConfigPayload(spec: AssetSourceSpec): WebConfigPayload {
  return { spec, biomes: BIOME_KEYWORDS, categories: GAMEPLAY_CATEGORIES };
}

/** One per-asset edit the page posts back (only the fields relevant to the role are read). */
export interface WebAssetChoice {
  readonly id: string;
  readonly biome?: string;
  /** `null` explicitly clears a category; `undefined` leaves it unchanged. */
  readonly category?: GameplayCategory | null;
  /**
   * The chosen atlas layout for a tileset (cols × rows). The cell SIZE is measured
   * server-side from the PNG — the browser only picks how many cells across/down, exactly
   * like `bind --cols/--rows` and the `init` wizard. (The page never sees pixel sizes.)
   */
  readonly grid?: { cols: number; rows: number };
}

/** A measured tileset grid — cols/rows chosen by the human, cell size derived from pixels. */
export interface MeasuredGrid {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
}

/**
 * Apply the human's posted choices onto the suggested spec, returning a NEW spec. Choices
 * are matched to assets by id; an asset with no matching choice is left as suggested. Only
 * the field valid for an asset's role is applied (a biome on a tile, a category on a
 * model/sprite, a grid on a tileset).
 *
 * A tileset's chosen cols/rows are turned into a full grid by `measureGrid` (the command
 * injects it — it reads the atlas PNG and derives the cell size, keeping this pure of fs).
 * If measurement fails (unreadable/oversized PNG) the tileset keeps its SUGGESTED grid so
 * the spec still validates — the failure is surfaced, never a silent zero-size cell.
 */
export function applyWebChoices(
  spec: AssetSourceSpec,
  choices: readonly WebAssetChoice[],
  measureGrid: (assetPath: string, cols: number, rows: number) => MeasuredGrid | undefined
): AssetSourceSpec {
  const byId = new Map(choices.map((c) => [c.id, c]));
  const assets = spec.assets.map((asset): AssetSpec => {
    const choice = byId.get(asset.id);
    if (!choice) {
      return asset;
    }
    if (asset.role === 'tile' && typeof choice.biome === 'string') {
      return { ...asset, biome: choice.biome };
    }
    if (asset.role === 'tileset' && choice.grid) {
      const measured = measureGrid(asset.path, choice.grid.cols, choice.grid.rows);
      // Fall back to the suggested grid (not a zero-size cell) when the PNG can't be read.
      return measured ? { ...asset, grid: measured } : asset;
    }
    if (asset.role === 'model' || asset.role === 'sprite') {
      if (choice.category === null) {
        return stripAssetCategory(asset);
      }
      if (choice.category !== undefined) {
        return { ...asset, category: choice.category };
      }
    }
    return asset;
  });
  return { ...spec, assets };
}

/** Escape a string for safe embedding inside an HTML text node / attribute. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Escape a JSON string for embedding inside a `<script type="application/json">` block.
 * Unlike {@link escapeHtml} (which turns `"`→`&quot;` and would make the text un-parseable
 * by `JSON.parse`), this escapes only the three sequences that can break OUT of the script
 * element — `<` (a `</script>` / `<!--` opener), `>`, and `&` — using `\uXXXX` forms that
 * are valid JSON and decode back to the same characters. The payload stays valid JSON while
 * a spec name or asset id containing `</script>` can no longer terminate the tag.
 */
function escapeForScriptJson(json: string): string {
  // The input is already valid JSON (from JSON.stringify), so backslashes are ALREADY
  // escaped — do NOT re-escape them. Rewrite only the chars that can break out of the
  // script element into \\uXXXX (still valid JSON; JSON.parse decodes them back): < > &
  // and the U+2028/U+2029 line/paragraph separators (legal in a JSON string but a syntax
  // error inside an inline <script>).
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Render the self-contained config page. The payload is embedded as a JSON script tag (so
 * there is no fetch round-trip and the page works even if served as a static file); the
 * inline script builds a row per asset with the right control, and POSTs the edited choices
 * to `/api/spec` on Save. No external stylesheet, font, script, or image — CSP-safe.
 */
export function renderConfigPage(payload: WebConfigPayload): string {
  // The payload embeds as JSON the page JSON.parses back — use the JSON-safe script
  // escaper (NOT escapeHtml, whose &quot; would make it unparseable). escapeHtml stays for
  // the <title>/<code> TEXT contexts below.
  const data = escapeForScriptJson(JSON.stringify(payload));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Bind assets — ${escapeHtml(payload.spec.name)}</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; padding: 1.5rem; max-width: 960px; margin-inline: auto; }
  h1 { font-size: 1.25rem; }
  .hint { opacity: 0.7; font-size: 0.9rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid rgba(128,128,128,0.3); }
  th { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
  code { font-family: ui-monospace, monospace; font-size: 0.85rem; }
  select, input { font: inherit; padding: 0.2rem 0.3rem; }
  input[type=number] { width: 4.5rem; }
  .actions { position: sticky; bottom: 0; padding: 1rem 0; background: Canvas; }
  button { font: inherit; padding: 0.5rem 1.1rem; cursor: pointer; border-radius: 6px; }
  button.primary { background: #f5a623; border: none; color: #1a1a1a; font-weight: 600; }
  #status { margin-left: 1rem; }
</style>
</head>
<body>
<h1>Bind assets — <code>${escapeHtml(payload.spec.name)}</code></h1>
<p class="hint">Confirm or override each suggested binding, then Save. The suggestions come from filename heuristics — they are defaults, not decisions.</p>
<table><thead><tr><th>Asset</th><th>Role</th><th>Binding</th></tr></thead><tbody id="rows"></tbody></table>
<div class="actions"><button class="primary" id="save">Save spec</button><span id="status"></span></div>
<script type="application/json" id="payload">${data}</script>
<script>
${CONFIG_PAGE_SCRIPT}
</script>
</body>
</html>
`;
}

/**
 * The page's inline controller. Kept as a plain string (not a bundled module) so the page
 * is self-contained — it reads the embedded payload, renders a control per asset, and POSTs
 * the choices. Extracted to a constant so {@link renderConfigPage} stays readable.
 */
const CONFIG_PAGE_SCRIPT = `
const payload = JSON.parse(document.getElementById('payload').textContent);
const rows = document.getElementById('rows');
const controls = new Map();

function option(value, label, selected) {
  const o = document.createElement('option');
  o.value = value; o.textContent = label ?? value; if (selected) o.selected = true;
  return o;
}

for (const asset of payload.spec.assets) {
  const tr = document.createElement('tr');
  const name = document.createElement('td');
  const code = document.createElement('code'); code.textContent = asset.id;
  name.append(code);
  const role = document.createElement('td'); role.textContent = asset.role;
  const binding = document.createElement('td');

  if (asset.role === 'tile') {
    const sel = document.createElement('select');
    for (const b of payload.biomes) sel.append(option(b, b, b === asset.biome));
    sel.append(option('unknown', 'unknown', asset.biome === 'unknown'));
    binding.append(sel);
    controls.set(asset.id, () => ({ id: asset.id, biome: sel.value }));
  } else if (asset.role === 'tileset') {
    const cols = document.createElement('input'); cols.type = 'number'; cols.min = '1'; cols.value = asset.grid.cols || 1;
    const rowsIn = document.createElement('input'); rowsIn.type = 'number'; rowsIn.min = '1'; rowsIn.value = asset.grid.rows || 1;
    binding.append(cols, document.createTextNode(' × '), rowsIn, document.createTextNode(' cells'));
    controls.set(asset.id, () => ({ id: asset.id, grid: { cols: Number(cols.value), rows: Number(rowsIn.value) } }));
  } else {
    const sel = document.createElement('select');
    sel.append(option('', '(none)', !asset.category));
    for (const c of payload.categories) sel.append(option(c, c, c === asset.category));
    binding.append(sel);
    controls.set(asset.id, () => ({ id: asset.id, category: sel.value === '' ? null : sel.value }));
  }
  tr.append(name, role, binding);
  rows.append(tr);
}

document.getElementById('save').addEventListener('click', async () => {
  const status = document.getElementById('status');
  status.textContent = 'Saving…';
  const choices = [...controls.values()].map((read) => read());
  try {
    const res = await fetch('/api/spec', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ choices }) });
    const body = await res.json();
    status.textContent = res.ok ? ('Saved to ' + body.path + ' — you can close this tab.') : ('Error: ' + (body.error || res.status));
  } catch (err) {
    status.textContent = 'Error: ' + err;
  }
});
`;
