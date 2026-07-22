<script lang="ts">
	import type { Snippet } from 'svelte'
	import { onMount } from 'svelte'
	import { Tabs } from 'bits-ui'
	import { cn } from '$lib/utils'

	export interface TabItem {
		id?: string
		label: string
		labelContent?: Snippet<[]>
		/** Rendered as a plain link styled like a tab, outside the tablist semantics. */
		href?: string
		loadFunction?: () => Promise<void>
		shouldShow?: () => boolean
	}

	interface Props {
		activeSectionId?: string
		navItems: TabItem[]
		onNavigationChange?: (id: string) => void
		disabled?: boolean
		fullWidth?: boolean
		size?: 'sm' | 'md' | 'lg'
		class?: string
	}

	let {
		navItems,
		onNavigationChange,
		disabled = false,
		fullWidth = false,
		size = 'md',
		activeSectionId = $bindable<string | undefined>(),
		class: className = '',
	}: Props = $props()

	const tabClasses = {
		sm: 'h-8 text-xs px-3',
		md: 'h-9 text-sm px-4',
		lg: 'h-10 text-sm px-5',
	} as const

	const items = $derived(
		navItems.map(item => ({ ...item, id: item.id ?? item.label })),
	)

	const visibleItems = $derived(
		items.filter(item => !item.shouldShow || item.shouldShow()),
	)

	let loadingSections = $state<Record<string, boolean>>({})
	let loadedSections = $state<Record<string, boolean>>({})

	let containerElement = $state<HTMLElement | null>(null)
	let tabElements = $state<Record<string, HTMLElement | null>>({})
	let indicatorReady = $state(false)
	let indicatorStyle = $state({ transform: '', width: 0, height: 0 })

	function selectTab(id: string) {
		if (disabled || !id || id === activeSectionId) return
		activeSectionId = id
		onNavigationChange?.(id)
		loadSection(id)
	}

	function loadSection(id: string) {
		const item = items.find(it => it.id === id)
		if (!item?.loadFunction || loadingSections[id] || loadedSections[id]) return

		loadingSections = { ...loadingSections, [id]: true }
		item.loadFunction()
			.then(() => {
				loadedSections = { ...loadedSections, [id]: true }
				loadingSections = { ...loadingSections, [id]: false }
			})
			.catch(() => {
				loadingSections = { ...loadingSections, [id]: false }
			})
	}

	function updateIndicator() {
		if (!containerElement || !activeSectionId) return
		const tabElement = tabElements[activeSectionId]
		if (!tabElement) return

		const containerRect = containerElement.getBoundingClientRect()
		const tabRect = tabElement.getBoundingClientRect()

		indicatorStyle = {
			transform: `translate(${tabRect.left - containerRect.left}px, ${tabRect.top - containerRect.top}px)`,
			width: tabElement.offsetWidth,
			height: tabElement.offsetHeight,
		}

		if (!indicatorReady) {
			requestAnimationFrame(() => (indicatorReady = true))
		}
	}

	onMount(() => {
		if (!activeSectionId && visibleItems.length > 0) {
			activeSectionId = visibleItems[0].id
		}
		if (activeSectionId) loadSection(activeSectionId)
		requestAnimationFrame(updateIndicator)
	})

	$effect(() => {
		void visibleItems.length
		if (activeSectionId) loadSection(activeSectionId)
		requestAnimationFrame(updateIndicator)
	})

	$effect(() => {
		if (!containerElement) return
		const resizeObserver = new ResizeObserver(() => updateIndicator())
		resizeObserver.observe(containerElement)
		return () => resizeObserver.disconnect()
	})
</script>

<div class={cn('flex flex-col', className)}>
	<Tabs.Root bind:value={() => activeSectionId ?? '', v => selectTab(v)}>
		<Tabs.List
			bind:ref={containerElement}
			class={cn(
				'p-1 relative bg-page',
				fullWidth ? 'grid grid-flow-col auto-cols-fr w-full gap-1' : 'inline-flex gap-1',
			)}
		>
			<!-- Active indicator -->
			<div
				class={cn(
					'absolute left-0 top-0 bg-raised shadow-sm',
					indicatorReady && 'transition-[transform,width] duration-300 ease-out',
				)}
				style:transform={indicatorStyle.transform}
				style:width="{indicatorStyle.width}px"
				style:height="{indicatorStyle.height}px"
			></div>

			{#each visibleItems as item (item.id)}
				{#if item.href}
					<a
						bind:this={tabElements[item.id]}
						href={item.href}
						class={cn(
							'cursor-pointer font-medium relative z-1 flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors duration-200',
							tabClasses[size],
							'text-secondary hover:text-body',
							disabled && 'pointer-events-none opacity-60',
						)}
					>
						{#if item.labelContent}
							{@render item.labelContent()}
						{:else}
							{item.label}
						{/if}
					</a>
				{:else}
					<Tabs.Trigger
						value={item.id}
						{disabled}
						bind:ref={tabElements[item.id]}
						class={cn(
							'cursor-pointer font-medium relative z-1 flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors duration-200',
							tabClasses[size],
							item.id === activeSectionId ? 'text-heading' : 'text-secondary hover:text-body',
							disabled && 'pointer-events-none opacity-60',
						)}
					>
						{#if item.labelContent}
							{@render item.labelContent()}
						{:else}
							{item.label}
						{/if}
					</Tabs.Trigger>
				{/if}
			{/each}
		</Tabs.List>
	</Tabs.Root>
</div>
