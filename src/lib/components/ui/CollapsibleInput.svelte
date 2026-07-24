<script lang="ts">
	import { cn } from '$lib/utils'
	import type { SvelteHTMLElements } from 'svelte/elements'

	let {
		open,
		class: className,
		children,
		...rest
	}: {
		open: boolean
	} & SvelteHTMLElements['fieldset'] = $props()
</script>

<fieldset
	{...rest}
	class={cn(
		'grid transition-[grid-template-rows,margin] duration-200 ease-in-out',
		!open && 'grid-rows-[0fr] m-0!',
		open && 'grid-rows-[1fr]',
		className,
	)}
	disabled={!open}
>
	<div class="overflow-hidden">
		{@render children?.()}
	</div>
</fieldset>
