import { includeIgnoreFile } from '@eslint/compat'
import js from '@eslint/js'
import eslintPluginImport from 'eslint-plugin-import'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import { resolve } from 'node:path'
import typescriptEslint from 'typescript-eslint'

export default typescriptEslint.config(
  includeIgnoreFile(resolve(import.meta.dirname, '.gitignore')),
  js.configs.recommended,
  typescriptEslint.configs.strictTypeChecked,
  typescriptEslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  eslintPluginImport.flatConfigs.recommended,
  eslintPluginImport.flatConfigs.typescript,
  eslintPluginReact.configs.flat.all,
  eslintPluginReactHooks.configs['recommended-latest'],
  eslintPluginPrettierRecommended,
  // {
  //   files: ['**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}'],
  // },
)
