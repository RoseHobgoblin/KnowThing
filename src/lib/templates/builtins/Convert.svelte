<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { namedArg, positionalArg } from '../args.js'
	import { convert } from '../convert.js'

	let { args }: { args: TemplateArg[] } = $props()

	const rawValue = positionalArg(args, 0) || ''
	const fromUnit = positionalArg(args, 1) || ''
	const toUnit = positionalArg(args, 2) || ''
	const precisionRaw = namedArg(args, 'precision') || namedArg(args, 'sigfig')
	const precision = precisionRaw ? Number.parseInt(precisionRaw) : undefined

	const numValue = Number.parseFloat(rawValue)
	const result = convert(numValue, fromUnit, toUnit, Number.isFinite(precision!) ? precision : undefined)
</script>

<span>{result.source.value}&nbsp;{result.source.unit}{#if result.target} ({result.target.value}&nbsp;{result.target.unit}){/if}</span>
