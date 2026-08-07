<script lang="ts">
	import { api } from '$lib/api.js'
	import Badge from '$lib/components/ui/Badge.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import Dialog from '$lib/components/ui/Dialog.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import {
		assessMediaCompatibility,
		mediaAssetContentUrl,
		mediaBindingFromItem,
		purposeLabel,
		type CelestialMediaPurpose,
		type MediaAssetBinding,
		type MediaAssetListItem,
	} from '$lib/media/asset-binding.js'
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle'
	import ImageSquare from 'phosphor-svelte/lib/ImageSquare'
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass'
	import UploadSimple from 'phosphor-svelte/lib/UploadSimple'
	import Warning from 'phosphor-svelte/lib/Warning'
	import { SvelteURLSearchParams } from 'svelte/reactivity'

	let {
		value = $bindable(null),
		label,
		hint,
		purpose,
		canUpload = false,
	}: {
		value?: MediaAssetBinding | null
		label: string
		hint?: string
		purpose: CelestialMediaPurpose
		canUpload?: boolean
	} = $props()

	let open = $state(false)
	let query = $state('')
	let compatibleOnly = $state(true)
	let files = $state.raw<MediaAssetListItem[]>([])
	let total = $state(0)
	let offset = $state(0)
	let loading = $state(false)
	let loadingMore = $state(false)
	let uploadError = $state('')
	let uploading = $state(false)
	let resolved = $state.raw<MediaAssetListItem | null>(null)
	let resolveError = $state('')
	let searchTimer: ReturnType<typeof setTimeout> | undefined
	let requestId = 0
	const pageSize = 48

	const selectedCompatibility = $derived(resolved ? assessMediaCompatibility(resolved) : null)
	const revisionChanged = $derived(Boolean(
		value?.contentHash && resolved?.hash && value.contentHash !== resolved.hash,
	))
	const selectedStatus = $derived.by(() => {
		if (resolveError) return { label: 'Missing', variant: 'error' as const }
		if (revisionChanged) return { label: 'Pinned revision', variant: 'info' as const }
		if (selectedCompatibility && !selectedCompatibility.compatible) return { label: 'Incompatible', variant: 'error' as const }
		if (value?.mediaId && value.contentHash) return { label: 'Selected', variant: 'success' as const }
		return { label: 'Legacy reference', variant: 'default' as const }
	})

	$effect(() => {
		const binding = value
		const id = binding?.mediaId
		if (!binding) {
			resolved = null
			resolveError = ''
			return
		}
		const controller = new AbortController()
		resolveError = ''
		const metadataUrl = id
			? `/api/media-assets/${id}`
			: `/api/media-assets?filename=${encodeURIComponent(binding.filename)}`
		fetch(metadataUrl, { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) throw new Error(response.status === 404 ? 'The selected Media asset no longer exists.' : 'Could not validate this Media asset.')
				return response.json() as Promise<MediaAssetListItem>
			})
			.then((item) => { resolved = item })
			.catch((error) => {
				if (error instanceof DOMException && error.name === 'AbortError') return
				resolved = null
				resolveError = error instanceof Error ? error.message : 'Could not validate this Media asset.'
			})
		return () => controller.abort()
	})

	async function loadFiles(reset: boolean) {
		const thisRequest = ++requestId
		if (reset) {
			offset = 0
			loading = true
		} else {
			loadingMore = true
		}
		uploadError = ''
		const params = new SvelteURLSearchParams({
			kind: 'image',
			sort: 'name',
			limit: String(pageSize),
			offset: String(reset ? 0 : offset),
		})
		if (query.trim()) params.set('q', query.trim())
		if (compatibleOnly) params.set('celestialPlate', 'true')
		try {
			const result = await api<{ files: MediaAssetListItem[], total: number }>('GET', `/api/media?${params}`)
			if (thisRequest !== requestId) return
			files = reset ? result.files : [...files, ...result.files]
			total = result.total
			offset = (reset ? 0 : offset) + result.files.length
		} catch (error) {
			if (thisRequest === requestId) uploadError = error instanceof Error ? error.message : 'Could not load Media.'
		} finally {
			if (thisRequest === requestId) {
				loading = false
				loadingMore = false
			}
		}
	}

	function showPicker() {
		open = true
		void loadFiles(true)
	}

	function search() {
		clearTimeout(searchTimer)
		searchTimer = setTimeout(() => void loadFiles(true), 250)
	}

	function choose(item: MediaAssetListItem) {
		const compatibility = assessMediaCompatibility(item)
		if (!compatibility.compatible) return
		value = mediaBindingFromItem(item, purpose)
		resolved = item
		resolveError = ''
		open = false
	}

	async function upload(event: Event) {
		const input = event.currentTarget as HTMLInputElement
		const file = input.files?.[0]
		input.value = ''
		if (!file) return
		uploading = true
		uploadError = ''
		try {
			const formData = new FormData()
			formData.append('file', file)
			const response = await fetch('/api/media', { method: 'POST', body: formData })
			const payload = await response.json().catch(() => null) as MediaAssetListItem | { error?: string } | null
			if (!response.ok) throw new Error(payload && 'error' in payload ? payload.error : `Upload failed (${response.status})`)
			const item = payload as MediaAssetListItem
			const compatibility = assessMediaCompatibility(item)
			if (!compatibility.compatible) {
				files = [item, ...files]
				uploadError = `Uploaded to Media, but not selected: ${compatibility.errors.join('; ')}`
				return
			}
			choose(item)
		} catch (error) {
			uploadError = error instanceof Error ? error.message : 'Upload failed.'
		} finally {
			uploading = false
		}
	}

	function updateInterpretation(patch: Partial<MediaAssetBinding['interpretation']>) {
		if (!value) return
		value = { ...value, interpretation: { ...value.interpretation, ...patch } }
	}

	function clearSelection() {
		value = null
		resolved = null
		resolveError = ''
	}
