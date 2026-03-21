<script lang="ts">
	import { onMount } from 'svelte'
	import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view'
	import { EditorState } from '@codemirror/state'
	import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
	import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
	import { syntaxHighlighting, HighlightStyle, StreamLanguage } from '@codemirror/language'
	import { tags } from '@lezer/highlight'

	let {
		value = '',
		onchange,
	}: {
		value: string
		onchange?: (value: string) => void
	} = $props()

	let container: HTMLDivElement
	let view: EditorView

	// Simple wikitext stream parser for syntax highlighting
	const wikitextLanguage = StreamLanguage.define({
		token(stream) {
			if (stream.match('\'\'\'\'\'') || stream.match('\'\'\'') || stream.match('\'\'')) return 'strong'
			if (stream.sol() && /^={2,6}/.test(stream)) { stream.skipToEnd(); return 'heading' }
			if (stream.match('{{')) return 'keyword'
			if (stream.match('}}')) return 'keyword'
			if (stream.match('[[')) return 'link'
			if (stream.match(']]')) return 'link'
			if (stream.match('[')) return 'url'
			if (stream.match(']')) return 'url'
			if (/<\/?[A-Za-z][^>]*>/.test(stream)) return 'tag'
			if (stream.sol() && /^[!{|}]-?/.test(stream)) return 'meta'
			if (stream.sol() && /^[#*:;]+/.test(stream)) return 'list'
			if (stream.match('{{{')) return 'variableName'
			if (stream.match('}}}')) return 'variableName'
			if (stream.sol() && /^-{4,}/.test(stream)) return 'contentSeparator'
			stream.next()
			return null
		},
	})

	const wikiHighlight = HighlightStyle.define([
		{ tag: tags.heading, color: '#1a56db', fontWeight: 'bold' },
		{ tag: tags.strong, color: '#7c3aed' },
		{ tag: tags.keyword, color: '#b45309', fontWeight: 'bold' },
		{ tag: tags.link, color: '#0369a1' },
		{ tag: tags.url, color: '#0891b2' },
		{ tag: tags.meta, color: '#6d28d9' },
		{ tag: tags.tagName, color: '#be185d' },
		{ tag: tags.variableName, color: '#dc2626' },
		{ tag: tags.contentSeparator, color: '#9ca3af' },
	])

	// ── Toolbar actions ──────────────────────────────────────────
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
		{ label: 'B', title: 'Bold', action: () => wrapSelection('\'\'\'', '\'\'\'', 'bold text') },
		{ label: 'I', title: 'Italic', action: () => wrapSelection('\'\'', '\'\'', 'italic text') },
		{ label: 'Link', title: 'Internal link', action: () => wrapSelection('[[', ']]', 'Page Name') },
		{ label: 'H2', title: 'Heading 2', action: () => wrapSelection('== ', ' ==', 'Heading') },
		{ label: 'H3', title: 'Heading 3', action: () => wrapSelection('=== ', ' ===', 'Heading') },
		{ label: 'Img', title: 'Image', action: () => insertAtCursor('[[File:filename.png|thumb|Caption]]') },
		{ label: '{}', title: 'Template', action: () => wrapSelection('{{', '}}', 'Template') },
		{ label: 'List', title: 'Bullet list', action: () => insertAtCursor('\n* Item\n* Item\n') },
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
				wikitextLanguage,
				syntaxHighlighting(wikiHighlight),
				keymap.of([
					...defaultKeymap,
					...historyKeymap,
					...searchKeymap,
					indentWithTab,
				]),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						onchange?.(update.state.doc.toString())
					}
				}),
				EditorView.lineWrapping,
				EditorView.theme({
					'&': { height: '100%', fontSize: '14px' },
					'.cm-scroller': { overflow: 'auto', fontFamily: 'Consolas, monospace' },
					'.cm-content': { padding: '8px 0' },
					'&.cm-focused': { outline: '2px solid #d97706' },
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

<div class="border border-border-strong rounded-sm overflow-hidden h-full flex flex-col">
	<!-- Toolbar -->
	<div class="flex items-center gap-0.5 px-2 py-1.5 bg-page border-b border-border flex-wrap">
		{#each toolbar as button}
			<button
				type="button"
				onclick={button.action}
				title={button.title}
				class="
					px-2 py-1 text-xs font-mono text-secondary rounded-sm transition-colors min-w-8 text-center
					hover:bg-accent-light hover:text-accent-text
				"
			>
				{button.label}
			</button>
		{/each}
	</div>

	<!-- Editor -->
	<div bind:this={container} class="flex-1 min-h-0"></div>
</div>
