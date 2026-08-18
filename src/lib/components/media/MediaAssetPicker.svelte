<script lang="ts">
	import { browser } from '$app/environment'
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
		type RodderMediaPurpose,
		type MediaAssetBinding,
		type MediaAssetListItem,
	} from '$lib/media/asset-binding.js'
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle'
	import ImageSquare from 'phosphor-svelte/lib/ImageSquare'
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass'
	import UploadSimple from 'phosphor-svelte/lib/UploadSimple'
	import Warning from 'phosphor-svelte/lib/Warning'
	import { createInfiniteQuery, createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
	import { Debounced } from 'runed'
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
		purpose: RodderMediaPurpose
		canUpload?: boolean
	} = $props()

	let open = $state(false)
	let query = $state('')
	let compatibleOnly = $state(true)
	let uploadNotice = $state('')
	const pageSize = 48
	const queryClient = useQueryClient()
	const debouncedQuery = new Debounced(() => query.trim(), 250)

	type MediaPage = { files: MediaAssetListItem[], total: number }

	function selectedAssetQueryKey(binding: MediaAssetBinding) {
		return binding.mediaId
			? ['media', 'asset', 'id', binding.mediaId] as const
			: ['media', 'asset', 'filename', binding.filename] as const
	}

	const selectedAssetQuery = createQuery(() => {
		const binding = value
		return {
			queryKey: binding ? selectedAssetQueryKey(binding) : ['media', 'asset', 'none'] as const,
			queryFn: async ({ signal }) => {
				if (!binding) throw new Error('No Media asset is selected.')
				const metadataUrl = binding.mediaId
					? `/api/media-assets/${binding.mediaId}`
					: `/api/media-assets?filename=${encodeURIComponent(binding.filename)}`
				const response = await fetch(metadataUrl, { signal })
				if (!response.ok) {
					throw new Error(response.status === 404
						? 'The selected Media asset no longer exists.'
						: 'Could not validate this Media asset.')
				}
				return response.json() as Promise<MediaAssetListItem>
			},
			enabled: browser && binding != null,
			retry: false,
		}
	})

	const mediaQuery = createInfiniteQuery(() => {
		const term = debouncedQuery.current
		return {
			queryKey: ['media', 'rodder-picker', term, compatibleOnly, pageSize],
			queryFn: ({ pageParam, signal }) => {
				const params = new SvelteURLSearchParams({
					kind: 'image',
					sort: 'name',
					limit: String(pageSize),
					offset: String(pageParam),
				})
				if (term) params.set('q', term)
				if (compatibleOnly) params.set('rodderPlate', 'true')
				return api<MediaPage>('GET', `/api/media?${params}`, undefined, { signal })
			},
			initialPageParam: 0,
			getNextPageParam: (lastPage, _pages, lastPageParameter) => {
				const nextOffset = lastPageParameter + lastPage.files.length
				return nextOffset < lastPage.total ? nextOffset : undefined
			},
			enabled: browser && open,
		}
	})

	const uploadMutation = createMutation(() => ({
		mutationFn: async (file: File): Promise<MediaAssetListItem> => {
			const formData = new FormData()
			formData.append('file', file)
			const response = await fetch('/api/media', { method: 'POST', body: formData })
			const payload = await response.json().catch(() => null) as MediaAssetListItem | { error?: string } | null
			if (!response.ok) throw new Error(payload && 'error' in payload ? payload.error : `Upload failed (${response.status})`)
			return payload as MediaAssetListItem
		},
		onSuccess: (item) => {
			void queryClient.invalidateQueries({ queryKey: ['media'] })
			const compatibility = assessMediaCompatibility(item)
			if (!compatibility.compatible) {
				uploadNotice = `Uploaded to Media, but not selected: ${compatibility.errors.join('; ')}`
				return
			}
			choose(item)
		},
	}))

	const resolved = $derived(value ? selectedAssetQuery.data ?? null : null)
	const resolveError = $derived(value && selectedAssetQuery.isError
		? selectedAssetQuery.error.message
		: '')
	const files = $derived(mediaQuery.data?.pages.flatMap(page => page.files) ?? [])
	const total = $derived(mediaQuery.data?.pages[0]?.total ?? 0)
	const loading = $derived(mediaQuery.isPending)
	const loadingMore = $derived(mediaQuery.isFetchingNextPage)
	const uploading = $derived(uploadMutation.isPending)
	const uploadError = $derived(uploadNotice
		|| (uploadMutation.error instanceof Error ? uploadMutation.error.message : '')
		|| (mediaQuery.error instanceof Error ? mediaQuery.error.message : ''))

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

	function showPicker() {
		uploadNotice = ''
		open = true
	}

	function choose(item: MediaAssetListItem) {
		const compatibility = assessMediaCompatibility(item)
		if (!compatibility.compatible) return
		const binding = mediaBindingFromItem(item, purpose)
		queryClient.setQueryData(selectedAssetQueryKey(binding), item)
		value = binding
		open = false
	}

	async function upload(event: Event) {
		const input = event.currentTarget as HTMLInputElement
		const file = input.files?.[0]
		input.value = ''
		if (!file) return
		uploadNotice = ''
		uploadMutation.reset()
		try {
			await uploadMutation.mutateAsync(file)
		} catch {
			// TanStack exposes the error through uploadMutation.error.
		}
	}

	function updateInterpretation(patch: Partial<MediaAssetBinding['interpretation']>) {
		if (!value) return
		value = { ...value, interpretation: { ...value.interpretation, ...patch } }
	}

	function clearSelection() {
		value = null
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
				<Input bind:value={query} placeholder="Search filename or description">
					{#snippet labelExtra()}<MagnifyingGlass size={12} />{/snippet}
				</Input>
			</div>
			<label class="flex h-9 cursor-pointer items-center gap-2 bg-page px-3 text-xs text-secondary">
				<input type="checkbox" bind:checked={compatibleOnly} />
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
					<div class="mt-3 text-center"><Button type="button" variant="secondary" size="sm" loading={loadingMore} onclick={() => void mediaQuery.fetchNextPage()}>Load more</Button></div>
				{/if}
			{/if}
		</div>
	</div>
</Dialog>
