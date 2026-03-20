<script lang="ts">
	import type { ActionData } from './$types.js'

	let { form }: { form: ActionData } = $props()
</script>

<div class="max-w-md mx-auto mt-20 p-6">
	<h1 class="text-2xl font-bold mb-6">Create account</h1>

	{#if form?.error}
		<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-sm mb-4 text-sm">
			{form.error}
		</div>
	{/if}

	<form method="POST" class="space-y-4">
		<div>
			<label for="username" class="block text-sm font-medium mb-1">Username</label>
			<input
				id="username"
				name="username"
				type="text"
				required
				minlength="3"
				value={form?.username ?? ''}
				class="
					w-full border border-border-strong rounded-sm px-3 py-2 text-sm
					focus:outline-none focus:ring-2 focus:ring-accent
				"
			/>
		</div>
		<div>
			<label for="password" class="block text-sm font-medium mb-1">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				required
				minlength="8"
				class="
					w-full border border-border-strong rounded-sm px-3 py-2 text-sm
					focus:outline-none focus:ring-2 focus:ring-accent
				"
			/>
		</div>
		<div>
			<label for="confirm" class="block text-sm font-medium mb-1">Confirm password</label>
			<input
				id="confirm"
				name="confirm"
				type="password"
				required
				class="
					w-full border border-border-strong rounded-sm px-3 py-2 text-sm
					focus:outline-none focus:ring-2 focus:ring-accent
				"
			/>
		</div>
		<button
			type="submit"
			class="
				w-full bg-accent text-surface py-2 rounded-sm font-medium transition-colors
				hover:bg-accent-hover
			"
		>
			Register
		</button>
	</form>

	<p class="mt-4 text-sm text-secondary">
		Already have an account? <a href="/auth/login" class="text-accent hover:underline">Log in</a>
	</p>
</div>
