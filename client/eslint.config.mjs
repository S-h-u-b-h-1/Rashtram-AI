import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const filePath = fileURLToPath(import.meta.url);
const directory = path.dirname(filePath);
const compatibility = new FlatCompat({ baseDirectory: directory });

const config = [
  ...compatibility.extends("next/core-web-vitals"),
  {
    ignores: [".next/**", "node_modules/**"],
  },
];

export default config;
