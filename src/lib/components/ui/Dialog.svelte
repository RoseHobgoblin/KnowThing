<script lang="ts">
	import { Dialog, type DialogRootProps } from 'bits-ui'
	import type { Snippet } from 'svelte'
	import { cn } from '$lib/utils'
	import { pushDialog, popDialog, getOverlayZ, getContentZ, isTopmost } from '$lib/context/DialogStack.svelte'
	import { onDestroy } from 'svelte'
	import X from 'phosphor-svelte/lib/X'

	export type DialogProps = DialogRootProps & {
		title?: string
		subtitle?: string
		titleContent?: Snippet
		trigger?: Snippet
		class?: string
		mainClass?: string
		unclosable?: boolean
		onclose?: () => void
		noPadding?: boolean
	}

	let {
		open = $bindable(false),
		title,
		titleContent,
		children,
		trigger,
		class: className,
		mainClass,
		unclosable = false,
		onclose,
		subtitle,
		noPadding = false,
		...rest
	}: DialogProps = $props()

	const dialogId = Symbol('dialog')
	$effect(() => {
		if (open) pushDialog(dialogId)
		else popDialog(dialogId)
	})
	onDestroy(() => popDialog(dialogId))

	const overlayZ = $derived(getOverlayZ(dialogId))
	const contentZ = $derived(getContentZ(dialogId))
	const topmost = $derived(isTopmost(dialogId))

	function onInteractOutside(event: Event) {
		if (unclosable) event.preventDefault()
		const target = event.target as Element
		if (target?.closest('[data-portal]')) event.preventDefault()
	}

	function onEscapeKeydown(event: KeyboardEvent) {
		if (unclosable) event.preventDefault()
	}
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => { if (!isOpen) onclose?.() }} {...rest}>
	{@render trigger?.()}

	<Dialog.Portal>
		<Dialog.Overlay
			class="
				fixed inset-0 bg-black/50
				data-[state=open]:animate-in data-[state=open]:fade-in-0
				data-[state=closed]:animate-out data-[state=closed]:fade-out-0
			"
			style={`z-index: ${overlayZ}`}
		/>
		<Dialog.Content
			class={cn(
				'fixed left-1/2 top-1/2 -translate-1/2 bg-surface shadow-xl',
				'w-[calc(100dvw-2rem)] max-w-lg max-h-[calc(100dvh-5rem)]',
				!topmost && 'pointer-events-none',
				'h-fit overflow-y-auto overflow-x-hidden',
				'flex flex-col',
				'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
				'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
				className,
			)}
			style={`z-index: ${contentZ}`}
			{onInteractOutside}
			{onEscapeKeydown}
		>
			{#if !unclosable}
				<Dialog.Close class="
					absolute top-3 right-3 z-10 cursor-pointer text-secondary transition-colors
					hover:text-heading leading-none px-1
				">
					<X size={16} weight="bold" />
				</Dialog.Close>
			{/if}

			<div class={cn('flex flex-col min-w-0 w-full', !noPadding && 'p-5', mainClass)}>
				{#if titleContent}
					<div class="mb-4 shrink-0">
						{@render titleContent()}
					</div>
				{:else if title}
					<div class="mb-4 shrink-0">
						<h2 class="text-lg font-bold text-heading">{title}</h2>
						{#if subtitle}
							<p class="text-sm text-secondary mt-0.5">{subtitle}</p>
						{/if}
					</div>
				{/if}

				<div class="flex-1 min-h-fit">
					{@render children?.()}
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
