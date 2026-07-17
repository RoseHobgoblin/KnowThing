<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { SvelteHTMLElements } from 'svelte/elements'
	import { cn } from '$lib/utils'

	type Props = Omit<SvelteHTMLElements['button'], 'class'> & {
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
		size?: 'sm' | 'md' | 'lg'
		loading?: boolean
		href?: string
		class?: string
		children: Snippet
	}

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		disabled = false,
		href,
		class: className,
		children,
		...props
	}: Props = $props()

	const base = 'interactive-frame inline-flex items-center justify-center gap-1.5 font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none'

	const variants = {
		primary: 'bg-accent text-surface hover:bg-accent-hover',
		secondary: 'text-secondary hover:bg-raised hover:text-heading',
		danger: 'bg-error text-white hover:opacity-90',
		ghost: 'text-link hover:text-link-hover hover:underline',
	}

	const sizes = {
		sm: 'px-2.5 py-1 text-xs',
		md: 'px-4 py-2 text-sm',
		lg: 'px-5 py-2.5 text-sm',
	}

	const classes = $derived(cn(base, variants[variant], sizes[size], className))
</script>

{#if href}
	<a {href} class={classes}>
		{@render children()}
	</a>
{:else}
	<button
		class={classes}
		disabled={disabled || loading}
		{...props}
	>
		{@render children()}
	</button>
{/if}
