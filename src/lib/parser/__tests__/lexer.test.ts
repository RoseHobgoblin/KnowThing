import { describe, it, expect } from 'vitest';
import { tokenize } from '../lexer.js';

describe('lexer', () => {
	it('tokenizes headings', () => {
		const tokens = tokenize('== Hello ==');
		expect(tokens).toEqual([{ type: 'heading', level: 2, content: 'Hello' }]);
	});

	it('tokenizes level 3 heading', () => {
		const tokens = tokenize('=== Sub Section ===');
		expect(tokens).toEqual([{ type: 'heading', level: 3, content: 'Sub Section' }]);
	});

	it('tokenizes horizontal rules', () => {
		const tokens = tokenize('----');
		expect(tokens).toEqual([{ type: 'horizontal_rule' }]);
	});

	it('tokenizes blank lines', () => {
		const tokens = tokenize('');
		expect(tokens).toEqual([{ type: 'blank_line' }]);
	});

	it('tokenizes unordered list items', () => {
		const tokens = tokenize('* Item 1\n** Nested');
		expect(tokens).toEqual([
			{ type: 'unordered_list_item', depth: 1, content: 'Item 1' },
			{ type: 'unordered_list_item', depth: 2, content: 'Nested' }
		]);
	});

	it('tokenizes ordered list items', () => {
		const tokens = tokenize('# First\n# Second');
		expect(tokens).toEqual([
			{ type: 'ordered_list_item', depth: 1, content: 'First' },
			{ type: 'ordered_list_item', depth: 1, content: 'Second' }
		]);
	});

	it('tokenizes table', () => {
		const tokens = tokenize('{| class="wikitable"\n|-\n! Header\n| Cell\n|}');
		expect(tokens).toEqual([
			{ type: 'table_start', attrs: 'class="wikitable"' },
			{ type: 'table_row', attrs: '' },
			{ type: 'table_header', content: 'Header' },
			{ type: 'table_cell', content: 'Cell' },
			{ type: 'table_end' }
		]);
	});

	it('tokenizes definition list', () => {
		const tokens = tokenize('; Term : Definition');
		expect(tokens).toEqual([
			{ type: 'definition_list_item', term: 'Term', definition: 'Definition' }
		]);
	});

	it('tokenizes preformatted lines', () => {
		const tokens = tokenize(' code here');
		expect(tokens).toEqual([{ type: 'preformatted', content: 'code here' }]);
	});

	it('tokenizes text lines', () => {
		const tokens = tokenize('Just some text');
		expect(tokens).toEqual([{ type: 'text_line', content: 'Just some text' }]);
	});

	it('joins multi-line templates', () => {
		const input = '{{Infobox country\n|capital=Rome\n|population=60000000\n}}';
		const tokens = tokenize(input);
		// Should be a single text_line with the joined template
		expect(tokens.length).toBe(1);
		expect(tokens[0].type).toBe('text_line');
	});

	it('handles mixed content', () => {
		const input = '== Title ==\n\nSome text.\n\n* List item\n\n----';
		const tokens = tokenize(input);
		const types = tokens.map((t) => t.type);
		expect(types).toEqual([
			'heading',
			'blank_line',
			'text_line',
			'blank_line',
			'unordered_list_item',
			'blank_line',
			'horizontal_rule'
		]);
	});
});
