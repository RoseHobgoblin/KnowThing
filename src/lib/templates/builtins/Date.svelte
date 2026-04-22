<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'
	import { getKnowContext } from '$lib/renderer/context.js'
	import { fromTimestamp } from '$lib/calendar/know-date.js'
	import type { ResolvedDate } from '$lib/calendar/types.js'

	let { args }: { args: TemplateArg[] } = $props()

	const ctx = getKnowContext()
	const tsString = positionalArg(args, 0)?.trim() || ''
	const ts = Number.parseInt(tsString)

	let resolved: ResolvedDate | null = null
	if (Number.isFinite(ts) && ctx.calendarConfig) {
		try {
			resolved = fromTimestamp(ts, ctx.calendarConfig)
		} catch {
			resolved = null
		}
	}

	const formatted = resolved
		? `${resolved.day_of_week_name}, ${resolved.day} ${resolved.month_name}, ${resolved.year_display}`
		: null
</script>

{#if formatted}
	<a href="/calendar?date={ts}" class="text-link hover:text-link-hover hover:underline" title="View in calendar">{formatted}</a>
{:else}
	<span class="text-faint">[date: {tsString}]</span>
{/if}
