import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { validateVercelBuild } from "./src/deployment-config.ts";

validateVercelBuild({
  vercel: process.env.VERCEL,
  appId: process.env.VITE_PRIVY_APP_ID,
  apiOrigin: process.env.VITE_API_ORIGIN,
});

export default defineConfig({
  plugins: [
    react(),
    {
      name: "nabungfi-public-shell",
      generateBundle(_options, bundle) {
        const shellFiles = new Set<string>();
        const visit = (file: string) => {
          if (shellFiles.has(file)) return;
          const item = bundle[file];
          if (!item) return;
          shellFiles.add(file);
          if (item.type === "chunk") item.imports.forEach(visit);
        };
        for (const [file, item] of Object.entries(bundle)) {
          if (
            item.type === "chunk" &&
            (item.isEntry || file.includes("/Entry-") || file.includes("/Landing-"))
          )
            visit(file);
          if (/\.(css|woff2)$/.test(file)) shellFiles.add(file);
        }
        const assets = [
          "/index.html",
          "/manifest.webmanifest",
          "/favicon.svg",
          "/brand/nabungfi-mark.svg",
          "/brand/nabungfi-mark-small.svg",
          "/brand/nabungfi-mark-mono.svg",
          "/icons/icon-192.png",
          "/icons/icon-512.png",
          "/icons/maskable-512.png",
          "/models/car.jpg",
          "/models/laptop.jpg",
          "/models/house.jpg",
          "/models/custom.jpg",
          ...Object.keys(bundle)
            .filter((path) => path.startsWith("assets/"))
            .map((path) => `/${path}`),
        ];
        const precache = [
          ...assets.filter((asset) => !asset.startsWith("/assets/")),
          ...[...shellFiles].map((file) => `/${file}`),
        ];
        const versionHash = createHash("sha256").update(assets.join("\n"));
        for (const file of assets.filter(
          (asset) => !asset.startsWith("/assets/"),
        ))
          versionHash.update(
            readFileSync(
              new URL(
                file === "/index.html" ? "./index.html" : `./public${file}`,
                import.meta.url,
              ),
            ),
          );
        const version = versionHash.digest("hex").slice(0, 16);
        const source = readFileSync(
          new URL("./public/sw.js", import.meta.url),
          "utf8",
        )
          .replace('"__BUILD_VERSION__"', JSON.stringify(version))
          .replace("__PRECACHE_ASSETS__", JSON.stringify(precache))
          .replace("__PUBLIC_ASSETS__", JSON.stringify(assets));
        this.emitFile({ type: "asset", fileName: "sw.js", source });
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
  preview: { port: 4173, proxy: { "/api": "http://127.0.0.1:3001" } },
  build: { chunkSizeWarningLimit: 1000 },
});
