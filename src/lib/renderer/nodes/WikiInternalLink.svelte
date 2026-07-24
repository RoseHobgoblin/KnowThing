<script lang="ts">
	import { LinkPreview } from 'bits-ui'
	import type { WikiNode } from '$lib/parser/types.js'
	import { getKnowContext, slugify } from '../context.js'
	import WikiNodeComponent from '../WikiNode.svelte'
	import LinkPreviewCard from '$lib/components/LinkPreview.svelte'

	let { target, display }: { target: string, display: WikiNode[] | null } = $props()

	const ctx = getKnowContext()
	const slug = $derived(slugify(target))

	// Look up from the per-page resolved links map (populated server-side).
	// The server already resolves cross-domain fallthrough, so one lookup suffices.
	const resolved = $derived.by(() => {
		const found = ctx.resolvedLinks.get(`${ctx.sourceDomain}:${slug.toLowerCase()}`)
		if (found) return found
		// Redlinks land in Know (the default namespace) so the user can create
		// the article. Colon-namespace base URLs like `/Celestial:Therne/Foo`
		// would be gibberish — don't concatenate.
		return { href: `/know/${slug}`, exists: false }
	})

	const href = $derived(resolved.href)
	const exists = $derived(resolved.exists)
</script>

<LinkPreview.Root openDelay={400} closeDelay={100}>
	<LinkPreview.Trigger
		{href}
		class="know-link underline decoration-transparent transition-colors hover:decoration-current {exists ? 'text-link' : 'text-error-hover'}"
		title={exists ? undefined : target}
	>{#if display}{#each display as child, index (index)}<WikiNodeComponent node={child} />{/each}{:else}{target}{/if}</LinkPreview.Trigger>{#if exists}<LinkPreview.Portal>
			<LinkPreview.Content
				side="bottom"
				align="start"
				sideOffset={8}
				collisionPadding={8}
				class="z-50"
			>
				<LinkPreviewCard {slug} domain={href.split('/')[1]} />
			</LinkPreview.Content>
		</LinkPreview.Portal>{/if}
</LinkPreview.Root>
