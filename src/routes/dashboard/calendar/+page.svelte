<script lang="ts">
	import type { PageData } from './$types.js'
	import { goto, invalidateAll } from '$app/navigation'

	let { data }: { data: PageData } = $props()

	let creating = $state(false)
	let newName = $state('')
	let newDesc = $state('')
	let newPrimary = $state(false)
	let submitting = $state(false)

	async function createCalendar(e: SubmitEvent) {
		e.preventDefault()
		if (!newName.trim()) return
		submitting = true

		const res = await fetch('/api/calendar', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: newName.trim(),
				description: newDesc.trim(),
				isPrimary: newPrimary || data.calendars.length === 0,
				staticData: {
					first_week_day: 0,
					weekdays: [
						{ name: 'Monday', abbreviation: 'Mon' },
						{ name: 'Tuesday', abbreviation: 'Tue' },
						{ name: 'Wednesday', abbreviation: 'Wed' },
						{ name: 'Thursday', abbreviation: 'Thu' },
						{ name: 'Friday', abbreviation: 'Fri' },
						{ name: 'Saturday', abbreviation: 'Sat' },
						{ name: 'Sunday', abbreviation: 'Sun' },
					],
					months: [
						{ name: 'Month 1', length: 30, month_type: 'regular' },
					],
					leap_days: [],
					moons: [],
					eras: [],
					seasons: [],
					display_moons: false,
					year_offset: 0,
					epoch_offset: 0,
				},
			}),
		})

		if (res.ok) {
			const cal = await res.json()
			goto(`/dashboard/calendar/${cal.id}`)
		}
		submitting = false
	}

	async function deleteCalendar(id: number, name: string) {
		if (!confirm(`Delete calendar "${name}"? This cannot be undone.`)) return
		await fetch(`/api/calendar/${id}`, { method: 'DELETE' })
		invalidateAll()
	}
</script>

<svelte:head>
	<title>Calendars — Dashboard — KnowThing</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-bold text-heading">Calendars</h1>
		<button onclick={() => creating = !creating} class="text-sm text-link hover:text-link-hover hover:underline">
			{creating ? 'Cancel' : '+ New Calendar'}
		</button>
	</div>

	{#if creating}
		<form onsubmit={createCalendar} class="bg-surface rounded-lg border border-border p-4 space-y-3">
			<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
				<div>
					<label class="block text-sm font-medium text-secondary mb-1">Name</label>
					<input type="text" bind:value={newName} required class="
						w-full px-3 py-2 border border-border-strong rounded-lg text-sm bg-surface
						focus:outline-none focus:ring-2 focus:ring-accent
					" placeholder="Imperial Calendar" />
				</div>
				<div>
					<label class="block text-sm font-medium text-secondary mb-1">Description</label>
					<input type="text" bind:value={newDesc} class="
						w-full px-3 py-2 border border-border-strong rounded-lg text-sm bg-surface
						focus:outline-none focus:ring-2 focus:ring-accent
					" placeholder="The standard civil calendar" />
				</div>
			</div>
			<label class="flex items-center gap-2 text-sm text-secondary">
				<input type="checkbox" bind:checked={newPrimary} class="rounded-sm border-border-strong text-accent focus:ring-accent" />
				Set as primary calendar
			</label>
			<button type="submit" disabled={submitting} class="
				px-4 py-1.5 bg-accent text-surface text-sm rounded-md font-medium transition-colors
				hover:bg-accent-hover disabled:opacity-50
			">
				{submitting ? 'Creating...' : 'Create'}
			</button>
		</form>
	{/if}

	{#if data.calendars.length === 0}
		<div class="text-center py-12 text-faint">
			<p class="text-lg mb-2">No calendars yet</p>
			<p class="text-sm">Create one to get started.</p>
		</div>
	{:else}
		<div class="bg-surface rounded-lg border border-border divide-y divide-border-subtle">
			{#each data.calendars as cal}
				<div class="flex items-center justify-between px-4 py-3">
					<div>
						<a href="/dashboard/calendar/{cal.id}" class="font-medium text-link hover:text-link-hover hover:underline">{cal.name}</a>
						{#if cal.isPrimary}
							<span class="ml-2 text-[10px] px-1.5 py-0.5 rounded-sm bg-accent-subtle text-accent font-medium">primary</span>
						{/if}
						{#if cal.description}
							<p class="text-xs text-faint mt-0.5">{cal.description}</p>
						{/if}
					</div>
					<button onclick={() => deleteCalendar(cal.id, cal.name)} class="text-xs text-error hover:underline">Delete</button>
				</div>
			{/each}
		</div>
	{/if}
</div>
