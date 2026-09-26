import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["esm", "cjs"],
  platform: "node",
  target: ["es2022", "node22"],
  dts: true,
  sourcemap: true,
  // the file names package.json refers to - tsdown would name the ESM build
  // .mjs, as the package has no "type": "module"
  outExtensions: ({ format }) =>
    format === "cjs"
      ? { js: ".cjs", dts: ".d.cts" }
      : { js: ".js", dts: ".d.ts" },
});
