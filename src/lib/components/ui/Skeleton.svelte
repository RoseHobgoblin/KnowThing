<script lang="ts">
	let { class: className = '' }: { class?: string } = $props()
</script>

<div class="bg-raised animate-pulse {className}"></div>
