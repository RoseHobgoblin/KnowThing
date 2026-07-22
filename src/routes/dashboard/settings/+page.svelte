<script lang="ts">
	import { untrack } from 'svelte'
	import type { PageData } from './$types.js'
	import { createSpaForm } from '$lib/forms/spa-form.svelte.js'
	import Input from '$lib/components/ui/Input.svelte'
	import Checkbox from '$lib/components/ui/Checkbox.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import StickyActionBar from '$lib/components/editor/StickyActionBar.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import RecordModeBanner from '$lib/components/editor/RecordModeBanner.svelte'
	import { pushSuccess } from '$lib/notifications.svelte'
	import { invalidateAll } from '$app/navigation'
	import { api } from '$lib/api'
	import { settingsFormSchema, toSettingsPayload } from '$lib/settings/settings-form-schema.js'

	let { data }: { data: PageData } = $props()
	const initialSettings = $state.snapshot(untrack(() => data.settings))

	const initialValues = {
		siteName: initialSettings.site_name ?? 'KnowThing',
		siteTagline: initialSettings.site_tagline ?? 'A collaborative encyclopedia',
		institutionName: initialSettings.institution_name ?? '',
		footerText: initialSettings.footer_text ?? '',
		logoUrl: initialSettings.logo_url ?? '',
		textDirection: (initialSettings.text_direction ?? 'ltr') as 'ltr' | 'rtl',
		navWikiLabel: initialSettings.nav_wiki_label ?? 'Main Page',
		navCreateLabel: initialSettings.nav_create_label ?? 'Create',
		navWordbookLabel: initialSettings.nav_wordbook_label ?? 'Wordbook',
		navCalendarLabel: initialSettings.nav_calendar_label ?? 'Calendar',
		wordbookName: initialSettings.wordbook_name ?? 'Wordbook',
		wordbookEnabled: initialSettings.wordbook_enabled !== 'false',
		calendarEnabled: initialSettings.calendar_enabled !== 'false',
		stripExifOnUpload: initialSettings.strip_exif_on_upload !== 'false',
	}

	let savedAt = $state<Date | null>(null)

	const spa = createSpaForm({
		schema: settingsFormSchema,
		initial: initialValues,
		errorMessage: 'Failed to save settings',
		async onValid(data, { markClean }) {
			await api('PUT', '/api/settings', toSettingsPayload(data))
			savedAt = new Date()
			pushSuccess('Settings saved')
			markClean()
			await invalidateAll()
		},
	})
	const { form, enhance, submitting, reset, clearError } = spa

	const isDirty = $derived(spa.isDirty)
	const saving = $derived($submitting)

	function discard() {
		clearError()
		reset()
	}
</script>

<svelte:head>
	<title>Site Settings - Dashboard - KnowThing</title>
</svelte:head>

<UnsavedChangesGuard when={isDirty && !saving} />

<form method="POST" use:enhance class="space-y-6">
	<RecordModeBanner
		modeLabel="Configure Site"
		title="Site Settings"
		description="Update branding, feature toggles, and navigation labels here. These changes affect the whole application."
	/>

	{#if spa.submitError}
		<FormNotice title="Settings were not saved" message={spa.submitError} />
	{/if}

	<section class="bg-surface p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">Identity</h2>
			<p class="text-xs text-secondary mt-0.5">The name and branding of your site.</p>
		</div>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<Input label="Site name" bind:value={$form.siteName} placeholder="KnowThing" />
			<Input label="Tagline" bind:value={$form.siteTagline} placeholder="A collaborative encyclopedia" />
			<Input label="Institution name" bind:value={$form.institutionName} placeholder="e.g. University of Almisan" />
			<Input label="Logo URL" bind:value={$form.logoUrl} placeholder="/api/media/logo.png or leave blank for text" />
		</div>
	</section>

	<section class="bg-surface p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">Navigation Labels</h2>
			<p class="text-xs text-secondary mt-0.5">Customize what the nav bar links are called.</p>
		</div>
		<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
			<Input label="Main page" bind:value={$form.navWikiLabel} placeholder="Main Page" />
			<Input label="Create page" bind:value={$form.navCreateLabel} placeholder="New Page" />
			<Input label="Wordbook" bind:value={$form.navWordbookLabel} placeholder="Wordbook" />
			<Input label="Calendar" bind:value={$form.navCalendarLabel} placeholder="Calendar" />
			<Input label="Wordbook display name" bind:value={$form.wordbookName} placeholder="Wordbook" />
		</div>
	</section>

	<section class="bg-surface p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">Features</h2>
			<p class="text-xs text-secondary mt-0.5">Toggle site features on or off.</p>
		</div>
		<div class="flex flex-col gap-3">
			<Checkbox bind:value={$form.wordbookEnabled} label="Wordbook">
				Multilingual dictionary and linguistic database
			</Checkbox>
			<Checkbox bind:value={$form.calendarEnabled} label="Calendar">
				Custom calendar system with moons, eras, and seasons
			</Checkbox>
		</div>
	</section>

	<section class="bg-surface p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">Media</h2>
			<p class="text-xs text-secondary mt-0.5">How uploads are processed and what metadata is preserved.</p>
		</div>
		<div class="flex flex-col gap-3">
			<Checkbox bind:value={$form.stripExifOnUpload} label="Strip EXIF on upload">
				Remove camera, GPS, and other EXIF/IPTC/XMP metadata from uploaded photos. Privacy-preserving for any image taken on a phone. SVGs are unaffected.
			</Checkbox>
		</div>
	</section>

	<section class="bg-surface p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">Display</h2>
			<p class="text-xs text-secondary mt-0.5">Visual and layout settings.</p>
		</div>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<span class="text-xs font-medium text-secondary block mb-1">Text direction</span>
				<div class="flex gap-3">
					<label class="flex items-center gap-2 text-sm text-body cursor-pointer">
						<input type="radio" bind:group={$form.textDirection} value="ltr" class="accent-accent" />
						Left-to-right
					</label>
					<label class="flex items-center gap-2 text-sm text-body cursor-pointer">
						<input type="radio" bind:group={$form.textDirection} value="rtl" class="accent-accent" />
						Right-to-left
					</label>
				</div>
			</div>
			<Input label="Custom footer text" bind:value={$form.footerText} placeholder="Leave blank for default footer text" />
		</div>
	</section>

	<StickyActionBar
		dirty={isDirty}
		{saving}
		error={spa.submitError}
		{savedAt}
		saveType="submit"
		ondiscard={discard}
		saveLabel="Save changes"
	/>
</form>
