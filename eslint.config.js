import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import { includeIgnoreFile } from '@eslint/compat'
import svelte from 'eslint-plugin-svelte'
import stylistic from '@stylistic/eslint-plugin'
import eslintPluginBetterTailwindcss from 'eslint-plugin-better-tailwindcss'
import globals from 'globals'
import { fileURLToPath } from 'node:url'
import { configs, parser } from 'typescript-eslint'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'
import deMorgan from 'eslint-plugin-de-morgan'
import local from './eslint-plugin-local/index.js'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

export default defineConfig(
	{
		plugins: {
			'svelte': svelte,
			'@stylistic': stylistic,
			'local': local,
		},
	},
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...configs.recommended,
	...svelte.configs['flat/recommended'],
	stylistic.configs['recommended'],
	eslintPluginBetterTailwindcss.configs['recommended'],
	eslintPluginUnicorn.configs.recommended,
	deMorgan.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
	},
	{
		files: [
			'**/*.svelte',
			'*.svelte',
			'**/*.svelte.js',
			'*.svelte.js',
			'**/*.svelte.ts',
			'*.svelte.ts',
		],
		languageOptions: {
			parserOptions: {
				parser,
			},
		},
	},
	{
		settings: {
			'better-tailwindcss': {
				entryPoint: 'src/app.css',
			},
		},
		rules: {
			// Stylistic
			'@stylistic/semi': ['error', 'never'],
			'@stylistic/indent': ['error', 'tab'],
			'@stylistic/no-tabs': 'off',
			'@stylistic/comma-dangle': 'warn',
			'@stylistic/no-trailing-spaces': 'warn',
			'@stylistic/spaced-comment': 'off',
			'@stylistic/no-multiple-empty-lines': ['warn', { max: 2 }],
			'@stylistic/indent-binary-ops': 'off',
			'@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
			'@stylistic/operator-linebreak': 'off',

			// TypeScript
			'@typescript-eslint/no-unused-vars': ['warn', {
				args: 'all',
				argsIgnorePattern: '^_',
				caughtErrors: 'all',
				caughtErrorsIgnorePattern: '^_',
				destructuredArrayIgnorePattern: '^_',
				varsIgnorePattern: '^_',
				ignoreRestSiblings: true,
			}],
			'@typescript-eslint/no-explicit-any': 'off',

			// Svelte
			'svelte/require-each-key': 'warn',
			'svelte/no-unnecessary-state-wrap': 'off',
			'svelte/no-navigation-without-resolve': 'off',

			// Unicorn
			'unicorn/filename-case': 'off',
			'unicorn/no-null': 'off',
			'unicorn/no-array-callback-reference': 'off',
			'unicorn/no-array-for-each': 'off',
			'unicorn/no-array-reduce': 'off',
			'unicorn/no-for-loop': 'off',
			'unicorn/throw-new-error': 'off',
			'unicorn/isolated-functions': 'off',
			'unicorn/prefer-switch': 'off',
			'unicorn/prefer-ternary': 'off',
			'unicorn/no-useless-switch-case': 'off',
			'unicorn/numeric-separators-style': 'off',
			'unicorn/no-zero-fractions': 'warn',
			'unicorn/better-regex': 'error',
			'unicorn/no-negated-condition': 'error',
			'unicorn/no-useless-undefined': ['error', {
				checkArguments: false,
				checkArrowFunctionBody: false,
			}],
			'unicorn/switch-case-braces': ['error', 'avoid'],
			'unicorn/prevent-abbreviations': [
				'warn',
				{
					ignore: [
						'props',
						'num',
						'params',
						'param',
						'db',
						'tx',
						'util',
						'defs',
						'env',
						'args',
						'arg',
						'Arg',
						'src',
						/Props$/,
						/ref$/i,
					],
				},
			],

			// Array helpers (recommended with no-useless-undefined)
			'array-callback-return': ['error', { allowImplicit: true }],
			'getter-return': ['error', { allowImplicit: true }],

			// Local
			'local/no-cn-static-only': 'warn',
			'local/prefer-derived-by': 'warn',
			'local/prefer-cn-for-dynamic-classes': 'warn',
			'local/no-console-server': 'error',
			'local/no-db-import-in-routes': 'error',
			'local/no-spread-state-array': 'warn',
			'local/no-inline-import-type': 'warn',
			'local/prefer-style-directive': 'warn',
			'local/no-onclick-disabled-guard': 'warn',
			'local/no-dynamic-tailwind-class': 'error',
			'local/no-px-arbitrary-tailwind': 'warn',

			// Built-in restrictions
			'no-restricted-globals': ['error', {
				name: 'alert',
				message: 'Use a notification or dialog component instead.',
			}, {
				name: 'confirm',
				message: 'Use ConfirmDialog from $lib/components/ui/ instead.',
			}],

			// Tailwind
			'better-tailwindcss/enforce-consistent-line-wrapping': ['warn', {
				printWidth: 160,
				classesPerLine: 0,
				preferSingleLine: true,
				indent: 'tab',
				lineBreakStyle: 'windows',
				strictness: 'loose',
			}],
			'better-tailwindcss/enforce-consistent-class-order': ['warn', {
				order: 'strict',
			}],
			'better-tailwindcss/enforce-shorthand-classes': 'error',
			'better-tailwindcss/no-deprecated-classes': 'error',
			'better-tailwindcss/no-unknown-classes': 'off',
			'better-tailwindcss/enforce-consistent-variable-syntax': 'off',
		},
	},
)
