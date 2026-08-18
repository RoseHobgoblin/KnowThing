import type { Component } from 'svelte'
import type { TemplateArg } from '$lib/parser/types.js'

import Quote from './builtins/Quote.svelte'
import Hatnote from './builtins/Hatnote.svelte'
import ShortDescription from './builtins/ShortDescription.svelte'
import Citation from './builtins/Citation.svelte'
import InlineTag from './builtins/InlineTag.svelte'
import Clear from './builtins/Clear.svelte'
import Anchor from './builtins/Anchor.svelte'
import Color from './builtins/Color.svelte'
import Lang from './builtins/Lang.svelte'
import Legend from './builtins/Legend.svelte'
import Columns from './builtins/Columns.svelte'
import Wt from './builtins/Wt.svelte'
import Sidebar from './builtins/Sidebar.svelte'
import Flag from './builtins/Flag.svelte'
import Convert from './builtins/Convert.svelte'
import Age from './builtins/Age.svelte'
import DateTpl from './builtins/Date.svelte'
import Footnote from './builtins/Footnote.svelte'
import ShortFootnote from './builtins/ShortFootnote.svelte'
import Notelist from './builtins/Notelist.svelte'
import WikiList from './builtins/WikiList.svelte'
import NativeName from './builtins/NativeName.svelte'
import Marriage from './builtins/Marriage.svelte'
import CollapsibleList from './builtins/CollapsibleList.svelte'
import RootMap from './builtins/RootMap.svelte'
import PhonemeGrid from '$lib/renderer/structured/PhonemeGrid.svelte'
import PhonologySection from '$lib/renderer/structured/PhonologySection.svelte'
import DiphthongList from '$lib/renderer/structured/DiphthongList.svelte'
import OrthographyTable from '$lib/renderer/structured/OrthographyTable.svelte'

/**
 * Each entry is a Svelte component plus the static props it always receives
 * (variant discriminators for grouped templates like hatnotes / inline tags).
 *
 * The dispatcher passes `args` at render time.
 */
export interface BuiltinEntry {
	// Loosely typed by necessity: entries supply their own required props
	// (e.g. Hatnote's `variant`) via staticProps, merged by the dispatcher at
	// render time — that per-entry pairing can't be expressed in a single
	// registry-wide Component<Props> type.

	component: Component<any>
	staticProps?: Record<string, unknown>
}

export const BUILTIN_TEMPLATES: Record<string, BuiltinEntry> = {
	'quote': { component: Quote },
	'main': { component: Hatnote, staticProps: { variant: 'main' } },
	'see also': { component: Hatnote, staticProps: { variant: 'see-also' } },
	'for': { component: Hatnote, staticProps: { variant: 'for' } },
	'about': { component: Hatnote, staticProps: { variant: 'about' } },
	'short description': { component: ShortDescription },
	'sidebar': { component: Sidebar },
	'columns': { component: Columns },
	'legend': { component: Legend },
	'color': { component: Color },
	'flag': { component: Flag },
	'lang': { component: Lang },
	'convert': { component: Convert },
	'date': { component: DateTpl },
	'age': { component: Age },
	'nowrap': { component: InlineTag, staticProps: { variant: 'nowrap' } },
	'small': { component: InlineTag, staticProps: { variant: 'small' } },
	'big': { component: InlineTag, staticProps: { variant: 'big' } },
	'sup': { component: InlineTag, staticProps: { variant: 'sup' } },
	'sub': { component: InlineTag, staticProps: { variant: 'sub' } },
	'nobold': { component: InlineTag, staticProps: { variant: 'nobold' } },
	'nbsp': { component: InlineTag, staticProps: { variant: 'nbsp' } },
	'hanging indent': { component: InlineTag, staticProps: { variant: 'hanging-indent' } },
	'ubl': { component: WikiList, staticProps: { variant: 'unbulleted' } },
	'unbulleted list': { component: WikiList, staticProps: { variant: 'unbulleted' } },
	'plainlist': { component: WikiList, staticProps: { variant: 'unbulleted' } },
	'hlist': { component: WikiList, staticProps: { variant: 'horizontal' } },
	'flatlist': { component: WikiList, staticProps: { variant: 'horizontal' } },
	'br separated entries': { component: WikiList, staticProps: { variant: 'br-separated' } },
	'native name': { component: NativeName },
	'marriage': { component: Marriage },
	'collapsible list': { component: CollapsibleList },
	'collapsed list': { component: CollapsibleList },
	'clear': { component: Clear },
	'anchor': { component: Anchor, staticProps: { visible: false } },
	'visible anchor': { component: Anchor, staticProps: { visible: true } },
	'refn': { component: Footnote, staticProps: { kind: 'refn' } },
	'efn': { component: Footnote, staticProps: { kind: 'efn' } },
	'notelist': { component: Notelist },
	'sfn': { component: ShortFootnote },
	'cite book': { component: Citation },
	'cite web': { component: Citation },
	'cite journal': { component: Citation },
	'wt': { component: Wt },
	'root map': { component: RootMap },
	'consonants': { component: PhonemeGrid, staticProps: { type: 'consonant' } },
	'vowels': { component: PhonemeGrid, staticProps: { type: 'vowel' } },
	'diphthongs': { component: DiphthongList },
	'phonology': { component: PhonologySection },
	'orthography': { component: OrthographyTable },
}
