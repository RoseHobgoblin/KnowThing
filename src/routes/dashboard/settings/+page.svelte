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
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { m } from '$lib/paraglide/messages.js'

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
	let stripExifOnUpload = $state(initialSettings.strip_exif_on_upload !== 'false')

	let saveError = $state('')
	let savedAt = $state<Date | null>(null)
	const saveMutation = createMutation(() => ({
		mutationFn: (body: Record<string, string>) => api('PUT', '/api/settings', body),
	}))
	const saving = $derived(saveMutation.isPending)

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
			stripExifOnUpload,
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
		stripExifOnUpload = initialSettings.strip_exif_on_upload !== 'false'
		saveError = ''
	}

	async function save() {
		saveError = ''
		try {
			await saveMutation.mutateAsync({
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
				strip_exif_on_upload: String(stripExifOnUpload),
			})
			savedSnapshot = currentSnapshot
			savedAt = new Date()
			pushSuccess(m.settings_saved_toast())
			await invalidateAll()
		} catch (error) {
			saveError = error instanceof Error ? error.message : m.settings_save_failed()
			pushError(saveError)
		}
	}
</script>

<svelte:head>
	<title>{m.settings_page_title()}</title>
</svelte:head>

<UnsavedChangesGuard when={isDirty && !saving} />

<div class="space-y-6">
	<RecordModeBanner
		modeLabel={m.settings_mode_label()}
		title={m.settings_title()}
		description={m.settings_description()}
	/>

	{#if saveError}
		<FormNotice title={m.settings_not_saved()} message={saveError} />
	{/if}

	<section class="bg-surface p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">{m.settings_identity()}</h2>
			<p class="text-xs text-secondary mt-0.5">{m.settings_identity_desc()}</p>
		</div>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<Input label={m.settings_site_name()} bind:value={siteName} placeholder={m.settings_site_name_placeholder()} />
			<Input label={m.settings_tagline()} bind:value={siteTagline} placeholder={m.settings_tagline_placeholder()} />
			<Input label={m.settings_institution_name()} bind:value={institutionName} placeholder={m.settings_institution_placeholder()} />
			<Input label={m.settings_logo_url()} bind:value={logoUrl} placeholder={m.settings_logo_url_placeholder()} />
		</div>
	</section>

	<section class="bg-surface p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">{m.settings_nav_labels()}</h2>
			<p class="text-xs text-secondary mt-0.5">{m.settings_nav_labels_desc()}</p>
		</div>
		<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
			<Input label={m.settings_main_page()} bind:value={navWikiLabel} placeholder={m.nav_main_page()} />
			<Input label={m.settings_create_page()} bind:value={navCreateLabel} placeholder={m.nav_new_page()} />
			<Input label={m.nav_wordbook()} bind:value={navWordbookLabel} placeholder={m.nav_wordbook()} />
			<Input label={m.nav_calendar()} bind:value={navCalendarLabel} placeholder={m.nav_calendar()} />
			<Input label={m.settings_wordbook_display_name()} bind:value={wordbookName} placeholder={m.nav_wordbook()} />
		</div>
	</section>

	<section class="bg-surface p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">{m.settings_features()}</h2>
			<p class="text-xs text-secondary mt-0.5">{m.settings_features_desc()}</p>
		</div>
		<div class="flex flex-col gap-3">
			<Checkbox bind:value={wordbookEnabled} label={m.nav_wordbook()}>
				{m.settings_wordbook_feature_desc()}
			</Checkbox>
			<Checkbox bind:value={calendarEnabled} label={m.nav_calendar()}>
				{m.settings_calendar_feature_desc()}
			</Checkbox>
		</div>
	</section>

	<section class="bg-surface p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">{m.settings_media()}</h2>
			<p class="text-xs text-secondary mt-0.5">{m.settings_media_desc()}</p>
		</div>
		<div class="flex flex-col gap-3">
			<Checkbox bind:value={stripExifOnUpload} label={m.settings_strip_exif()}>
				{m.settings_strip_exif_desc()}
			</Checkbox>
		</div>
	</section>

	<section class="bg-surface p-5 space-y-4">
		<div>
			<h2 class="text-sm font-semibold text-heading">{m.settings_display()}</h2>
			<p class="text-xs text-secondary mt-0.5">{m.settings_display_desc()}</p>
		</div>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<span class="text-xs font-medium text-secondary block mb-1">{m.settings_text_direction()}</span>
				<div class="flex gap-3">
					<label class="flex items-center gap-2 text-sm text-body cursor-pointer">
						<input type="radio" bind:group={textDirection} value="ltr" class="accent-accent" />
						{m.settings_ltr()}
					</label>
					<label class="flex items-center gap-2 text-sm text-body cursor-pointer">
						<input type="radio" bind:group={textDirection} value="rtl" class="accent-accent" />
						{m.settings_rtl()}
					</label>
				</div>
			</div>
			<Input label={m.settings_footer_text()} bind:value={footerText} placeholder={m.settings_footer_text_placeholder()} />
		</div>
	</section>

	<StickyActionBar
		dirty={isDirty}
		{saving}
		error={saveError}
		{savedAt}
		onsave={save}
		ondiscard={resetDraft}
		saveLabel={m.settings_save_changes()}
	/>
</div>
