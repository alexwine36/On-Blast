import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	/**
	 * GitHub project sites are served from https://<user>.github.io/<repo>/.
	 * This is case-sensitive and must match the repo name exactly; it is what
	 * every runtime asset URL is resolved against.
	 */
	base: "/On-Blast/",
});
