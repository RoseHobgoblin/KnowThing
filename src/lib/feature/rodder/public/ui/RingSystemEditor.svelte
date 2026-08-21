<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import {
		emptyRingSystem,
		type RingBand,
		type RingBandProvenance,
		type RingSystem,
		type RingSystemOrigin,
	} from '$lib/feature/rodder/public/ring-system.js'

	let { value = $bindable(emptyRingSystem()) }: { value?: RingSystem } = $props()

	const origins: Array<{ value: RingSystemOrigin | '', label: string }> = [
		{ value: '', label: 'Unavailable / not classified' },
		{ value: 'captured-debris', label: 'Captured debris' },
		{ value: 'impact-ejecta', label: 'Impact ejecta' },
		{ value: 'tidal-disruption', label: 'Tidal disruption' },
		{ value: 'artificial', label: 'Artificial' },
		{ value: 'unknown', label: 'Authored as unknown' },
		{ value: 'illustrative', label: 'Illustrative' },
	]
	const provenances: Array<{ value: RingBandProvenance, label: string }> = [
		{ value: 'authored', label: 'Authored' },
		{ value: 'imported', label: 'Imported' },
		{ value: 'derived', label: 'Derived' },
		{ value: 'illustrative', label: 'Illustrative' },
		{ value: 'unavailable', label: 'Unavailable' },
	]

	function updateSystem(patch: Partial<RingSystem>) {
		value = { ...value, ...patch }
	}

	function updateBand(index: number, patch: Partial<RingBand>) {
		value = {
			...value,
			bands: value.bands.map((band, bandIndex) => bandIndex === index ? { ...band, ...patch } : band),
		}
	}

	function optionalText(input: string): string | null {
		return input.trim() || null
	}

	function optionalNumber(input: HTMLInputElement): number | null {
		return input.value === '' || !Number.isFinite(input.valueAsNumber) ? null : input.valueAsNumber
	}

	function addBand() {
		const previousOuter = value.bands.at(-1)?.outerRadiusM ?? 1
		value = {
			...value,
			bands: [...value.bands, {
				innerRadiusM: previousOuter,
				outerRadiusM: previousOuter + 1,
				provenance: 'authored',
			}],
		}
	}

	function removeBand(index: number) {
		value = { ...value, bands: value.bands.filter((_, bandIndex) => bandIndex !== index) }
	}
</script>

<div class="space-y-4">
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<label class="space-y-1 text-xs font-medium text-heading">
			<span>Plane</span>
			<select class="h-10 w-full bg-page px-3 text-sm text-body" disabled>
				<option>Parent equatorial</option>
			</select>
		</label>
		<label class="space-y-1 text-xs font-medium text-heading">
			<span>Origin</span>
			<select
				class="h-10 w-full bg-page px-3 text-sm text-body outline-none focus:ring-2 focus:ring-accent"
				value={value.origin ?? ''}
				onchange={event => updateSystem({ origin: (event.currentTarget.value || null) as RingSystemOrigin | null })}
			>
				{#each origins as origin (origin.value)}
					<option value={origin.value}>{origin.label}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="space-y-3">
		{#each value.bands as band, index (band)}
			<fieldset class="space-y-3 border border-border-subtle bg-page/40 p-4">
				<div class="flex items-center justify-between gap-3">
					<legend class="text-sm font-semibold text-heading">Band {index + 1}{band.name ? ` · ${band.name}` : ''}</legend>
					<Button variant="secondary" size="sm" onclick={() => removeBand(index)}>Remove</Button>
				</div>
				<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
					<Input
						label="Name"
						value={band.name ?? ''}
						placeholder="Optional band name"
						oninput={event => updateBand(index, { name: optionalText(event.currentTarget.value) })}
					/>
					<Input
						label="Inner radius (m)"
						type="number"
						step="any"
						min="0"
						value={band.innerRadiusM}
						oninput={event => updateBand(index, { innerRadiusM: event.currentTarget.valueAsNumber })}
					/>
					<Input
						label="Outer radius (m)"
						type="number"
						step="any"
						min="0"
						value={band.outerRadiusM}
						oninput={event => updateBand(index, { outerRadiusM: event.currentTarget.valueAsNumber })}
					/>
					<Input
						label="Colour"
						value={band.color ?? ''}
						placeholder="#d8c79a or descriptive name"
						oninput={event => updateBand(index, { color: optionalText(event.currentTarget.value) })}
					/>
					<Input
						label="Presentation opacity"
						type="number"
						step="any"
						min="0"
						max="1"
						value={band.opacity ?? ''}
						hint="Display alpha from 0 to 1; this is not scientific optical depth."
						oninput={event => updateBand(index, { opacity: optionalNumber(event.currentTarget) })}
					/>
					<Input
						label="Optical depth"
						type="number"
						step="any"
						min="0"
						value={band.opticalDepth ?? ''}
						hint="Optional authored scientific value; it does not drive opacity."
						oninput={event => updateBand(index, { opticalDepth: optionalNumber(event.currentTarget) })}
					/>
					<Input
						label="Composition"
						value={band.composition ?? ''}
						placeholder="Ice, silicate dust…"
						oninput={event => updateBand(index, { composition: optionalText(event.currentTarget.value) })}
					/>
					<label class="space-y-1 text-xs font-medium text-heading">
						<span>Provenance</span>
						<select
							class="h-10 w-full bg-surface px-3 text-sm text-body outline-none focus:ring-2 focus:ring-accent"
							value={band.provenance}
							onchange={event => updateBand(index, { provenance: event.currentTarget.value as RingBandProvenance })}
						>
							{#each provenances as provenance (provenance.value)}
								<option value={provenance.value}>{provenance.label}</option>
							{/each}
						</select>
					</label>
					<Input
						label="Evidence references"
						value={band.evidenceReferences?.join(', ') ?? ''}
						placeholder="Comma-separated references"
						oninput={event => updateBand(index, {
							evidenceReferences: event.currentTarget.value.split(',').map(item => item.trim()).filter(Boolean),
						})}
					/>
				</div>
			</fieldset>
		{:else}
			<p class="border border-dashed border-border-subtle p-4 text-sm text-secondary">
				No authored bands. This explicit empty system suppresses the legacy illustrative ring.
			</p>
		{/each}
	</div>

	<Button variant="secondary" onclick={addBand}>Add band</Button>
</div>
