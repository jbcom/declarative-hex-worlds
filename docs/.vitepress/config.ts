import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Medieval Hexagon Gameboard',
  description: 'Koota-first KayKit Medieval Hexagon 2.5D gameboard runtime',
  base: '/medieval-hexagon-gameboard/',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Guides', link: '/guides/public-api' },
      { text: 'Pillars', link: '/pillars/00-library-charter' },
      { text: 'API', link: '/api/' },
      { text: 'GitHub', link: 'https://github.com/jbcom/medieval-hexagon-gameboard' },
    ],
    sidebar: [
      {
        text: 'Guides',
        items: [
          { text: 'Public API Guide', link: '/guides/public-api' },
          { text: 'Recipes, Scenarios, And Simulation', link: '/guides/recipes-scenarios-and-simulation' },
          { text: 'Rendering, Assets, And External Packs', link: '/guides/rendering-assets-and-external-packs' },
        ],
      },
      {
        text: 'Project Pillars',
        items: [
          { text: 'Library Charter', link: '/pillars/00-library-charter' },
          { text: 'Tiles And Connectivity', link: '/pillars/01-tiles-connectivity' },
          { text: 'Asset Taxonomy', link: '/pillars/02-asset-taxonomy' },
          { text: 'Editions And Ingest', link: '/pillars/03-editions-and-ingest' },
          { text: 'Visual Verification', link: '/pillars/04-visual-verification' },
          { text: 'Koota Runtime Rules', link: '/pillars/05-koota-runtime-rules' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/jbcom/medieval-hexagon-gameboard' }],
  },
});
