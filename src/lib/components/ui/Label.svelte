<script lang="ts">
	import { Label, type LabelRootProps } from 'bits-ui'
	import { cn } from '$lib/utils'

	const {
		class: className,
		children,
		...rest
	}: LabelRootProps = $props()
</script>

<Label.Root
	class={cn('text-xs font-medium text-secondary', className)}
	{...rest}
>
	{@render children?.()}
</Label.Root>
