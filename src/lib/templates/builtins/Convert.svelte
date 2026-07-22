<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { namedArg, positionalArg } from '../args.js'
	import { convert } from '../convert.js'

	let { args }: { args: TemplateArg[] } = $props()

	const rawValue = $derived(positionalArg(args, 0) || '')
	const fromUnit = $derived(positionalArg(args, 1) || '')
	const toUnit = $derived(positionalArg(args, 2) || '')
	const precisionRaw = $derived(namedArg(args, 'precision') || namedArg(args, 'sigfig'))
	const precision = $derived(precisionRaw ? Number.parseInt(precisionRaw) : undefined)

	const numValue = $derived(Number.parseFloat(rawValue))
	const result = $derived(convert(numValue, fromUnit, toUnit, Number.isFinite(precision!) ? precision : undefined))
</script>

<span>{result.source.value}&nbsp;{result.source.unit}{#if result.target} ({result.target.value}&nbsp;{result.target.unit}){/if}</span>
