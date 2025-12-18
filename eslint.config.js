import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default [
  js.configs.recommended,

  // Regras recomendadas para TypeScript
  ...tseslint.configs.recommended,

  // Integração Prettier + ESLint
  {
    plugins: {
      prettier,
    },
    rules: {
      "prettier/prettier": "error",

      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },

  prettierConfig,
];
