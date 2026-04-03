<script lang="ts">
	import type { PageData } from './$types.js'
	import { page } from '$app/stores'
	import { invalidateAll } from '$app/navigation'
	import { goto } from '$app/navigation'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import LanguageBadge from '$lib/components/wordbook/LanguageBadge.svelte'
	import TagPill from '$lib/components/wordbook/TagPill.svelte'
	import EtymologySection from '$lib/components/wordbook/EtymologySection.svelte'
	import InflectionTable from '$lib/components/wordbook/InflectionTable.svelte'
	import InflectionEditor from '$lib/components/wordbook/InflectionEditor.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import Badge from '$lib/components/ui/Badge.svelte'
	import { PARTS_OF_SPEECH, POS_COLORS } from '$lib/components/wordbook/constants.js'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple'
	import Trash from 'phosphor-svelte/lib/Trash'
	import { wordbookWordBreadcrumbs } from '$lib/utils/breadcrumbs.js'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const layoutData = $derived($page.data)

	createKnowContext({
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		calendarDate: layoutData.calendarDate ?? null,
	})
	const permissions = $derived(layoutData.permissions)
	const isAuthenticated = $derived(permissions.isAuthenticated)
	const canManageWordbook = $derived(permissions.canManageWordbook)
	const isAdmin = $derived(layoutData.isAdmin)
	const wbName = $derived(layoutData.siteConfig?.wordbookName ?? 'Wordbook')

	// Add sense form state
	let addingSenseFor = $state<number | null>(null)
	let newPos = $state('')
	let newDef = $state('')
	let newUsage = $state('')
	let newTranslation = $state('')
	let submittingSense = $state(false)
	let senseError = $state('')

	async function addSense(entryId: number, e: Event) {
		e.preventDefault()
		if (!newDef.trim()) return
		submittingSense = true
		senseError = ''
		try {
			const res = await fetch(`/api/wordbook/${entryId}/definitions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					partOfSpeech: newPos || null,
					definition: newDef.trim(),
					usageExample: newUsage.trim() || null,
					usageTranslation: newTranslation.trim() || null,
				}),
			})
			if (res.ok) {
				pushSuccess('Definition added')
				newPos = ''; newDef = ''; newUsage = ''; newTranslation = ''
				addingSenseFor = null
				invalidateAll()
			} else {
				const err = await res.json().catch(() => null)
				senseError = err?.error || 'Failed to add definition'
				pushError(senseError)
			}
		} finally {
			submittingSense = false
		}
	}

	async function deleteSense(entryId: number, defId: number) {
		const ok = await confirmDialog.confirm('Delete definition', 'Delete this definition?', 'Delete', 'Cancel')
		if (!ok) return
		const res = await fetch(`/api/wordbook/${entryId}/definitions/${defId}`, { method: 'DELETE' })
		if (res.ok) {
			pushSuccess('Definition deleted')
			invalidateAll()
		} else {
			pushError('Failed to delete definition')
		}
	}

	async function deleteEntry(entryId: number) {
		const ok = await confirmDialog.confirm('Delete word', `Delete "${data.word}"? This cannot be undone.`, 'Delete', 'Cancel')
		if (!ok) return
		const res = await fetch(`/api/wordbook/${entryId}`, { method: 'DELETE' })
		if (res.ok) {
			pushSuccess(`"${data.word}" deleted`)
			goto(`/wordbook/${data.language.slug}`)
		} else {
			pushError('Failed to delete word')
		}
	}

	const posColors = POS_COLORS

	const firstDef = $derived(data.homographs[0]?.definitions[0]?.definition ?? '')
	const ogDescription = $derived(firstDef ? `${data.word} — ${firstDef}` : `${data.word} in ${data.language.name}`)
	const pageUrl = $derived($page.url.href)
</script>

<svelte:head>
	<title>{data.word} ({data.language.name}) — Wordbook — KnowThing</title>
	<meta name="description" content={ogDescription} />
	<meta property="og:title" content="{data.word} ({data.language.name})" />
	<meta property="og:description" content={ogDescription} />
	<meta property="og:type" content="article" />
	<meta property="og:url" content={pageUrl} />
</svelte:head>

<ArticleShell
	breadcrumbs={wordbookWordBreadcrumbs(wbName, data.language, data.word)}
	title={data.word}
>
	{#snippet actions()}
		{#if canManageWordbook && data.homographs[0]}
			<a href="/wordbook/contribute/{data.homographs[0].entry.id}" class="text-link font-medium transition-colors flex items-center gap-1 hover:text-link-hover"><PencilSimple size={14} weight="fill" />Edit</a>
			{#if isAdmin}
				<button onclick={() => deleteEntry(data.homographs[0].entry.id)} class="text-error transition-colors flex items-center gap-1 hover:text-error-hover"><Trash size={14} weight="fill" />Delete</button>
			{/if}
		{:else if isAuthenticated}
			<span class="text-faint text-sm">View only. Editor role required for wordbook changes.</span>
		{/if}
	{/snippet}

	{#snippet badges()}
		<div class="flex items-center gap-2 mt-1">
			<LanguageBadge name={data.language.name} slug={data.language.slug} color={data.language.color} />
			{#if data.homographs[0]?.entry.pronunciation}
				<span class="text-faint font-mono text-sm">{data.homographs[0].entry.pronunciation}</span>
			{/if}
		</div>
	{/snippet}

	{#each data.homographs as hom, homIndex}
		{@const entry = hom.entry}
		{@const defs = hom.definitions}
		{@const variants = hom.variants}
		{@const relations = hom.relations}

		<!-- Headword card -->
		<div class="bg-raised border border-border-subtle overflow-hidden mb-4 {homIndex > 0 ? 'mt-6' : ''}">
			<div class="p-4">
				{#if data.isMultipleHomographs}
					<h2 class="text-lg font-bold text-heading mb-2">
						{data.word}<sup class="text-sm text-faint ml-0.5">{entry.homographNumber}</sup>
					</h2>
				{/if}

				<!-- Dialect variants -->
				{#if variants.length > 0}
					<div class="mb-3 space-y-0.5">
						{#each variants as variant}
							<div class="flex items-baseline gap-2 text-sm">
								<span class="text-dim min-w-24 text-xs font-medium">{variant.dialectName}:</span>
								{#if variant.pronunciation}
									<span class="text-faint font-mono text-xs">{variant.pronunciation}</span>
								{/if}
								{#if variant.spelling}
									<span class="text-secondary italic">"{variant.spelling}"</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				<!-- Definitions -->
				<div class="divide-y divide-border-subtle">
					{#each defs as def, index}
						<div class="py-3 group first:pt-0">
							<div class="flex items-baseline gap-2 mb-1">
								{#if defs.length > 1}
									<span class="text-xs font-bold text-faint">{index + 1}.</span>
								{/if}
								{#if def.partOfSpeech}
									<Badge class={posColors[def.partOfSpeech] || ''}>{def.partOfSpeech}</Badge>
								{/if}
								{#if canManageWordbook && defs.length > 1}
									<button onclick={() => deleteSense(entry.id, def.id)} class="text-error text-xs opacity-0 transition-opacity ml-auto hover:text-error-hover group-hover:opacity-100">×</button>
								{/if}
							</div>
							<p class="text-body"><InlineMarkup text={def.definition} /></p>
							{#if def.usageExample}
								<div class="mt-2 pl-3 border-l-2 border-border-subtle">
									<p class="text-sm italic text-secondary">{def.usageExample}</p>
									{#if def.usageTranslation}
										<p class="text-sm text-dim mt-0.5">{def.usageTranslation}</p>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Add sense -->
				{#if canManageWordbook}
					{#if addingSenseFor === entry.id}
						<form onsubmit={e => addSense(entry.id, e)} class="mt-3 p-3 bg-page border border-border-subtle space-y-2">
							{#if senseError}
								<div class="p-2 bg-error-bg border border-error-border text-error text-xs">{senseError}</div>
							{/if}
							<div class="flex gap-2">
								<Select
									type="single"
									bind:value={newPos}
									placeholder="Part of speech"
									size="sm"
									items={PARTS_OF_SPEECH.map(pos => ({ value: pos, label: pos }))}
								/>
								<Input bind:value={newDef} placeholder="Definition..." required containerClass="flex-1" />
							</div>
							<div class="flex gap-2">
								<Input bind:value={newUsage} placeholder="Usage example" containerClass="flex-1" />
								<Input bind:value={newTranslation} placeholder="Translation" containerClass="flex-1" />
							</div>
							<div class="flex gap-2">
								<button type="submit" disabled={submittingSense} class="px-3 py-1.5 bg-accent text-surface text-sm hover:bg-accent-hover disabled:opacity-50">Add</button>
								<button type="button" onclick={() => addingSenseFor = null} class="text-xs text-faint hover:text-secondary">Cancel</button>
							</div>
						</form>
					{:else}
						<button onclick={() => addingSenseFor = entry.id} class="mt-3 text-sm text-link hover:text-link-hover hover:underline">+ Add definition</button>
					{/if}
				{/if}

				<!-- Inflection table -->
				<InflectionTable
					dimensions={hom.inflection.dimensions}
					forms={hom.inflection.forms}
					overrides={hom.inflection.overrides}
					className={hom.inflection.className}
					stem={hom.inflection.stem}
					hasInflection={hom.inflection.hasInflection}
				/>
				{#if canManageWordbook}
					<InflectionEditor
						entryId={entry.id}
						languageSlug={data.language.slug}
						partOfSpeech={hom.definitions[0]?.partOfSpeech || ''}
						inflection={hom.inflection}
						availableClasses={data.availableClasses}
					/>
				{/if}

				<!-- Tags -->
				{#if entry.tags && entry.tags.length > 0}
					<div class="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-border-subtle">
						{#each entry.tags as tag}
							<TagPill {tag} language={data.language.slug} />
						{/each}
					</div>
				{/if}

				<!-- Wiki link -->
				{#if entry.pageSlug}
					<div class="mt-3 pt-3 border-t border-border-subtle">
						<a href="/know/{entry.pageSlug}" class="text-sm text-link hover:text-link-hover hover:underline">
							See also: {entry.pageSlug.replaceAll('_', ' ')} →
						</a>
					</div>
				{/if}
			</div>
		</div>

		<!-- Etymology -->
		{#if relations.direct || relations.cognates?.length || relations.etymologyChain?.length || entry.etymology}
			<div class="bg-raised border border-border-subtle p-4 mb-4">
				<EtymologySection
					entryId={entry.id}
					direct={relations.direct}
					cognates={relations.cognates}
					etymologyChain={relations.etymologyChain}
					narrativeEtymology={entry.etymology || ''}
					{isAuthenticated}
				/>
			</div>
		{/if}
	{/each}
</ArticleShell>

<ConfirmDialog bind:this={confirmDialog} />
