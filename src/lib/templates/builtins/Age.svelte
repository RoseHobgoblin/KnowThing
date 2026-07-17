<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'
	import { getKnowContext } from '$lib/renderer/context.js'

	let { args }: { args: TemplateArg[] } = $props()

	const ctx = getKnowContext()
	const birthYear = Number.parseInt(positionalArg(args, 0) || '')
	const deathYear = Number.parseInt(positionalArg(args, 1) || '')

	const endYear: number | undefined = Number.isNaN(deathYear) ? ctx.calendarDate?.year : deathYear
	const age = (Number.isFinite(birthYear) && endYear != null) ? endYear - birthYear : null
</script>

{#if age !== null}<span>{age}</span>
{:else if Number.isNaN(birthYear)}<span class="text-secondary">[age: ?]</span>
{:else}<span class="text-secondary">[age: no calendar]</span>{/if}
