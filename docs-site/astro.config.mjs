// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// GitHub Pages deploys under the repo path. CI sets ASTRO_BASE based on the
// repo's pages config; locally + on PR builds, base is `/`.
const base = process.env.ASTRO_BASE ?? '/';
const site = process.env.ASTRO_SITE ?? 'https://jbcom.github.io/medieval-hexagon-gameboard';

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
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'reference' } }],
				},
				{
					label: 'About',
					items: [{ autogenerate: { directory: 'about' } }],
				},
			],
		}),
	],
});
