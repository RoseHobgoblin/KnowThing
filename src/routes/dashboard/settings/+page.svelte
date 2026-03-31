<script lang="ts">
	import { untrack } from 'svelte'
	import type { PageData } from './$types.js'
	import Input from '$lib/components/ui/Input.svelte'
	import Checkbox from '$lib/components/ui/Checkbox.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import StickyActionBar from '$lib/components/editor/StickyActionBar.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import RecordModeBanner from '$lib/components/editor/RecordModeBanner.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { invalidateAll } from '$app/navigation'

	let { data }: { data: PageData } = $props()
	const initialSettings = $state.snapshot(untrack(() => data.settings))

	let siteName = $state(initialSettings.site_name ?? 'KnowThing')
	let siteTagline = $state(initialSettings.site_tagline ?? 'A collaborative encyclopedia')
	let institutionName = $state(initialSettings.institution_name ?? '')
	let footerText = $state(initialSettings.footer_text ?? '')
	let logoUrl = $state(initialSettings.logo_url ?? '')
	let textDirection = $state(initialSettings.text_direction ?? 'ltr')

	let navWikiLabel = $state(initialSettings.nav_wiki_label ?? 'Main Page')
	let navCreateLabel = $state(initialSettings.nav_create_label ?? 'Create')
	let navWordbookLabel = $state(initialSettings.nav_wordbook_label ?? 'Wordbook')
	let navCalendarLabel = $state(initialSettings.nav_calendar_label ?? 'Calendar')

	let wordbookName = $state(initialSettings.wordbook_name ?? 'Wordbook')
	let wordbookEnabled = $state(initialSettings.wordbook_enabled !== 'false')
	let calendarEnabled = $state(initialSettings.calendar_enabled !== 'false')

	let saving = $state(false)
	let saveError = $state('')
	let savedAt = $state<Date | null>(null)

	function snapshotState() {
		return JSON.stringify({
			siteName,
			siteTagline,
			institutionName,
			footerText,
			logoUrl,
			textDirection,
			navWikiLabel,
			navCreateLabel,
			navWordbookLabel,
			navCalendarLabel,
			wordbookName,
			wordbookEnabled,
			calendarEnabled,
		})
	}

	let savedSnapshot = $state(snapshotState())
	const currentSnapshot = $derived(snapshotState())
	const isDirty = $derived(currentSnapshot !== savedSnapshot)

	function resetDraft() {
		siteName = initialSettings.site_name ?? 'KnowThing'
		siteTagline = initialSettings.site_tagline ?? 'A collaborative encyclopedia'
		institutionName = initialSettings.institution_name ?? ''
		footerText = initialSettings.footer_text ?? ''
		logoUrl = initialSettings.logo_url ?? ''
		textDirection = initialSettings.text_direction ?? 'ltr'
		navWikiLabel = initialSettings.nav_wiki_label ?? 'Main Page'
		navCreateLabel = initialSettings.nav_create_label ?? 'Create'
		navWordbookLabel = initialSettings.nav_wordbook_label ?? 'Wordbook'
		navCalendarLabel = initialSettings.nav_calendar_label ?? 'Calendar'
		wordbookName = initialSettings.wordbook_name ?? 'Wordbook'
		wordbookEnabled = initialSettings.wordbook_enabled !== 'false'
		calendarEnabled = initialSettings.calendar_enabled !== 'false'
		saveError = ''
	}

	async function save() {
		saving = true
		saveError = ''
		const response = await fetch('/api/settings', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				site_name: siteName,
				site_tagline: siteTagline,
				institution_name: institutionName,
				footer_text: footerText,
				logo_url: logoUrl,
				text_direction: textDirection,
				nav_wiki_label: navWikiLabel,
				nav_create_label: navCreateLabel,
				nav_wordbook_label: navWordbookLabel,
				nav_calendar_label: navCalendarLabel,
				wordbook_name: wordbookName,
				wordbook_enabled: String(wordbookEnabled),
				calendar_enabled: String(calendarEnabled),
			}),
		})
		if (response.ok) {
			savedSnapshot = currentSnapshot
			savedAt = new Date()
			pushSuccess('Settings saved')
			invalidateAll()
		} else {
			const body = await response.json().catch(() => ({}))
			saveError = body.error || 'Failed to save settings'
			pushError(saveError)
		}
		saving = false
	}
</script>

<svelte:head>
	<title>Site Settings - Dashboard - KnowThing</title>
</svelte:head>

<UnsavedChangesGuard when={isDirty && !saving} />

<div class="space-y-6">
	<RecordModeBanner
		modeLabel="Configure Site"
		title="Site Settings"
		description="Update branding, feature toggles, and navigation labels here. These changes affect the whole application."
	/>

	{#if saveError}
		<FormNotice title="Settings were not saved" message={saveError} />
	{/if}

	<section class="bg-surface border border-border p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">Identity</h2>
			<p class="text-xs text-faint mt-0.5">The name and branding of your site.</p>
		</div>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<Input label="Site name" bind:value={siteName} placeholder="KnowThing" />
			<Input label="Tagline" bind:value={siteTagline} placeholder="A collaborative encyclopedia" />
			<Input label="Institution name" bind:value={institutionName} placeholder="e.g. University of Almisan" />
			<Input label="Logo URL" bind:value={logoUrl} placeholder="/api/media/logo.png or leave blank for text" />
		</div>
	</section>

	<section class="bg-surface border border-border p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">Navigation Labels</h2>
			<p class="text-xs text-faint mt-0.5">Customize what the nav bar links are called.</p>
		</div>
		<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
			<Input label="Main page" bind:value={navWikiLabel} placeholder="Main Page" />
			<Input label="Create page" bind:value={navCreateLabel} placeholder="New Page" />
			<Input label="Wordbook" bind:value={navWordbookLabel} placeholder="Wordbook" />
			<Input label="Calendar" bind:value={navCalendarLabel} placeholder="Calendar" />
			<Input label="Wordbook display name" bind:value={wordbookName} placeholder="Wordbook" />
		</div>
	</section>

	<section class="bg-surface border border-border p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">Features</h2>
			<p class="text-xs text-faint mt-0.5">Toggle site features on or off.</p>
		</div>
		<div class="flex flex-col gap-3">
			<Checkbox bind:value={wordbookEnabled} label="Wordbook">
				Multilingual dictionary and linguistic database
			</Checkbox>
			<Checkbox bind:value={calendarEnabled} label="Calendar">
				Custom calendar system with moons, eras, and seasons
			</Checkbox>
		</div>
	</section>

	<section class="bg-surface border border-border p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">Display</h2>
			<p class="text-xs text-faint mt-0.5">Visual and layout settings.</p>
		</div>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<span class="text-xs font-medium text-secondary block mb-1">Text direction</span>
				<div class="flex gap-3">
					<label class="flex items-center gap-2 text-sm text-body cursor-pointer">
						<input type="radio" bind:group={textDirection} value="ltr" class="accent-accent" />
						Left-to-right
					</label>
					<label class="flex items-center gap-2 text-sm text-body cursor-pointer">
						<input type="radio" bind:group={textDirection} value="rtl" class="accent-accent" />
						Right-to-left
					</label>
				</div>
			</div>
			<Input label="Custom footer text" bind:value={footerText} placeholder="Leave blank for default footer text" />
		</div>
	</section>

	<StickyActionBar
		dirty={isDirty}
		{saving}
		error={saveError}
		{savedAt}
		onsave={save}
		ondiscard={resetDraft}
		saveLabel="Save changes"
	/>
</div>
