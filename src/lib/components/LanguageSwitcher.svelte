<script lang="ts">
	import { Select } from 'bits-ui'
	import type { Component } from 'svelte'
	import { getLocale, setLocale, locales } from '$lib/paraglide/runtime.js'
	import { cn } from '$lib/utils.js'
	import CaretDown from 'phosphor-svelte/lib/CaretDown'
	import Check from 'phosphor-svelte/lib/Check'
	import Gb from 'svelte-flag-icons/Gb.svelte'
	import Id from 'svelte-flag-icons/Id.svelte'
	import AnglishDragon from '$lib/components/flags/AnglishDragon.svelte'

	// Locale → { endonym label, flag component }. English uses the GB flag; swap
	// to Us if a US-English audience is preferred. Anglish (Germanic-purist
	// English) flies the Anglo-Saxon white dragon. Flags-for-languages is a rough
	// convention (a flag is a country, not a language), fine for this small set.
	const meta = {
		en: { label: 'English', Flag: Gb },
		id: { label: 'Indonesia', Flag: Id },
		ang: { label: 'Anglish', Flag: AnglishDragon },
	} satisfies Record<string, { label: string, Flag: Component }>

	const items = locales.map(loc => ({ value: loc, ...meta[loc] }))

	// Reactive: locale lives in a PersistedState store (see i18n.svelte.ts), so
	// getLocale() re-reads when it changes and after the post-mount apply. The
	// trigger flag/highlight update instantly, no reload.
	const current = $derived(getLocale())
	const CurrentFlag = $derived(meta[current].Flag)

	let open = $state(false)

	function change(value: string) {
		// setLocale just writes the store (overridden in i18n.svelte.ts); the tree
		// re-renders reactively — no page reload.
		if (value && value !== getLocale()) setLocale(value as typeof current)
	}
</script>

<Select.Root type="single" value={current} onValueChange={change} bind:open>
	<Select.Trigger
		aria-label="Change language"
		class="flex items-center gap-1.5 p-2 text-secondary transition-colors cursor-pointer hover:bg-raised hover:text-heading"
	>
		<CurrentFlag size="18" class="rounded-xs" ariaLabel={meta[current].label} />
		<CaretDown size={12} weight="bold" class={cn('transition-transform', open && 'rotate-180')} />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			side="bottom"
			sideOffset={6}
			align="end"
			class="
				z-9999 min-w-40 select-none bg-surface shadow-lg outline-none overflow-hidden
				data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
				data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
			"
		>
			<Select.Viewport>
				{#each items as item (item.value)}
					<Select.Item
						value={item.value}
						label={item.label}
						class="
							flex h-9 w-full cursor-pointer select-none items-center gap-2.5 px-3 py-2 text-sm text-body outline-none transition-colors
							data-highlighted:bg-raised data-highlighted:text-heading
						"
					>
						{#snippet children({ selected })}
							<item.Flag size="18" class="shrink-0 rounded-xs" ariaLabel={item.label} />
							<span class="flex-1">{item.label}</span>
							{#if selected}<Check size={14} weight="bold" class="text-accent" />{/if}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>