</script>

<div class="space-y-1.5" data-testid="media-asset-field">
	<div class="flex items-center justify-between gap-2">
		<div>
			<div class="text-xs font-semibold text-heading">{label}</div>
			{#if hint}<div class="mt-0.5 text-xs/4 text-dim">{hint}</div>{/if}
		</div>
		{#if value}<Badge variant={selectedStatus.variant}>{selectedStatus.label}</Badge>{/if}
	</div>

	{#if value}
		<div class="border border-border-subtle bg-page p-2">
			<div class="flex min-w-0 gap-3">
				<img
					src={mediaAssetContentUrl(value)}
					alt=""
					class="h-16 w-28 shrink-0 bg-black object-contain"
				/>
				<div class="min-w-0 flex-1">
					<div class="truncate text-xs font-medium text-body">{resolved?.filename ?? value.filename}</div>
					<div class="mt-1 text-xs text-dim">
						{#if resolved?.width && resolved.height}{resolved.width} × {resolved.height} · {/if}
						{value.interpretation.colorSpace} · 2:1 equirectangular
					</div>
					{#if revisionChanged}
						<div class="mt-1 text-xs/4 text-secondary">The library file changed; this body still uses the pinned revision.</div>
					{:else if resolveError}
						<div class="mt-1 text-xs/4 text-error">{resolveError}</div>
					{:else if selectedCompatibility?.errors.length}
						<div class="mt-1 text-xs/4 text-error">{selectedCompatibility.errors.join('; ')}</div>
					{:else if selectedCompatibility?.warnings.length}
						<div class="mt-1 text-xs/4 text-secondary">{selectedCompatibility.warnings.join('; ')}</div>
					{/if}
				</div>
			</div>

			{#if purpose === 'surface-normal'}
				<label class="mt-2 block text-xs text-secondary">
					Normal Y convention
					<select
						class="mt-1 w-full bg-surface px-2 py-1.5 text-xs text-body outline-none focus:ring-2 focus:ring-accent"
						value={value.interpretation.normalY ?? 'up'}
						onchange={event => updateInterpretation({ normalY: event.currentTarget.value === 'down' ? 'down' : 'up' })}
					>
						<option value="up">OpenGL / +Y</option>
						<option value="down">DirectX / −Y</option>
					</select>
				</label>
			{:else if purpose === 'surface-elevation'}
				<label class="mt-2 block text-xs text-secondary">
					Elevation values
					<select
						class="mt-1 w-full bg-surface px-2 py-1.5 text-xs text-body outline-none focus:ring-2 focus:ring-accent"
						value={value.interpretation.elevationUnit ?? 'relative'}
						onchange={event => updateInterpretation({ elevationUnit: event.currentTarget.value as 'relative' | 'm' | 'km' })}
					>
						<option value="relative">Relative grayscale</option>
						<option value="m">Metres</option>
						<option value="km">Kilometres</option>
					</select>
				</label>
			{/if}

			<div class="mt-2 flex justify-end gap-2">
				<Button type="button" variant="secondary" size="sm" onclick={showPicker}>Replace</Button>
				<Button type="button" variant="secondary" size="sm" onclick={clearSelection}>Clear</Button>
			</div>
		</div>
	{:else}
		<button
			type="button"
			class="
				flex w-full items-center justify-center gap-2 border border-dashed border-border-strong bg-page px-3 py-5 text-xs text-secondary transition-colors
				hover:border-accent hover:text-heading
				focus:ring-2 focus:ring-accent focus:outline-none
			"
			onclick={showPicker}
		>
			<ImageSquare size={18} /> Choose {purposeLabel(purpose)}
		</button>
	{/if}
</div>

<Dialog bind:open title="Choose {purposeLabel(purpose)}" subtitle="Select a compatible 2:1 image from Media or upload one here." class="max-w-4xl" mainClass="min-h-0">
	<div class="flex min-h-0 flex-col gap-3">
		<div class="flex flex-wrap items-end gap-2">
			<div class="min-w-48 flex-1">
				<Input bind:value={query} placeholder="Search filename or description" oninput={search}>
					{#snippet labelExtra()}<MagnifyingGlass size={12} />{/snippet}
				</Input>
			</div>
			<label class="flex h-9 cursor-pointer items-center gap-2 bg-page px-3 text-xs text-secondary">
				<input type="checkbox" bind:checked={compatibleOnly} onchange={() => void loadFiles(true)} />
				Compatible only
			</label>
			{#if canUpload}
				<label class="inline-flex h-9 cursor-pointer items-center gap-1.5 bg-accent px-3 text-xs font-medium text-surface hover:bg-accent-hover">
					<UploadSimple size={14} /> {uploading ? 'Uploading…' : 'Upload image'}
					<input class="sr-only" type="file" accept="image/*" disabled={uploading} onchange={upload} />
				</label>
			{/if}
		</div>

		{#if uploadError}<div class="border border-error-border bg-error-bg p-2 text-xs text-error">{uploadError}</div>{/if}

		<div class="max-h-[55vh] min-h-48 overflow-y-auto border border-border-subtle bg-page p-2">
			{#if loading}
				<div class="grid min-h-48 place-items-center text-sm text-dim">Loading Media…</div>
			{:else}
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
					{#each files as file (file.id)}
						{@const compatibility = assessMediaCompatibility(file)}
						<button
							type="button"
							class="
								group min-w-0 border border-border-subtle bg-surface p-1.5 text-left transition-colors
								enabled:hover:border-accent
								disabled:cursor-not-allowed disabled:opacity-55
							"
							disabled={!compatibility.compatible}
							onclick={() => choose(file)}
							title={compatibility.errors.join('; ') || compatibility.warnings.join('; ') || file.filename}
						>
							<div class="relative aspect-2/1 overflow-hidden bg-black">
								<img src="/api/media/{encodeURIComponent(file.filename)}?w=300" alt="" loading="lazy" class="size-full object-contain" />
								<div class="absolute right-1 bottom-1 bg-black/75 p-0.5 text-white">
									{#if compatibility.compatible}<CheckCircle size={14} weight="fill" />{:else}<Warning size={14} weight="fill" />{/if}
								</div>
							</div>
							<div class="mt-1 truncate text-xs font-medium text-body">{file.filename}</div>
							<div class="text-xs text-dim">{file.width ?? '?'} × {file.height ?? '?'}</div>
						</button>
					{:else}
						<div class="col-span-full grid min-h-40 place-items-center text-sm text-dim">No matching Media images.</div>
					{/each}
				</div>
				{#if files.length < total}
					<div class="mt-3 text-center"><Button type="button" variant="secondary" size="sm" loading={loadingMore} onclick={() => void loadFiles(false)}>Load more</Button></div>
				{/if}
			{/if}
		</div>
	</div>
</Dialog>
