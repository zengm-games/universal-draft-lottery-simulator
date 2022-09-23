import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
	plugins: [preact(), viteSingleFile({ inlinePattern: "**/*.css" })],
	base: "/universal-draft-lottery-simulator/",
});
