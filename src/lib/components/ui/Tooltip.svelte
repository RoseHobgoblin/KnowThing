<script lang="ts">
	import { Tooltip } from 'bits-ui'
	import { cn } from '$lib/utils'
	import type { Snippet } from 'svelte'
	import { fly } from 'svelte/transition'

	let {
		side = 'top',
		sideOffset = 8,
		children,
		delayDuration = 200,
		content = '',
		contentClass,
		open = $bindable(false),
		triggerClass = 'inline-block',
		...rest
	}: Omit<Tooltip.RootProps, 'children'> & Pick<Tooltip.ContentProps, 'side' | 'sideOffset'> & {
		children?: Snippet
		content?: Snippet | string
		contentClass?: string
		triggerClass?: string
	} = $props()
</script>

<Tooltip.Root {delayDuration} ignoreNonKeyboardFocus bind:open {...rest}>
	<Tooltip.Trigger class={cn('inline-block', triggerClass)}>
		{@render children?.()}
	</Tooltip.Trigger>
	<Tooltip.Portal>
		<Tooltip.Content
			forceMount
			{sideOffset}
			{side}
			class={cn(
				'z-9999 py-2 px-3 text-sm text-body bg-surface shadow-lg relative',
				'animate-in fade-in-0 zoom-in-95',
				'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
				'data-[side=bottom]:slide-in-from-top-2',
				'data-[side=left]:slide-in-from-right-2',
				'data-[side=right]:slide-in-from-left-2',
				'data-[side=top]:slide-in-from-bottom-2',
				contentClass,
			)}
		>
			{#snippet child({ wrapperProps, props, open: isOpen })}
				{#if isOpen}
					<div {...wrapperProps}>
						<div {...props} out:fly={{ duration: 200 }}>
							<div>
								<Tooltip.Arrow class="text-border" width={10} height={10} />
								{#if typeof content === 'string'}
									{content}
								{:else}
									{@render content?.()}
								{/if}
							</div>
						</div>
					</div>
				{/if}
			{/snippet}
		</Tooltip.Content>
	</Tooltip.Portal>
</Tooltip.Root>
