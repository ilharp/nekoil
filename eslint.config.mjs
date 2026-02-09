/* eslint-disable import-x/no-named-as-default-member */

import { includeIgnoreFile } from '@eslint/compat'
import js from '@eslint/js'
import eslintPluginQuery from '@tanstack/eslint-plugin-query'
import eslintPluginImport from 'eslint-plugin-import-x'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import { resolve } from 'node:path'
import typescriptEslint from 'typescript-eslint'

// eslint-disable-next-line import-x/no-default-export
export default defineConfig(
  includeIgnoreFile(resolve(import.meta.dirname, '.gitignore')),
  js.configs.recommended,
  typescriptEslint.configs.strictTypeChecked,
  typescriptEslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.mjs', 'scripts/*.mts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  eslintPluginImport.flatConfigs.recommended,
  eslintPluginImport.flatConfigs.typescript,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  eslintPluginReactHooks.configs.flat['recommended-latest'],
  eslintPluginQuery.configs['flat/recommended'],
  eslintPluginPrettierRecommended,
  {
    rules: {
      'import-x/no-default-export': 'error',
      'import-x/consistent-type-specifier-style': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unnecessary-condition': [
        'error',
        {
          allowConstantLoopConditions: 'only-allowed-literals',
        },
      ],
    },
  },
  {
    files: ['packages/adapter-*/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}'],
    rules: {
      'prettier/prettier': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
)
