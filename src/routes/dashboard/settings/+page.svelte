<script lang="ts">
	import type { PageData } from './$types.js'
	import Input from '$lib/components/ui/Input.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { invalidateAll } from '$app/navigation'

	let { data }: { data: PageData } = $props()

	let siteName = $state(data.settings.site_name ?? 'KnowThing')
	let siteTagline = $state(data.settings.site_tagline ?? 'A collaborative encyclopedia')
	let institutionName = $state(data.settings.institution_name ?? '')
	let footerText = $state(data.settings.footer_text ?? '')
	let logoUrl = $state(data.settings.logo_url ?? '')
	let textDirection = $state(data.settings.text_direction ?? 'ltr')

	let navWikiLabel = $state(data.settings.nav_wiki_label ?? 'Main Page')
	let navCreateLabel = $state(data.settings.nav_create_label ?? 'Create')
	let navWordbookLabel = $state(data.settings.nav_wordbook_label ?? 'Wordbook')
	let navCalendarLabel = $state(data.settings.nav_calendar_label ?? 'Calendar')
	let navSearchLabel = $state(data.settings.nav_search_label ?? 'Search')

	let wordbookName = $state(data.settings.wordbook_name ?? 'Wordbook')
	let wordbookEnabled = $state(data.settings.wordbook_enabled !== 'false')
	let calendarEnabled = $state(data.settings.calendar_enabled !== 'false')

	let saving = $state(false)

	async function save() {
		saving = true
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
				nav_search_label: navSearchLabel,
				wordbook_name: wordbookName,
				wordbook_enabled: String(wordbookEnabled),
				calendar_enabled: String(calendarEnabled),
			}),
		})
		if (response.ok) {
			pushSuccess('Settings saved')
			invalidateAll()
		} else {
			pushError('Failed to save settings')
		}
		saving = false
	}
</script>

<svelte:head>
	<title>Site Settings — Dashboard — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-bold text-heading">Site Settings</h1>
		<button onclick={save} disabled={saving} class="
			px-5 py-2 bg-accent text-surface text-sm font-medium transition-colors
			hover:bg-accent-hover disabled:opacity-50
		">
			{saving ? 'Saving...' : 'Save changes'}
		</button>
	</div>

	<!-- Identity -->
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

	<!-- Navigation Labels -->
	<section class="bg-surface border border-border p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">Navigation Labels</h2>
			<p class="text-xs text-faint mt-0.5">Customise what the nav bar links are called.</p>
		</div>
		<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
			<Input label="Main page" bind:value={navWikiLabel} placeholder="Main Page" />
			<Input label="Create page" bind:value={navCreateLabel} placeholder="Create" />
			<Input label="Search" bind:value={navSearchLabel} placeholder="Search" />
			<Input label="Wordbook" bind:value={navWordbookLabel} placeholder="Wordbook" />
			<Input label="Calendar" bind:value={navCalendarLabel} placeholder="Calendar" />
			<Input label="Wordbook display name" bind:value={wordbookName} placeholder="Wordbook" />
		</div>
	</section>

	<!-- Features -->
	<section class="bg-surface border border-border p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">Features</h2>
			<p class="text-xs text-faint mt-0.5">Toggle site features on or off.</p>
		</div>
		<div class="flex flex-col gap-3">
			<label class="flex items-center gap-3 cursor-pointer">
				<input type="checkbox" bind:checked={wordbookEnabled} class="accent-accent" />
				<div>
					<span class="text-sm font-medium text-body">Wordbook</span>
					<p class="text-xs text-faint">Multilingual dictionary and linguistic database</p>
				</div>
			</label>
			<label class="flex items-center gap-3 cursor-pointer">
				<input type="checkbox" bind:checked={calendarEnabled} class="accent-accent" />
				<div>
					<span class="text-sm font-medium text-body">Calendar</span>
					<p class="text-xs text-faint">Custom calendar system with moons, eras, and seasons</p>
				</div>
			</label>
		</div>
	</section>

	<!-- Display -->
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
			<div>
				<Input label="Custom footer text" bind:value={footerText} placeholder="Leave blank for default (site name — tagline)" />
			</div>
		</div>
	</section>
</div>
