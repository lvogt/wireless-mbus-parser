import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  clean: true,
  format: ["esm", "cjs"],
  target: ["es2022", "node22"],
  dts: true,
  minify: false,
  sourcemap: true,
  splitting: true,
});
