import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { RADIUS, SHADOW, THEME_IDS, themes, toCssVars } from "@roman-mik/kapa-core/theme";
import { defineConfig, lazyPlugins, type Plugin } from "vite-plus";

const themeVarsPath = fileURLToPath(new URL("./src/styles/theme-vars.css", import.meta.url));

// kapa-core ships theme data, not CSS. This turns it into the `--kapa-*`
// custom properties main.css and every component's scoped styles read,
// generated fresh on every dev/build start so a new theme in kapa-core
// needs no CSS edits here.
function generateThemeCss(): string {
  const structureVars = [
    ...Object.entries(RADIUS).map(([key, value]) => `  --kapa-radius-${key}: ${value}px;`),
    ...Object.entries(SHADOW).map(([key, value]) => `  --kapa-shadow-${key}: ${value};`),
  ].join("\n");

  const themeBlocks = THEME_IDS.map((id) => {
    const declarations = Object.entries(toCssVars(themes[id]))
      .map(([property, value]) => `  ${property}: ${value};`)
      .join("\n");
    return `[data-theme="${id}"] {\n${declarations}\n}`;
  }).join("\n\n");

  return `/* Generated from @roman-mik/kapa-core/theme — do not edit by hand. */\n:root {\n${structureVars}\n}\n\n${themeBlocks}\n`;
}

function kapaThemeCss(): Plugin {
  return {
    name: "kapa-theme-css",
    buildStart() {
      writeFileSync(themeVarsPath, generateThemeCss());
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: lazyPlugins(() => [vue(), kapaThemeCss()]),
});
