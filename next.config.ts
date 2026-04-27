import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie standalone : produit un bundle minimal (server.js + node_modules
  // strictement nécessaires) que le Dockerfile multi-stage copie dans une
  // image runtime ultra-légère. Indispensable pour notre Dockerfile.
  output: "standalone",
};

export default nextConfig;
