import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    errors: "src/types/errors.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
});
