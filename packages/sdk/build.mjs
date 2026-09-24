import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";

const watch = process.argv.includes("--watch");
const origin = process.env.CHECKOUT_ORIGIN ?? "http://localhost:5174";

const options = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "iife",
  target: "es2022",
  outfile: fileURLToPath(new URL("../../apps/checkout/public/dodo.js", import.meta.url)),
  legalComments: "none",
  banner: {
    js: "/* Dodo Checkout loader. Card data stays on the checkout origin. */",
  },
  define: {
    __CHECKOUT_ORIGIN__: JSON.stringify(origin),
  },
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log(`sdk watching, checkout origin ${origin}`);
} else {
  await esbuild.build(options);
  console.log(`sdk built, checkout origin ${origin}`);
}
