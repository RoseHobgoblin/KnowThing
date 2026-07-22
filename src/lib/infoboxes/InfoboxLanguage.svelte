<script lang="ts">
	import type { FieldMap } from './types.js'
	import { getField, getNumberedFields } from './types.js'
	import InfoboxShell from './InfoboxShell.svelte'
	import InfoboxRow from './InfoboxRow.svelte'
	import InfoboxSection from './InfoboxSection.svelte'

	let { fields }: { fields: FieldMap } = $props()

	const title = $derived(getField(fields, 'name', 'nativename') ?? '')
	const nativeName = $derived(getField(fields, 'nativename', 'altname') ?? '')
	const image = $derived(getField(fields, 'image') ?? '')
	const imageCaption = $derived(getField(fields, 'imagecaption') ?? '')

	const pronunciation = $derived(getField(fields, 'pronunciation') ?? '')
	const states = $derived(getField(fields, 'states', 'state') ?? '')
	const region = $derived(getField(fields, 'region') ?? '')
	const ethnicity = $derived(getField(fields, 'ethnicity') ?? '')

	const speakers = $derived(getField(fields, 'speakers') ?? '')
	const speakersDate = $derived(getField(fields, 'date') ?? '')
	const speakersRef = $derived(getField(fields, 'ref') ?? '')
	const extinct = $derived(getField(fields, 'extinct') ?? '')
	const era = $derived(getField(fields, 'era') ?? '')

	const familyColor = $derived(getField(fields, 'familycolor') ?? '')
	const family = $derived(getField(fields, 'family') ?? '')
	const protoname = $derived(getField(fields, 'protoname') ?? '')
	const familyChain = $derived(getNumberedFields(fields, 'fam', 15))
	const ancestorChain = $derived(getNumberedFields(fields, 'ancestor', 10))

	// Wikipedia uses lc1/ld1 (code/name) pairs for dialects/varieties; fall back to dia1..diaN
	const dialects: string[] = $derived.by(() => {
		const out: string[] = []
		for (let i = 1; i <= 20; i++) {
			const d = fields.get(`ld${i}`) || fields.get(`dia${i}`)
			if (d) out.push(d)
		}
		return out
	})

	const script = $derived(getField(fields, 'script') ?? '')
	const sign = $derived(getField(fields, 'sign') ?? '')
	const creator = $derived(getField(fields, 'creator') ?? '')
	const created = $derived(getField(fields, 'created') ?? '')
	const setting = $derived(getField(fields, 'setting') ?? '')

	const nation = $derived(getField(fields, 'nation') ?? '')
	const minority = $derived(getField(fields, 'minority') ?? '')
	const agency = $derived(getField(fields, 'agency') ?? '')

	const iso1 = $derived(getField(fields, 'iso1') ?? '')
	const iso2 = $derived(getField(fields, 'iso2') ?? '')
	const iso2b = $derived(getField(fields, 'iso2b') ?? '')
	const iso2t = $derived(getField(fields, 'iso2t') ?? '')
	const iso3 = $derived(getField(fields, 'iso3') ?? '')
	const glotto = $derived(getField(fields, 'glotto') ?? '')
	const glottoname = $derived(getField(fields, 'glottoname') ?? '')
	const lingua = $derived(getField(fields, 'lingua') ?? '')

	const familyTree = $derived(familyChain.map(f => f.value).join(' › '))
	const ancestors = $derived(ancestorChain.map(a => a.value).join(' › '))
	const speakerLine = $derived(speakers ? `${speakers}${speakersDate ? ` (${speakersDate})` : ''}${speakersRef ? ` ${speakersRef}` : ''}` : '')
	const glottoLine = $derived(glotto ? `${glotto}${glottoname ? ` (${glottoname})` : ''}` : '')
</script>

<InfoboxShell {title} subtitle={nativeName === title ? '' : nativeName} {image} {imageCaption}>
	<InfoboxSection>
		{#if familyColor}
			<div class="h-1.5 -mx-3 mb-1.5" style="background: {familyColor};"></div>
		{/if}
	<InfoboxRow label="Pronunciation" value={pronunciation} />
	<InfoboxRow label="Native to" value={states} />
	<InfoboxRow label="Region" value={region} />
	<InfoboxRow label="Ethnicity" value={ethnicity} />
	<InfoboxRow label="Era" value={era} />
	<InfoboxRow label="Extinct" value={extinct} />
	</InfoboxSection>

	{#if speakerLine}
		<InfoboxSection title="Speakers">
		<InfoboxRow label="Native speakers" value={speakerLine} />
		</InfoboxSection>
	{/if}

	{#if family || familyTree || protoname || ancestors}
		<InfoboxSection title="Classification">
		<InfoboxRow label="Family" value={family} />
		<InfoboxRow label="Family tree" value={familyTree} />
		<InfoboxRow label="Proto-language" value={protoname} />
		<InfoboxRow label="Ancestors" value={ancestors} />
		</InfoboxSection>
	{/if}

	{#if dialects.length > 0}
		<InfoboxSection title="Dialects">
		<InfoboxRow label="Varieties" value={dialects.join(', ')} />
		</InfoboxSection>
	{/if}

	{#if script || sign}
		<InfoboxSection title="Writing system">
		<InfoboxRow label="Script" value={script} />
		<InfoboxRow label="Signed forms" value={sign} />
		</InfoboxSection>
	{/if}

	{#if creator || created || setting}
		<InfoboxSection title="Constructed">
		<InfoboxRow label="Created by" value={creator} />
		<InfoboxRow label="Created" value={created} />
		<InfoboxRow label="Setting" value={setting} />
		</InfoboxSection>
	{/if}

	{#if nation || minority || agency}
		<InfoboxSection title="Official status">
		<InfoboxRow label="Official in" value={nation} />
		<InfoboxRow label="Recognised minority in" value={minority} />
		<InfoboxRow label="Regulated by" value={agency} />
		</InfoboxSection>
	{/if}

	{#if iso1 || iso2 || iso2b || iso2t || iso3 || glotto || lingua}
		<InfoboxSection title="Language codes">
		<InfoboxRow label="ISO 639-1" value={iso1} />
		<InfoboxRow label="ISO 639-2" value={iso2} />
		<InfoboxRow label="ISO 639-2 (B)" value={iso2b} />
		<InfoboxRow label="ISO 639-2 (T)" value={iso2t} />
		<InfoboxRow label="ISO 639-3" value={iso3} />
		<InfoboxRow label="Glottolog" value={glottoLine} />
		<InfoboxRow label="Linguasphere" value={lingua} />
		</InfoboxSection>
	{/if}
</InfoboxShell>
