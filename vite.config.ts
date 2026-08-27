import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import {
  MOTION,
  RADIUS,
  SHADOW,
  SPACE,
  THEME_IDS,
  TYPE,
  themes,
  toCssVars,
} from '@roman-mik/kapa-core/theme';
import { defineConfig, lazyPlugins, loadEnv, type Plugin } from 'vite-plus';
import { parseSupabaseEnv } from './src/lib/env-schema.js';

const themeVarsPath = fileURLToPath(new URL('./src/styles/theme-vars.css', import.meta.url));

// kapa-core ships theme data, not CSS. This turns it into the `--kapa-*`
// custom properties main.css and every component's scoped styles read,
// generated fresh on every dev/build start so a new theme in kapa-core
// needs no CSS edits here.
function generateThemeCss(): string {
  const structureVars = [
    ...Object.entries(RADIUS).map(([key, value]) => `  --kapa-radius-${key}: ${value}px;`),
    ...Object.entries(SHADOW).map(([key, value]) => `  --kapa-shadow-${key}: ${value};`),
    ...Object.entries(SPACE).map(([key, value]) => `  --kapa-space-${key}: ${value}px;`),
    ...Object.entries(TYPE).flatMap(([role, { size, lineHeight, weight }]) => [
      `  --kapa-text-${role}-size: ${size}px;`,
      `  --kapa-text-${role}-line: ${lineHeight}px;`,
      `  --kapa-text-${role}-weight: ${weight};`,
    ]),
    `  --kapa-motion-fast: ${MOTION.fast}ms;`,
    `  --kapa-motion-base: ${MOTION.base}ms;`,
    `  --kapa-motion-slow: ${MOTION.slow}ms;`,
    `  --kapa-motion-ease: ${MOTION.ease};`,
  ].join('\n');

  const themeBlocks = THEME_IDS.map((id) => {
    const declarations = Object.entries(toCssVars(themes[id]))
      .map(([property, value]) => `  ${property}: ${value};`)
      .join('\n');
    return `[data-theme="${id}"] {\n${declarations}\n}`;
  }).join('\n\n');

  return `/* Generated from @roman-mik/kapa-core/theme — do not edit by hand. */\n:root {\n${structureVars}\n}\n\n${themeBlocks}\n`;
}

function kapaThemeCss(): Plugin {
  return {
    name: 'kapa-theme-css',
    buildStart() {
      writeFileSync(themeVarsPath, generateThemeCss());
    },
    // Substitutes the pre-paint theme-detection script's %KAPA_THEME_IDS%
    // placeholder (index.html) with kapa-core's own THEME_IDS, so adding a
    // theme there never requires an index.html edit here.
    transformIndexHtml(html) {
      return html.replaceAll('%KAPA_THEME_IDS%', JSON.stringify(THEME_IDS));
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Validated here, not just in src/lib/env.ts's browser-side call, so a
  // missing/invalid var fails `vp build`/`vp dev` immediately instead of
  // surfacing as a runtime error on the first page load.
  parseSupabaseEnv(loadEnv(mode, process.cwd(), 'VITE_'));

  return {
    staged: {
      '*': 'vp check --fix',
    },
    // Closest match to tracker's .prettierrc (semi: true, trailingComma:
    // "es5", tabWidth: 2) — those three are already Oxfmt's defaults, only
    // singleQuote needs setting explicitly.
    fmt: { singleQuote: true, trailingComma: 'es5' },
    lint: {
      jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
      rules: {
        'vite-plus/prefer-vite-plus-imports': 'error',
        'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      },
      options: { typeAware: true, typeCheck: true },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.ts'],
      // No component/composable specs exist yet (flagged as a gap, not this
      // task's scope) — without this, `vp test` exits non-zero on an empty
      // suite and CI never goes green.
      passWithNoTests: true,
    },
    plugins: lazyPlugins(() => [vue(), kapaThemeCss()]),
  };
});
