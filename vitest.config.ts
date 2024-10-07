import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globalSetup: "test/vitest.setup.ts",
    include: ["test/**/*.spec.ts"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html"],
    },
  },
});
