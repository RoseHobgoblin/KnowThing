<script lang="ts">
	import { cn } from '$lib/utils'
	import { m } from '$lib/paraglide/messages.js'

	let { compact = false }: { compact?: boolean } = $props()

	type Variant = {
		label: string
		dimensions: Array<{ pos: string, name: string, values: string[] }>
		className: string
		rules: Array<{ cell: string, pattern: string }>
		stem: string
		applied: Array<{ cell: string, form: string }>
		irregular: { word: string, cell: string, expected: string, actual: string }
	}

	const english: Variant = {
		label: 'English',
		dimensions: [
			{ pos: 'noun', name: 'Number', values: ['singular', 'plural'] },
		],
		className: 'Regular noun',
		rules: [
			{ cell: 'singular', pattern: '{stem}' },
			{ cell: 'plural', pattern: '{stem}s' },
		],
		stem: 'cat',
		applied: [
			{ cell: 'singular', form: 'cat' },
			{ cell: 'plural', form: 'cats' },
		],
		irregular: { word: 'mouse', cell: 'plural', expected: 'mouses', actual: 'mice' },
	}

	const conlang: Variant = {
		label: 'Conlang (Vesh)',
		dimensions: [
			{ pos: 'noun', name: 'Case', values: ['direct', 'oblique'] },
			{ pos: 'noun', name: 'Number', values: ['sg', 'pl'] },
		],
		className: 'Vowel-stem nouns',
		rules: [
			{ cell: 'direct · sg', pattern: '{stem}' },
			{ cell: 'direct · pl', pattern: '{stem}-en' },
			{ cell: 'oblique · sg', pattern: '{stem}-i' },
			{ cell: 'oblique · pl', pattern: '{stem}-eni' },
		],
		stem: 'mara',
		applied: [
			{ cell: 'direct · sg', form: 'mara' },
			{ cell: 'direct · pl', form: 'mara-en' },
			{ cell: 'oblique · sg', form: 'mara-i' },
			{ cell: 'oblique · pl', form: 'mara-eni' },
		],
		irregular: { word: 'kor', cell: 'direct · pl', expected: 'kor-en', actual: 'koren-' },
	}

	let mode = $state<'real' | 'conlang'>('real')
	const variant = $derived(mode === 'real' ? english : conlang)
</script>

<div class="bg-page text-xs text-secondary p-3 space-y-3">
	<div class="flex items-center justify-between gap-2">
		<span class="text-xs font-semibold text-dim uppercase tracking-wide">{m.wbc_worked_example()}</span>
		<div class="inline-flex bg-surface text-xs">
			<button
				type="button"
				onclick={() => mode = 'real'}
				class={cn('px-2 py-0.5 transition-colors', mode === 'real' ? 'bg-accent text-surface' : 'text-secondary hover:text-link')}
			>{m.wbc_worked_english()}</button>
			<button
				type="button"
				onclick={() => mode = 'conlang'}
				class={cn('px-2 py-0.5 transition-colors', mode === 'conlang' ? 'bg-accent text-surface' : 'text-secondary hover:text-link')}
			>{m.wbc_worked_conlang()}</button>
		</div>
	</div>

	{#if compact}
		<div class="space-y-1">
			<div>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- localized static markup, not user input -->
				{@html m.wbc_worked_with_class_stem({ className: variant.className, stem: variant.stem })}
			</div>
			<div class="font-mono text-secondary">
				{#each variant.applied as cell, index (cell.cell)}{index > 0 ? ' · ' : ''}{cell.form}{/each}
			</div>
			<div class="text-secondary pt-1">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- localized static markup, not user input -->
				{@html m.wbc_worked_irregular_note({ word: variant.irregular.word, cell: variant.irregular.cell, actual: variant.irregular.actual, expected: variant.irregular.expected })}
			</div>
		</div>
	{:else}
		<div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
			<div class="font-semibold text-dim">{m.wbc_step_dimension()}</div>
			<div>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- localized static markup, not user input -->
				{#each variant.dimensions as dim, index (dim.name)}{index > 0 ? ', ' : ''}<strong>{dim.name}</strong> = [{dim.values.join(', ')}] {@html m.wbc_worked_for_pos({ pos: dim.pos })}{/each}
			</div>

			<div class="font-semibold text-dim">{m.wbc_step_class()}</div>
			<div><strong>{variant.className}</strong> — {m.wbc_worked_class_desc()}</div>

			<div class="font-semibold text-dim">{m.wbc_step_rules()}</div>
			<div class="space-y-0.5">
				{#each variant.rules as rule (rule.cell)}
					<div class="font-mono text-xs"><span class="text-secondary">{rule.cell}:</span> {rule.pattern}</div>
				{/each}
			</div>

			<div class="font-semibold text-dim">{m.wbc_step_applied()}</div>
			<div>
				{m.wbc_stem()} <code class="bg-surface-dim px-1 rounded-sm font-mono">{variant.stem}</code> →
				<span class="font-mono">{#each variant.applied as cell, index (cell.cell)}{index > 0 ? ', ' : ''}{cell.form}{/each}</span>
			</div>
		</div>

		<div class="pt-2 border-t border-border-subtle text-secondary">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- localized static markup, not user input -->
			{@html m.wbc_worked_override_note({ word: variant.irregular.word, actual: variant.irregular.actual, expected: variant.irregular.expected })}
		</div>
	{/if}
</div>
