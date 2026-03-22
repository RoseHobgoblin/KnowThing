<script lang="ts">
	let {
		initial = {},
		existingLanguages = [],
		onsubmit,
		submitLabel = 'Save',
	}: {
		initial?: {
			name?: string
			slug?: string
			nativeName?: string
			script?: string
			family?: string
			color?: string
			description?: string
			pageSlug?: string
			parentLanguageId?: number | null
			languageType?: string
		}
		existingLanguages: Array<{ id: number, name: string }>
		onsubmit: (data: Record<string, unknown>) => Promise<void>
		submitLabel?: string
	} = $props()

	const isEditing = !!initial.name

	let name = $state(initial.name || '')
	let slug = $state(initial.slug || '')
	let nativeName = $state(initial.nativeName || '')
	let script = $state(initial.script || 'Latin')
	let family = $state(initial.family || '')
	let color = $state(initial.color || '#d97706')
	let description = $state(initial.description || '')
	let pageSlug = $state(initial.pageSlug || '')
	let parentLanguageId = $state<number | null>(initial.parentLanguageId ?? null)
	let languageType = $state(initial.languageType || 'language')
	let submitting = $state(false)
	let error = $state('')

	// Auto-generate slug from name (only when creating)
	function updateSlug() {
		if (isEditing) return
		if (!slug || slug === slugify(name.slice(0, -1))) {
			slug = slugify(name)
		}
	}

	function slugify(s: string): string {
		return s.toLowerCase().normalize('NFC').replaceAll(/[^\p{L}\p{N}]+/gu, '-').replaceAll(/^-|-$/g, '')
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault()
		if (!name.trim()) { error = 'Name is required'; return }
		if (!isEditing && !slug.trim()) { error = 'Slug is required'; return }

		error = ''
		submitting = true
		try {
			await onsubmit({
				name: name.trim(),
				slug: slug.trim(),
				nativeName: nativeName.trim() || null,
				script: script.trim() || 'Latin',
				family: family.trim() || null,
				color: color || '#d97706',
				description: description.trim() || null,
				pageSlug: pageSlug.trim() || null,
				parentLanguageId: parentLanguageId || null,
				languageType,
			})
		} catch (error_: any) {
			error = error_.message
		} finally {
			submitting = false
		}
	}

	const inputClass = 'w-full px-3 py-2 border border-border-strong rounded-lg text-sm bg-surface text-heading focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent-border'
	const labelClass = 'block text-sm font-medium text-secondary mb-1'
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	{#if error}
		<div class="p-3 bg-red-50 border border-red-200 text-error rounded-lg text-sm">{error}</div>
	{/if}

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<div>
			<label for="name" class={labelClass}>Name <span class="text-red-500">*</span></label>
			<input id="name" type="text" bind:value={name} oninput={updateSlug} required class={inputClass} placeholder="Oncheran" />
		</div>
		{#if !isEditing}
			<div>
				<label for="slug" class={labelClass}>Slug <span class="text-red-500">*</span></label>
				<input id="slug" type="text" bind:value={slug} required class={inputClass} placeholder="oncheran" />
			</div>
		{/if}
		<div>
			<label for="native" class={labelClass}>Native Name</label>
			<input id="native" type="text" bind:value={nativeName} class={inputClass} placeholder="Ontsserako" />
		</div>
		<div>
			<label for="parent" class={labelClass}>Parent Language</label>
			<select id="parent" bind:value={parentLanguageId} class={inputClass}>
				<option value={null}>None (root language)</option>
				{#each existingLanguages as lang}
					<option value={lang.id}>{lang.name}</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="type" class={labelClass}>Type</label>
			<select id="type" bind:value={languageType} class={inputClass}>
				<option value="language">Language</option>
				<option value="proto">Proto / Reconstructed</option>
				<option value="historical">Historical</option>
			</select>
		</div>
		<div>
			<label for="family" class={labelClass}>
				Family
				{#if languageType === 'proto'}
					<span class="text-red-500">*</span>
				{:else}
					<span class="text-xs text-faint">(inherits from parent)</span>
				{/if}
			</label>
			<input id="family" type="text" bind:value={family} class={inputClass}
				required={languageType === 'proto'}
				placeholder={languageType === 'proto' ? 'e.g. Mirish' : 'Leave blank to inherit'} />
		</div>
		<div>
			<label for="script" class={labelClass}>Script</label>
			<input id="script" type="text" bind:value={script} class={inputClass} placeholder="Latin" />
		</div>
		<div>
			<label for="color" class={labelClass}>Accent Color</label>
			<div class="flex gap-2 items-center">
				<input id="color" type="color" bind:value={color} class="size-10 rounded-sm border border-border-strong cursor-pointer" />
				<input type="text" bind:value={color} class={inputClass} placeholder="#d97706" />
			</div>
		</div>
	</div>

	<div>
		<label for="pageSlug" class={labelClass}>Wiki Article <span class="text-xs text-faint">(slug)</span></label>
		<input id="pageSlug" type="text" bind:value={pageSlug} class={inputClass} placeholder="oncheran_language" />
	</div>

	<div>
		<label for="desc" class={labelClass}>Description</label>
		<textarea id="desc" bind:value={description} rows={3} class={inputClass} placeholder="A brief description of this language..."></textarea>
	</div>

	<div class="pt-2">
		<button type="submit" disabled={submitting} class="
			px-6 py-2.5 bg-accent text-surface rounded-lg font-medium transition-colors
			hover:bg-accent-hover disabled:opacity-50
		">
			{submitting ? 'Saving...' : submitLabel}
		</button>
	</div>
</form>
