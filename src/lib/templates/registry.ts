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
import SystemMap from './builtins/SystemMap.svelte'

/**
 * Each entry is a Svelte component plus the static props it always receives
 * (variant discriminators for grouped templates like hatnotes / inline tags).
 *
 * The dispatcher passes `args` at render time.
 */
export interface BuiltinEntry {
	component: Component<{ args: TemplateArg[] } & Record<string, unknown>>
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
	'system map': { component: SystemMap },
}
