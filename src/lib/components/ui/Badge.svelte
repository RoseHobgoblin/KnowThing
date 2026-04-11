<script lang="ts">
	import { cn } from '$lib/utils'

	let {
		variant = 'default',
		class: className,
		children,
	}: {
		variant?: 'default' | 'accent' | 'success' | 'error' | 'info'
		class?: string
		children: import('svelte').Snippet
	} = $props()

	const variants: Record<string, string> = {
		default: 'bg-raised text-secondary',
		accent: 'bg-accent text-surface',
		success: 'bg-success-bg text-success border border-success-border',
		error: 'bg-error-bg text-error border border-error-border',
		info: 'bg-accent-subtle text-accent-light',
	}
</script>

<span class={cn(
	'inline-block px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider',
	variants[variant],
	className,
)}>
	{@render children()}
</span>
