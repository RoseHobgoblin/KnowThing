<script lang="ts">
	let {
		languageSlug,
		dimensions = [],
		classes = [],
		canEdit = false,
	}: {
		languageSlug: string
		dimensions: Array<{ id: number, partOfSpeech: string, name: string, dimValues: string[], sortOrder: number }>
		classes: Array<{ id: number, partOfSpeech: string, name: string, description: string | null }>
		canEdit?: boolean
	} = $props()

	const grouped = $derived.by(() => {
		const order: string[] = []
		const groups: Record<string, { dims: typeof dimensions, classes: typeof classes }> = {}
		function ensure(pos: string) {
			if (!(pos in groups)) {
				groups[pos] = { dims: [], classes: [] }
				order.push(pos)
			}
			return groups[pos]
		}
		for (const d of dimensions) ensure(d.partOfSpeech).dims.push(d)
		for (const c of classes) ensure(c.partOfSpeech).classes.push(c)
		return order.map(pos => [pos, groups[pos]] as const)
	})
</script>

<div class="bg-surface border border-border p-4">
	<div class="flex items-center justify-between mb-3">
		<h3 class="text-sm font-semibold text-body">Inflection System</h3>
		{#if canEdit}
			<a
				href="/Wordbook/contribute/language/{languageSlug}?tab=inflections"
				class="text-xs text-link hover:text-link-hover hover:underline"
			>Edit</a>
		{/if}
	</div>

	{#if grouped.length === 0}
		<p class="text-xs text-faint">
			No inflection dimensions defined yet.
			{#if canEdit}
				<a href="/Wordbook/contribute/language/{languageSlug}?tab=inflections" class="text-link hover:underline">Set one up</a>
				to enable declension/conjugation tables.
			{/if}
		</p>
	{:else}
		<div class="space-y-3">
			{#each grouped as [pos, group] (pos)}
				<div>
					<div class="text-xs font-semibold text-dim uppercase tracking-wide mb-1">{pos}</div>
					{#if group.dims.length > 0}
						<div class="space-y-0.5 mb-1">
							{#each group.dims as dim (dim.id)}
								<div class="flex items-center gap-2 text-sm">
									<span class="font-medium text-secondary">{dim.name}</span>
									<span class="text-faint text-xs">[{dim.dimValues.join(', ')}]</span>
								</div>
							{/each}
						</div>
					{/if}
					{#if group.classes.length > 0}
						<div class="ml-2 space-y-0.5">
							{#each group.classes as cls (cls.id)}
								<div class="flex items-center gap-2 text-sm">
									<span class="text-link">{cls.name}</span>
									{#if cls.description}
										<span class="text-faint text-xs">— {cls.description}</span>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
