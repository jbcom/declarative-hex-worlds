// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

// GitHub Pages deploys under the repo path. CI sets ASTRO_BASE based on the
// repo's pages config; locally + on PR builds, base is `/`.
const base = process.env.ASTRO_BASE ?? '/';
const site = process.env.ASTRO_SITE ?? 'https://jbcom.github.io/medieval-hexagon-gameboard';

// Mirrors tsup.config.ts `entry` — every entry corresponds to a public subpath
// in the library's `package.json#exports`. Each generates a Markdown reference
// page under `src/content/docs/reference/` at build time.
const entryPoints = [
	'../src/index.ts',
	'../src/actors/index.ts',
	'../src/scenario/blueprint.ts',
	'../src/scenario/catalog.ts',
	'../src/interop/compatibility.ts',
	'../src/commands/index.ts',
	'../src/interop/coverage.ts',
	'../src/coordinates/index.ts',
	'../src/gameboard/index.ts',
	'../src/coordinates/grid.ts',
	'../src/interop/index.ts',
	'../src/koota/index.ts',
	'../src/coordinates/layout.ts',
	'../src/movement/index.ts',
	'../src/gameboard/navigation.ts',
	'../src/gameboard/occupancy.ts',
	'../src/patrol/index.ts',
	'../src/pieces/index.ts',
	'../src/coordinates/projection.ts',
	'../src/quests/index.ts',
	'../src/scenario/recipe.ts',
	'../src/scenario/registry.ts',
	'../src/react/index.ts',
	'../src/rules/rule-types.ts',
	'../src/rules/index.ts',
	'../src/runtime/index.ts',
	'../src/scenario/index.ts',
	'../src/selectors/index.ts',
	'../src/simulation/index.ts',
	'../src/systems/index.ts',
	'../src/three/index.ts',
	'../src/traits/index.ts',
	'../src/errors/index.ts',
	'../src/types/index.ts',
	'../src/rules/validation.ts',
	'../src/systems/world-rules-system.ts',
	'../src/cli/cli.ts',
	'../src/bootstrap/index.ts',
	'../src/ingest/index.ts',
	'../src/manifest/free.ts',
	'../src/manifest/schema.ts',
	'../src/bootstrap/upstream-layout.ts',
];

export default defineConfig({
	site,
	base,
	integrations: [
		starlight({
			title: '@jbcom/medieval-hexagon-gameboard',
			description:
				'Deterministic KayKit Medieval Hexagon gameboard runtime with Koota ECS and first-class React + Three.js bindings.',
			favicon: '/favicon.svg',
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/jbcom/medieval-hexagon-gameboard',
				},
				{
					icon: 'npm',
					label: 'npm',
					href: 'https://www.npmjs.com/package/@jbcom/medieval-hexagon-gameboard',
				},
			],
			editLink: {
				baseUrl:
					'https://github.com/jbcom/medieval-hexagon-gameboard/edit/main/docs-site/',
			},
			lastUpdated: true,
			pagination: true,
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 4 },
			plugins: [
				starlightTypeDoc({
					entryPoints,
					tsconfig: './tsconfig.typedoc.json',
					output: 'reference',
					sidebar: { label: 'Reference', collapsed: false },
					typeDoc: {
						plugin: ['typedoc-plugin-markdown'],
						entryPointStrategy: 'expand',
						excludeInternal: true,
						excludePrivate: true,
						hideGenerator: true,
						// src/cli/_shared.ts imports the SimpleRPG fixture
						// under tests/integration/. typedoc's TS pass walks
						// that import, then errors on its module resolution
						// because docs-site has no @jbcom/... alias mapping
						// available to its TS install. Skip TS error checking
						// so traversal is tolerated; emitted reference pages
						// stay correct (they come from entryPoints).
						skipErrorChecking: true,
					},
				}),
			],
			sidebar: [
				{
					label: 'Get started',
					items: [{ label: 'Overview', slug: 'index' }],
				},
				{
					label: 'Guides',
					items: [{ autogenerate: { directory: 'guides' } }],
				},
				{
					label: 'Features',
					items: [{ autogenerate: { directory: 'features' } }],
				},
				typeDocSidebarGroup,
				{
					label: 'About',
					items: [{ autogenerate: { directory: 'about' } }],
				},
			],
		}),
	],
});
