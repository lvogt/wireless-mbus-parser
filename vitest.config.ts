import tsconfigPaths from "vite-tsconfig-paths";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globalSetup: "test/vitest.setup.ts",
    include: ["test/**/*.spec.ts"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html"],
      exclude: [
        ...coverageConfigDefaults.exclude,
        // The VIF tables are data, not logic: covering them only measures
        // whether a descriptor was instantiated, not whether it is correct.
        // They are pinned by a snapshot of every entry instead.
        "src/vif/defaultVifs.ts",
        "src/vif/fbVifs.ts",
        "src/vif/fdVifs.ts",
        "src/vif/manufacturerSpecificVifs.ts",
        "src/vif/vifExtension.ts",
      ],
    },
  },
});
