<script lang="ts">
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

<div class="bg-page border border-border-subtle text-xs text-secondary p-3 space-y-3">
	<div class="flex items-center justify-between gap-2">
		<span class="text-xs font-semibold text-dim uppercase tracking-wide">Worked example</span>
		<div class="inline-flex border border-border-subtle bg-surface text-xs">
			<button
				type="button"
				onclick={() => mode = 'real'}
				class="px-2 py-0.5 transition-colors {mode === 'real' ? 'bg-accent text-surface' : 'text-faint hover:text-link'}"
			>English</button>
			<button
				type="button"
				onclick={() => mode = 'conlang'}
				class="px-2 py-0.5 transition-colors {mode === 'conlang' ? 'bg-accent text-surface' : 'text-faint hover:text-link'}"
			>Conlang</button>
		</div>
	</div>

	{#if compact}
		<div class="space-y-1">
			<div>
				With class <strong>{variant.className}</strong> and stem <code class="bg-surface-dim px-1 rounded-sm font-mono">{variant.stem}</code>, the rules generate:
			</div>
			<div class="font-mono text-faint">
				{#each variant.applied as cell, i (cell.cell)}{i > 0 ? ' · ' : ''}{cell.form}{/each}
			</div>
			<div class="text-faint pt-1">
				If <em>{variant.irregular.word}</em>'s {variant.irregular.cell} is irregular (<code class="bg-surface-dim px-1 rounded-sm font-mono">{variant.irregular.actual}</code> instead of <code class="bg-surface-dim px-1 rounded-sm font-mono">{variant.irregular.expected}</code>), set it as an override.
			</div>
		</div>
	{:else}
		<div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
			<div class="font-semibold text-dim">1. Dimension</div>
			<div>
				{#each variant.dimensions as dim, i (dim.name)}{i > 0 ? ', ' : ''}<strong>{dim.name}</strong> = [{dim.values.join(', ')}] (for <em>{dim.pos}</em>){/each}
			</div>

			<div class="font-semibold text-dim">2. Class</div>
			<div><strong>{variant.className}</strong> — groups every word that inflects this way</div>

			<div class="font-semibold text-dim">3. Rules</div>
			<div class="space-y-0.5">
				{#each variant.rules as rule (rule.cell)}
					<div class="font-mono text-xs"><span class="text-faint">{rule.cell}:</span> {rule.pattern}</div>
				{/each}
			</div>

			<div class="font-semibold text-dim">4. Applied</div>
			<div>
				Stem <code class="bg-surface-dim px-1 rounded-sm font-mono">{variant.stem}</code> →
				<span class="font-mono">{#each variant.applied as cell, i (cell.cell)}{i > 0 ? ', ' : ''}{cell.form}{/each}</span>
			</div>
		</div>

		<div class="pt-2 border-t border-border-subtle text-faint">
			<strong>Override</strong> a single cell when a word breaks the rule — e.g. plural of <em>{variant.irregular.word}</em> is <code class="bg-surface-dim px-1 rounded-sm font-mono">{variant.irregular.actual}</code>, not the expected <code class="bg-surface-dim px-1 rounded-sm font-mono">{variant.irregular.expected}</code>.
		</div>
	{/if}
</div>
