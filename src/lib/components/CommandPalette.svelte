<script lang="ts">
	import { Command, Dialog } from 'bits-ui'
	import { goto } from '$app/navigation'
	import { createQuery } from '@tanstack/svelte-query'
	import type { Component } from 'svelte'
	import { api } from '$lib/api'
	import { commandPalette } from './command-palette.svelte'
	import { sanitizeSnippet } from '$lib/utils'
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass'
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight'

	export type PaletteAction = {
		label: string
		href: string
		icon?: Component<{ size?: number, weight?: 'fill' | 'regular' | 'bold' }>
		/** Extra terms to match on, beyond the visible label. */
		keywords?: string
	}

	let { actions = [] }: { actions?: PaletteAction[] } = $props()

	type SearchResult = { kind: string, title: string, href: string, badge: string, snippet: string }

	let query = $state('')
	let debounced = $state('')
	let timer: ReturnType<typeof setTimeout>

	// Clear the query whenever the palette closes so it reopens fresh.
	$effect(() => {
		if (!commandPalette.open) {
			query = ''
			debounced = ''
			clearTimeout(timer)
		}
	})

	function onInput(event: Event) {
		query = (event.currentTarget as HTMLInputElement).value
		clearTimeout(timer)
		if (!query.trim()) {
			debounced = ''
			return
		}
		timer = setTimeout(() => debounced = query.trim(), 200)
	}

	const term = $derived(query.trim().toLowerCase())
	const filteredActions = $derived(
		term
			? actions.filter(a => `${a.label} ${a.keywords ?? ''}`.toLowerCase().includes(term))
			: actions,
	)

	const search = createQuery(() => ({
		queryKey: ['command-search', debounced],
		queryFn: () => api<{ results?: SearchResult[] }>('GET', `/api/search?q=${encodeURIComponent(debounced)}&limit=8`),
		enabled: debounced.length >= 2,
	}))

	const results = $derived(debounced.length >= 2 ? search.data?.results ?? [] : [])
	const searching = $derived(debounced.length >= 2 && search.isFetching)

	function navigate(href: string) {
		commandPalette.close()
		goto(href)
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault()
			commandPalette.toggle()
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<Dialog.Root bind:open={() => commandPalette.open, (v) => { commandPalette.open = v }}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-9998 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
		<Dialog.Content
			class="
				fixed left-1/2 top-[12vh] z-9999 w-[calc(100dvw-2rem)] max-w-xl -translate-x-1/2 bg-surface shadow-xl
				data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
			"
			aria-label="Command palette"
		>
			<Command.Root shouldFilter={false} class="flex flex-col max-h-[70vh]">
				<div class="flex items-center gap-2 border-b border-border-subtle px-3">
					<MagnifyingGlass size={16} class="shrink-0 text-secondary" />
					<Command.Input
						value={query}
						oninput={onInput}
						placeholder="Search pages, or jump to…"
						class="h-12 w-full bg-transparent text-sm text-body outline-none placeholder:text-dim"
					/>
					<kbd class="shrink-0 rounded-sm border border-border-subtle px-1.5 py-0.5 text-[0.65rem] text-dim">esc</kbd>
				</div>

				<Command.List class="overflow-y-auto p-1">
					<Command.Empty class="px-3 py-8 text-center text-sm text-dim">
						{searching ? 'Searching…' : 'No matches.'}
					</Command.Empty>

					{#if filteredActions.length > 0}
						<Command.Group>
							<Command.GroupHeading class="px-2 pt-2 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-dim">
								Go to
							</Command.GroupHeading>
							<Command.GroupItems>
								{#each filteredActions as action (action.href)}
									<Command.Item
										value="nav:{action.href}"
										onSelect={() => navigate(action.href)}
										class="flex items-center gap-2.5 p-2 text-sm text-body cursor-pointer outline-none data-selected:bg-accent-subtle"
									>
										{#if action.icon}
											{@const Icon = action.icon}
											<Icon size={16} weight="fill" />
										{/if}
										<span class="flex-1 truncate">{action.label}</span>
									</Command.Item>
								{/each}
							</Command.GroupItems>
						</Command.Group>
					{/if}

					{#if results.length > 0}
						<Command.Separator class="my-1 h-px bg-border-subtle" />
						<Command.Group>
							<Command.GroupHeading class="px-2 pt-2 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-dim">
								Search results
							</Command.GroupHeading>
							<Command.GroupItems>
								{#each results as result (result.href)}
									<Command.Item
										value="result:{result.href}"
										onSelect={() => navigate(result.href)}
										class="flex items-start gap-2.5 p-2 cursor-pointer outline-none data-selected:bg-accent-subtle"
									>
										<span class="mt-0.5 flex items-center gap-2 min-w-0 flex-1">
											<span class="flex flex-col min-w-0">
												<span class="flex items-center gap-2">
													<span class="truncate text-sm font-medium text-heading">{result.title}</span>
													<span class="shrink-0 text-[0.65rem] uppercase tracking-wide text-secondary">{result.badge}</span>
												</span>
												{#if result.snippet}
													<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitizeSnippet escapes all but <mark> -->
													<span class="truncate text-xs text-dim">{@html sanitizeSnippet(result.snippet)}</span>
												{/if}
											</span>
										</span>
										<ArrowRight size={14} class="mt-1 shrink-0 text-dim" />
									</Command.Item>
								{/each}
							</Command.GroupItems>
						</Command.Group>
					{/if}
				</Command.List>
			</Command.Root>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
