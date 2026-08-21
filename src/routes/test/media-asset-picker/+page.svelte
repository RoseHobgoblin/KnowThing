<script lang="ts">
	import MediaAssetPicker from '$lib/feature/media/public/ui/MediaAssetPicker.svelte'
	import { rodderMediaProfile } from '$lib/feature/rodder/public/media-binding.js'
	import type { MediaAssetBinding } from '$lib/feature/media/public/media-binding.js'

	let value = $state<MediaAssetBinding | null>(null)
	let ready = $state(false)

	function markReady() {
		ready = true
	}
</script>

<svelte:head><title>Media asset picker fixture</title></svelte:head>

<main class="min-h-screen bg-page p-8 text-body" data-testid="picker-fixture" data-render-state={ready ? 'ready' : 'loading'} {@attach markReady}>
	<div class="mx-auto max-w-xl bg-surface p-5">
		<MediaAssetPicker
			label="Base color / appearance map"
			hint="sRGB 2:1 equirectangular image"
			profile={rodderMediaProfile('surface-albedo')}
			canUpload
			bind:value
		/>
		<output class="mt-4 block font-mono text-xs" data-testid="binding-output">
			{value ? `${value.mediaId}:${value.filename}:${value.contentHash}` : 'none'}
		</output>
	</div>
</main>
