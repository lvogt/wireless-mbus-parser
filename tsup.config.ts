import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  clean: true,
  format: ["esm", "cjs"],
  target: ["es2022", "node22"],
  dts: {
    // tsup sets the deprecated baseUrl itself for the declaration build, our
    // own tsconfig does not use it - remove once tsup no longer does
    compilerOptions: { ignoreDeprecations: "6.0" },
  },
  minify: false,
  sourcemap: true,
  splitting: true,
});
