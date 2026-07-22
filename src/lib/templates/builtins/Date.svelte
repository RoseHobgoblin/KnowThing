<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'
	import { getKnowContext } from '$lib/renderer/context.js'
	import { fromTimestamp } from 'rimecraft'
	import type { ResolvedDate } from 'rimecraft'

	let { args }: { args: TemplateArg[] } = $props()

	const ctx = getKnowContext()
	const tsString = $derived(positionalArg(args, 0)?.trim() || '')
	const ts = $derived(Number.parseInt(tsString))

	const resolved: ResolvedDate | null = $derived.by(() => {
		if (Number.isFinite(ts) && ctx.calendarConfig) {
			try {
				return fromTimestamp(ts, ctx.calendarConfig)
			} catch {
				return null
			}
		}
		return null
	})

	const formatted = $derived(resolved
		? `${resolved.day_of_week_name}, ${resolved.day} ${resolved.month_name}, ${resolved.year_display}`
		: null)
</script>

{#if formatted}
	<a href="/calendar?date={ts}" class="text-link hover:text-link-hover hover:underline" title="View in calendar">{formatted}</a>
{:else}
	<span class="text-secondary">[date: {tsString}]</span>
{/if}
