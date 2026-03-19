<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
	import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
	import { syntaxHighlighting, HighlightStyle, StreamLanguage } from '@codemirror/language';
	import { tags } from '@lezer/highlight';

	let {
		value = '',
		onchange
	}: {
		value: string;
		onchange?: (value: string) => void;
	} = $props();

	let container: HTMLDivElement;
	let view: EditorView;

	// Simple wikitext stream parser for syntax highlighting
	const wikitextLanguage = StreamLanguage.define({
		token(stream) {
			// Bold/italic
			if (stream.match("'''''") || stream.match("'''") || stream.match("''")) {
				return 'strong';
			}
			// Heading
			if (stream.sol() && stream.match(/^={2,6}/)) {
				stream.skipToEnd();
				return 'heading';
			}
			// Template {{ }}
			if (stream.match('{{')) return 'keyword';
			if (stream.match('}}')) return 'keyword';
			// Internal link [[ ]]
			if (stream.match('[[')) return 'link';
			if (stream.match(']]')) return 'link';
			// External link
			if (stream.match('[')) return 'url';
			if (stream.match(']')) return 'url';
			// HTML tags
			if (stream.match(/<\/?[a-zA-Z][^>]*>/)) return 'tag';
			// Table
			if (stream.sol() && stream.match(/^[{|!}\|]-?/)) return 'meta';
			// List
			if (stream.sol() && stream.match(/^[*#;:]+/)) return 'list';
			// Template param {{{ }}}
			if (stream.match('{{{')) return 'variableName';
			if (stream.match('}}}')) return 'variableName';
			// Horizontal rule
			if (stream.sol() && stream.match(/^-{4,}/)) return 'contentSeparator';

			stream.next();
			return null;
		}
	});

	const wikiHighlight = HighlightStyle.define([
		{ tag: tags.heading, color: '#1a56db', fontWeight: 'bold' },
		{ tag: tags.strong, color: '#7c3aed' },
		{ tag: tags.keyword, color: '#b45309', fontWeight: 'bold' },
		{ tag: tags.link, color: '#0369a1' },
		{ tag: tags.url, color: '#0891b2' },
		{ tag: tags.meta, color: '#6d28d9' },
		{ tag: tags.tagName, color: '#be185d' },
		{ tag: tags.variableName, color: '#dc2626' },
		{ tag: tags.contentSeparator, color: '#9ca3af' }
	]);

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
					indentWithTab
				]),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						const newValue = update.state.doc.toString();
						onchange?.(newValue);
					}
				}),
				EditorView.theme({
					'&': { height: '100%', fontSize: '14px' },
					'.cm-scroller': { overflow: 'auto', fontFamily: 'Consolas, monospace' },
					'.cm-content': { padding: '8px 0' },
					'&.cm-focused': { outline: '2px solid #3b82f6' }
				})
			]
		});

		view = new EditorView({ state, parent: container });

		return () => view.destroy();
	});

	// Expose the current value for form submission
	export function getValue(): string {
		return view?.state.doc.toString() ?? value;
	}
</script>

<div bind:this={container} class="border border-stone-300 rounded overflow-hidden h-full"></div>
