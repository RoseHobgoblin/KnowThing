import { describe, it, expect } from 'vitest';
import {
	substituteParams,
	processIncludeTags,
	expandTemplate
} from './template-expansion.js';
import type { TemplateArg } from './types.js';

describe('substituteParams', () => {
	it('substitutes positional params', () => {
		const args: TemplateArg[] = [
			{ name: null, value: 'Hello' },
			{ name: null, value: 'World' }
		];
		expect(substituteParams('{{{1}}} {{{2}}}', args)).toBe('Hello World');
	});

	it('substitutes named params', () => {
		const args: TemplateArg[] = [
			{ name: 'title', value: 'Gondor' },
			{ name: 'type', value: 'Kingdom' }
		];
		expect(substituteParams('{{{title}}} is a {{{type}}}', args)).toBe('Gondor is a Kingdom');
	});

	it('is case-insensitive for param names', () => {
		const args: TemplateArg[] = [{ name: 'Title', value: 'Rohan' }];
		expect(substituteParams('{{{title}}}', args)).toBe('Rohan');
	});

	it('uses default value when param missing', () => {
		expect(substituteParams('{{{name|Unknown}}}', [])).toBe('Unknown');
	});

	it('prefers provided value over default', () => {
		const args: TemplateArg[] = [{ name: 'name', value: 'Aragorn' }];
		expect(substituteParams('{{{name|Unknown}}}', args)).toBe('Aragorn');
	});

	it('returns empty string for missing param with no default', () => {
		expect(substituteParams('{{{missing}}}', [])).toBe('');
	});

	it('handles mixed positional and named', () => {
		const args: TemplateArg[] = [
			{ name: null, value: 'First' },
			{ name: 'key', value: 'Named' },
			{ name: null, value: 'Second' }
		];
		expect(substituteParams('{{{1}}} {{{key}}} {{{2}}}', args)).toBe('First Named Second');
	});

	it('leaves nested triple braces alone when resolved', () => {
		const args: TemplateArg[] = [{ name: 'x', value: 'val' }];
		expect(substituteParams('before {{{x}}} after', args)).toBe('before val after');
	});
});

describe('processIncludeTags', () => {
	describe('transcluding (embedding)', () => {
		it('extracts only onlyinclude content if present', () => {
			const src = 'ignored <onlyinclude>kept</onlyinclude> also ignored';
			expect(processIncludeTags(src, true)).toBe('kept');
		});

		it('concatenates multiple onlyinclude blocks', () => {
			const src = '<onlyinclude>A</onlyinclude> skip <onlyinclude>B</onlyinclude>';
			expect(processIncludeTags(src, true)).toBe('AB');
		});

		it('strips noinclude blocks', () => {
			const src = 'keep <noinclude>docs only</noinclude> this';
			expect(processIncludeTags(src, true)).toBe('keep  this');
		});

		it('unwraps includeonly tags', () => {
			const src = 'before <includeonly>transcluded</includeonly> after';
			expect(processIncludeTags(src, true)).toBe('before transcluded after');
		});
	});

	describe('direct view (template page)', () => {
		it('strips includeonly blocks', () => {
			const src = 'visible <includeonly>hidden</includeonly> also visible';
			expect(processIncludeTags(src, false)).toBe('visible  also visible');
		});

		it('unwraps noinclude tags', () => {
			const src = 'text <noinclude>documentation</noinclude> more';
			expect(processIncludeTags(src, false)).toBe('text documentation more');
		});

		it('unwraps onlyinclude tags', () => {
			const src = 'before <onlyinclude>content</onlyinclude> after';
			expect(processIncludeTags(src, false)).toBe('before content after');
		});
	});
});

describe('expandTemplate', () => {
	it('combines include processing and param substitution', () => {
		const src = '<noinclude>Docs here</noinclude>Name: {{{name|???}}}';
		const args: TemplateArg[] = [{ name: 'name', value: 'Elrond' }];
		expect(expandTemplate(src, args)).toBe('Name: Elrond');
	});

	it('respects max depth', () => {
		const result = expandTemplate('text', [], 10);
		expect(result).toContain('depth exceeded');
	});

	it('handles empty template', () => {
		expect(expandTemplate('', [])).toBe('');
	});

	it('full infobox-like expansion', () => {
		const src = `<noinclude>Template documentation</noinclude><includeonly>{| class="infobox"
|-
! {{{title|Untitled}}}
|-
| Type: {{{type|Unknown}}}
|-
| Region: {{{region|N/A}}}
|}</includeonly>`;

		const args: TemplateArg[] = [
			{ name: 'title', value: 'Gondor' },
			{ name: 'type', value: 'Kingdom' },
			{ name: 'region', value: 'Southern Middle-earth' }
		];

		const result = expandTemplate(src, args);
		expect(result).toContain('Gondor');
		expect(result).toContain('Kingdom');
		expect(result).toContain('Southern Middle-earth');
		expect(result).not.toContain('documentation');
	});
});
