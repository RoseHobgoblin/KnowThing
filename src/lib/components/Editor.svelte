<script lang="ts">
	import { onMount } from 'svelte'
	import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view'
	import { EditorState } from '@codemirror/state'
	import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
	import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
	import { syntaxHighlighting, HighlightStyle, StreamLanguage } from '@codemirror/language'
	import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
	import { bracketMatching } from '@codemirror/language'
	import { tags } from '@lezer/highlight'
	import TextB from 'phosphor-svelte/lib/TextB'
	import TextItalic from 'phosphor-svelte/lib/TextItalic'
	import LinkSimple from 'phosphor-svelte/lib/LinkSimple'
	import TextHTwo from 'phosphor-svelte/lib/TextHTwo'
	import TextHThree from 'phosphor-svelte/lib/TextHThree'
	import ImageSquare from 'phosphor-svelte/lib/ImageSquare'
	import BracketsCurly from 'phosphor-svelte/lib/BracketsCurly'
	import ListBullets from 'phosphor-svelte/lib/ListBullets'
	import Table from 'phosphor-svelte/lib/Table'

	let {
		value = '',
		onchange,
	}: {
		value: string
		onchange?: (value: string) => void
	} = $props()

	let container: HTMLDivElement
	let view: EditorView

	// ── Wikitext stream parser ──────────────────────────────────
	let insideTemplate = false
	let insideLink = false

	const wikitextLanguage = StreamLanguage.define({
		startState() { return { insideTemplate: false, insideLink: false } },
		token(stream, state) {
			// Multi-line template tracking
			if (state.insideTemplate) {
				if (stream.match('}}')) {
					state.insideTemplate = false
					return 'keyword'
				}
				if (stream.match('|')) return 'operator'
				if (stream.match(/^[^|}]+/)) return 'string'
				stream.next()
				return 'string'
			}

			// Multi-line link tracking
			if (state.insideLink) {
				if (stream.match(']]')) {
					state.insideLink = false
					return 'link'
				}
				if (stream.match('|')) return 'operator'
				if (stream.match(/^[^\]|]+/)) return 'link'
				stream.next()
				return 'link'
			}

			// Bold/italic
			if (stream.match('\'\'\'\'\'')) return 'strong'
			if (stream.match('\'\'\'')) return 'strong'
			if (stream.match('\'\'')) return 'emphasis'

			// Headings (start of line)
			if (stream.sol() && stream.match(/^={2,6}/)) {
				stream.skipToEnd()
				return 'heading'
			}

			// Template open
			if (stream.match('{{')) {
				state.insideTemplate = true
				return 'keyword'
			}

			// Link open
			if (stream.match('[[')) {
				state.insideLink = true
				return 'link'
			}

			// External link
			if (stream.match(/^\[https?:\/\/[^\]]*\]/)) return 'url'

			// HTML tags
			if (stream.match(/<\/?[A-Za-z][^>]*>/)) return 'tagName'

			// Table markup
			if (stream.sol() && stream.match(/^[{|}][-+}!]/)) return 'meta'
			if (stream.sol() && stream.match(/^[!|]/)) return 'meta'

			// Lists
			if (stream.sol() && stream.match(/^[#*:;]+/)) return 'list'

			// Horizontal rule
			if (stream.sol() && stream.match(/^-{4,}/)) return 'contentSeparator'

			// Category/file
			if (stream.match(/^\[\[(?:Category|File|Image):/i)) {
				state.insideLink = true
				return 'typeName'
			}

			stream.next()
			return null
		},
	})

	// ── Syntax colors for dark theme ────────────────────────────
	const wikiHighlight = HighlightStyle.define([
		{ tag: tags.heading, color: 'var(--color-heading)', fontWeight: 'bold' },
		{ tag: tags.strong, color: 'var(--color-accent)' },
		{ tag: tags.emphasis, color: 'var(--color-accent)', fontStyle: 'italic' },
		{ tag: tags.keyword, color: 'var(--color-syntax-keyword)', fontWeight: 'bold' },
		{ tag: tags.link, color: 'var(--color-link)' },
		{ tag: tags.url, color: 'var(--color-syntax-url)' },
		{ tag: tags.operator, color: 'var(--color-syntax-operator)' },
		{ tag: tags.string, color: 'var(--color-syntax-string)' },
		{ tag: tags.meta, color: 'var(--color-syntax-meta)' },
		{ tag: tags.tagName, color: 'var(--color-syntax-tag)' },
		{ tag: tags.typeName, color: 'var(--color-syntax-type)' },
		{ tag: tags.variableName, color: 'var(--color-syntax-variable)' },
		{ tag: tags.contentSeparator, color: 'var(--color-faint)' },
	])

	// ── Autocomplete ────────────────────────────────────────────
	async function wikiComplete(context: CompletionContext): Promise<CompletionResult | null> {
		// Check for [[ link completion
		const linkMatch = context.matchBefore(/\[\[[^\]]*/)
		if (linkMatch) {
			const query = linkMatch.text.slice(2) // strip [[
			if (query.length < 1) return null
			try {
				const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&scope=pages&limit=8`)
				if (!res.ok) return null
				const payload = await res.json()
				const results = payload.results ?? []
				return {
					from: linkMatch.from + 2,
					options: results.map((r: any) => ({
						label: r.title,
						detail: Array.isArray(r.meta) ? r.meta.join(' · ') : '',
						apply: r.title,
					})),
				}
			} catch {
				return null
			}
		}

		// Check for {{ template completion
		const templateMatch = context.matchBefore(/\{\{[^}]*/)
		if (templateMatch) {
			const query = templateMatch.text.slice(2)
			if (query.length < 1) return null
			const builtins = [
				'Infobox country', 'Infobox person', 'Infobox settlement', 'Infobox language',
				'Infobox star', 'Infobox planet', 'Infobox system', 'Infobox religion',
				'Infobox royalty', 'Infobox officeholder',
				'Quote', 'Main', 'See also', 'System map',
				'CURRENTYEAR', 'CURRENTMONTHNAME', 'CURRENTDAY', 'CURRENTDAYNAME',
				'CURRENTERA', 'CURRENTSEASON', 'CURRENTDATE',
			]
			const filtered = builtins.filter(t => t.toLowerCase().includes(query.toLowerCase()))
			return {
				from: templateMatch.from + 2,
				options: filtered.map(t => ({ label: t })),
			}
		}

		return null
	}

	// ── Toolbar actions ─────────────────────────────────────────
	function wrapSelection(before: string, after: string, placeholder: string = '') {
		if (!view) return
		const { from, to } = view.state.selection.main
		const selected = view.state.sliceDoc(from, to)
		const text = selected || placeholder
		view.dispatch({
			changes: { from, to, insert: `${before}${text}${after}` },
			selection: { anchor: from + before.length, head: from + before.length + text.length },
		})
		view.focus()
	}

	function insertAtCursor(text: string) {
		if (!view) return
		const pos = view.state.selection.main.head
		view.dispatch({ changes: { from: pos, insert: text } })
		view.focus()
	}

	const toolbar = [
		{ icon: TextB, title: 'Bold (Ctrl+B)', action: () => wrapSelection('\'\'\'', '\'\'\'', 'bold text') },
		{ icon: TextItalic, title: 'Italic (Ctrl+I)', action: () => wrapSelection('\'\'', '\'\'', 'italic text') },
		{ icon: LinkSimple, title: 'Internal link', action: () => wrapSelection('[[', ']]', 'Page Name') },
		{ icon: TextHTwo, title: 'Heading 2', action: () => wrapSelection('== ', ' ==', 'Heading') },
		{ icon: TextHThree, title: 'Heading 3', action: () => wrapSelection('=== ', ' ===', 'Heading') },
		{ icon: ImageSquare, title: 'Image', action: () => insertAtCursor('[[File:filename.png|thumb|Caption]]') },
		{ icon: BracketsCurly, title: 'Template', action: () => wrapSelection('{{', '}}', 'Template') },
		{ icon: ListBullets, title: 'Bullet list', action: () => insertAtCursor('\n* Item\n* Item\n') },
		{ icon: Table, title: 'Table', action: () => insertAtCursor('\n{| class="wikitable"\n|-\n! Header 1 !! Header 2\n|-\n| Cell 1 || Cell 2\n|}\n') },
	]

	onMount(() => {
		const state = EditorState.create({
			doc: value,
			extensions: [
				lineNumbers(),
				highlightActiveLine(),
				drawSelection(),
				history(),
				highlightSelectionMatches(),
				bracketMatching(),
				wikitextLanguage,
				syntaxHighlighting(wikiHighlight),
				autocompletion({
					override: [wikiComplete],
					activateOnTyping: true,
				}),
				keymap.of([
					...defaultKeymap,
					...historyKeymap,
					...searchKeymap,
					indentWithTab,
					// Ctrl+B for bold
					{ key: 'Mod-b', run: () => { wrapSelection('\'\'\'', '\'\'\'', 'bold text'); return true } },
					// Ctrl+I for italic
					{ key: 'Mod-i', run: () => { wrapSelection('\'\'', '\'\'', 'italic text'); return true } },
					// Ctrl+K for link
					{ key: 'Mod-k', run: () => { wrapSelection('[[', ']]', 'Page Name'); return true } },
				]),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						onchange?.(update.state.doc.toString())
					}
				}),
				EditorView.lineWrapping,
				EditorView.theme({
					'&': { height: '100%', fontSize: '14px' },
					'.cm-scroller': { overflow: 'auto', fontFamily: '\'JetBrains Mono\', Consolas, monospace' },
					'.cm-content': { padding: '8px 0' },
					'&.cm-focused': { outline: '2px solid var(--color-accent)' },
					'.cm-tooltip-autocomplete': {
						background: 'var(--color-surface) !important',
						border: '1px solid var(--color-border) !important',
					},
					'.cm-tooltip-autocomplete ul li': {
						color: 'var(--color-body)',
					},
					'.cm-tooltip-autocomplete ul li[aria-selected]': {
						background: 'var(--color-raised) !important',
						color: 'var(--color-heading)',
					},
					'.cm-completionLabel': {
						color: 'var(--color-body)',
					},
					'.cm-completionDetail': {
						color: 'var(--color-faint)',
						fontStyle: 'normal',
					},
				}),
			],
		})

		view = new EditorView({ state, parent: container })
		return () => view.destroy()
	})

	export function getValue(): string {
		return view?.state.doc.toString() ?? value
	}
</script>

<div class="border border-border-strong overflow-hidden h-full flex flex-col">
	<!-- Toolbar -->
	<div class="flex items-center gap-0.5 px-2 py-1.5 bg-page border-b border-border flex-wrap">
		{#each toolbar as button}
			<button
				type="button"
				onclick={button.action}
				title={button.title}
				class="
					p-1.5 text-secondary transition-colors
					hover:bg-raised hover:text-heading
				"
			>
				<svelte:component this={button.icon} size={16} weight="bold" />
			</button>
		{/each}
	</div>

	<!-- Editor -->
	<div bind:this={container} class="flex-1 min-h-0"></div>
</div>
