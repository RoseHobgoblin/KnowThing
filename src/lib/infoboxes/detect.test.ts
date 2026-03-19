import { describe, it, expect } from 'vitest';
import { detectInfoboxType } from './detect.js';
import { buildFieldMap } from './types.js';
import type { TemplateArg } from '$lib/parser/types.js';

function makeFields(obj: Record<string, string>) {
	const args: TemplateArg[] = Object.entries(obj).map(([name, value]) => ({ name, value }));
	return buildFieldMap(args);
}

describe('detectInfoboxType', () => {
	describe('explicit keyword matching', () => {
		it('detects country', () => {
			expect(detectInfoboxType('Infobox country', new Map())).toBe('country');
		});
		it('detects nation as country', () => {
			expect(detectInfoboxType('Infobox Nation', new Map())).toBe('country');
		});
		it('detects former country', () => {
			expect(detectInfoboxType('Infobox former country', new Map())).toBe('former_country');
		});
		it('detects language', () => {
			expect(detectInfoboxType('Infobox language', new Map())).toBe('language');
		});
		it('detects settlement variants', () => {
			expect(detectInfoboxType('Infobox city', new Map())).toBe('settlement');
			expect(detectInfoboxType('Infobox town', new Map())).toBe('settlement');
			expect(detectInfoboxType('Infobox village', new Map())).toBe('settlement');
			expect(detectInfoboxType('Infobox prefecture', new Map())).toBe('settlement');
		});
		it('detects royalty variants', () => {
			expect(detectInfoboxType('Infobox royalty', new Map())).toBe('royalty');
			expect(detectInfoboxType('Infobox monarch', new Map())).toBe('royalty');
			expect(detectInfoboxType('Infobox king', new Map())).toBe('royalty');
			expect(detectInfoboxType('Infobox duchess', new Map())).toBe('royalty');
		});
		it('detects officeholder variants', () => {
			expect(detectInfoboxType('Infobox officeholder', new Map())).toBe('officeholder');
			expect(detectInfoboxType('Infobox politician', new Map())).toBe('officeholder');
			expect(detectInfoboxType('Infobox mayor', new Map())).toBe('officeholder');
		});
		it('detects person variants', () => {
			expect(detectInfoboxType('Infobox person', new Map())).toBe('person');
			expect(detectInfoboxType('Infobox writer', new Map())).toBe('person');
			expect(detectInfoboxType('Infobox scientist', new Map())).toBe('person');
		});
		it('detects religion', () => {
			expect(detectInfoboxType('Infobox religion', new Map())).toBe('religion');
			expect(detectInfoboxType('Infobox faith', new Map())).toBe('religion');
		});
	});

	describe('field-based heuristic detection', () => {
		it('detects country by fields', () => {
			const fields = makeFields({ capital: 'Amleth', government_type: 'Monarchy' });
			expect(detectInfoboxType('Infobox', fields)).toBe('country');
		});
		it('detects royalty by fields', () => {
			const fields = makeFields({ succession: 'King of Gondor', reign: '3019–3120' });
			expect(detectInfoboxType('Infobox', fields)).toBe('royalty');
		});
		it('detects officeholder by fields', () => {
			const fields = makeFields({ office: 'Chancellor', term_start: '3019' });
			expect(detectInfoboxType('Infobox', fields)).toBe('officeholder');
		});
		it('detects language by fields', () => {
			const fields = makeFields({ fam1: 'Elvish', speakers: '10000' });
			expect(detectInfoboxType('Infobox', fields)).toBe('language');
		});
		it('detects settlement by fields', () => {
			const fields = makeFields({ settlement_type: 'City', population_total: '50000' });
			expect(detectInfoboxType('Infobox', fields)).toBe('settlement');
		});
		it('detects person by fields', () => {
			const fields = makeFields({ birth_date: '3001', occupation: 'Blacksmith' });
			expect(detectInfoboxType('Infobox', fields)).toBe('person');
		});
		it('falls back to generic', () => {
			const fields = makeFields({ foo: 'bar', baz: 'qux' });
			expect(detectInfoboxType('Infobox', fields)).toBe('generic');
		});
	});

	describe('case insensitivity', () => {
		it('handles mixed case template names', () => {
			expect(detectInfoboxType('INFOBOX COUNTRY', new Map())).toBe('country');
			expect(detectInfoboxType('infobox Country', new Map())).toBe('country');
		});
	});
});
