import type { WikiNode, TemplateArg, ImageOption, GalleryItem } from './types.js';

/**
 * Parse inline wikitext markup into WikiNode[].
 * Handles: bold, italic, strikethrough, links, templates, images,
 * refs, nowiki, HTML tags (sub, sup, br, gallery, syntaxhighlight), etc.
 */
export function parseInline(input: string): WikiNode[] {
	const nodes: WikiNode[] = [];
	let textBuf = '';
	let i = 0;

	function flushText() {
		if (textBuf) {
			nodes.push({ type: 'text', text: textBuf });
			textBuf = '';
		}
	}

	function remaining(): string {
		return input.slice(i);
	}

	function startsWith(s: string): boolean {
		return input.startsWith(s, i);
	}

	function startsWithCI(s: string): boolean {
		return input.slice(i, i + s.length).toLowerCase() === s.toLowerCase();
	}

	while (i < input.length) {
		// 1. <nowiki>...</nowiki> — escape everything inside
		if (startsWithCI('<nowiki>')) {
			flushText();
			i += 8; // '<nowiki>'.length
			const end = input.toLowerCase().indexOf('</nowiki>', i);
			if (end >= 0) {
				nodes.push({ type: 'nowiki', text: input.slice(i, end) });
				i = end + 9; // '</nowiki>'.length
			} else {
				nodes.push({ type: 'nowiki', text: input.slice(i) });
				i = input.length;
			}
			continue;
		}

		// 2. HTML comments <!-- ... --> — strip silently without flushing text
		if (startsWith('<!--')) {
			const end = input.indexOf('-->', i + 4);
			if (end >= 0) {
				i = end + 3;
			} else {
				i = input.length;
			}
			continue;
		}

		// 3. <references/> or <references /> — self-closing reference list
		if (startsWithCI('<references')) {
			const refMatch = input.slice(i).match(/^<references\s*\/?\s*>/i);
			if (refMatch) {
				flushText();
				nodes.push({ type: 'reference_list' });
				i += refMatch[0].length;
				continue;
			}
		}

		// 4. <ref>...</ref> — footnote
		if (startsWithCI('<ref')) {
			const refOpenMatch = input.slice(i).match(/^<ref(\s[^>]*)?\s*>/i);
			if (refOpenMatch) {
				flushText();
				i += refOpenMatch[0].length;
				const end = input.toLowerCase().indexOf('</ref>', i);
				if (end >= 0) {
					const content = input.slice(i, end);
					nodes.push({ type: 'reference', content: parseInline(content) });
					i = end + 6;
				} else {
					const content = input.slice(i);
					nodes.push({ type: 'reference', content: parseInline(content) });
					i = input.length;
				}
				continue;
			}
			// self-closing <ref name="..." />
			const refSelfClose = input.slice(i).match(/^<ref\s[^>]*\/\s*>/i);
			if (refSelfClose) {
				i += refSelfClose[0].length;
				continue;
			}
		}

		// 5. <syntaxhighlight> or <source> — code block
		if (startsWithCI('<syntaxhighlight') || startsWithCI('<source')) {
			const tag = startsWithCI('<syntaxhighlight') ? 'syntaxhighlight' : 'source';
			const openMatch = input.slice(i).match(new RegExp(`^<${tag}(\\s[^>]*)?>`, 'i'));
			if (openMatch) {
				flushText();
				const langMatch = openMatch[1]?.match(/lang\s*=\s*"([^"]+)"/i);
				const lang = langMatch ? langMatch[1] : null;
				i += openMatch[0].length;
				const closeTag = `</${tag}>`;
				const end = input.toLowerCase().indexOf(closeTag.toLowerCase(), i);
				if (end >= 0) {
					nodes.push({ type: 'code_block', lang, code: input.slice(i, end) });
					i = end + closeTag.length;
				} else {
					nodes.push({ type: 'code_block', lang, code: input.slice(i) });
					i = input.length;
				}
				continue;
			}
		}

		// 6. <br>, <br/>, <br />
		if (startsWithCI('<br')) {
			const brMatch = input.slice(i).match(/^<br\s*\/?\s*>/i);
			if (brMatch) {
				flushText();
				nodes.push({ type: 'line_break' });
				i += brMatch[0].length;
				continue;
			}
		}

		// 7. <sub>...</sub>
		if (startsWithCI('<sub>')) {
			flushText();
			i += 5;
			const end = input.toLowerCase().indexOf('</sub>', i);
			if (end >= 0) {
				nodes.push({ type: 'subscript', children: parseInline(input.slice(i, end)) });
				i = end + 6;
			} else {
				nodes.push({ type: 'subscript', children: parseInline(input.slice(i)) });
				i = input.length;
			}
			continue;
		}

		// 8. <sup>...</sup>
		if (startsWithCI('<sup>')) {
			flushText();
			i += 5;
			const end = input.toLowerCase().indexOf('</sup>', i);
			if (end >= 0) {
				nodes.push({ type: 'superscript', children: parseInline(input.slice(i, end)) });
				i = end + 6;
			} else {
				nodes.push({ type: 'superscript', children: parseInline(input.slice(i)) });
				i = input.length;
			}
			continue;
		}

		// 9. <s> or <del> — strikethrough via HTML
		if (startsWithCI('<s>') || startsWithCI('<del>')) {
			const isS = startsWithCI('<s>');
			const openLen = isS ? 3 : 5;
			const closeTag = isS ? '</s>' : '</del>';
			flushText();
			i += openLen;
			const end = input.toLowerCase().indexOf(closeTag.toLowerCase(), i);
			if (end >= 0) {
				nodes.push({ type: 'strikethrough', children: parseInline(input.slice(i, end)) });
				i = end + closeTag.length;
			} else {
				nodes.push({ type: 'strikethrough', children: parseInline(input.slice(i)) });
				i = input.length;
			}
			continue;
		}

		// 10. <gallery>...</gallery>
		if (startsWithCI('<gallery')) {
			const galleryOpen = input.slice(i).match(/^<gallery(\s[^>]*)?>/i);
			if (galleryOpen) {
				flushText();
				i += galleryOpen[0].length;
				const end = input.toLowerCase().indexOf('</gallery>', i);
				const content = end >= 0 ? input.slice(i, end) : input.slice(i);
				const items: GalleryItem[] = content
					.split('\n')
					.filter((l) => l.trim())
					.map((line) => {
						const pipeIdx = line.indexOf('|');
						if (pipeIdx >= 0) {
							return {
								filename: line.slice(0, pipeIdx).trim(),
								caption: line.slice(pipeIdx + 1).trim()
							};
						}
						return { filename: line.trim(), caption: '' };
					});
				nodes.push({ type: 'gallery', items });
				i = end >= 0 ? end + 10 : input.length;
				continue;
			}
		}

		// 11. {{...}} — templates (with brace-depth tracking for nesting)
		if (startsWith('{{')) {
			flushText();
			const templateResult = parseTemplate(input, i);
			if (templateResult) {
				nodes.push(templateResult.node);
				i = templateResult.end;
				continue;
			}
			// Failed to parse — emit as text
			textBuf += '{';
			i++;
			continue;
		}

		// 12. [[...]] — internal links (includes File: and Category:)
		if (startsWith('[[')) {
			flushText();
			const linkResult = parseInternalLink(input, i);
			if (linkResult) {
				nodes.push(linkResult.node);
				i = linkResult.end;
				continue;
			}
			textBuf += '[';
			i++;
			continue;
		}

		// 13. [http...] — external links
		if (startsWith('[') && !startsWith('[[')) {
			const extMatch = input.slice(i).match(/^\[((https?:\/\/|\/\/)[^\s\]]+)(\s([^\]]*))?\]/);
			if (extMatch) {
				flushText();
				nodes.push({
					type: 'external_link',
					url: extMatch[1],
					display: extMatch[4] || null
				});
				i += extMatch[0].length;
				continue;
			}
		}

		// 14. ~~text~~ — strikethrough
		if (startsWith('~~') && !startsWith('~~~')) {
			const end = input.indexOf('~~', i + 2);
			if (end > i + 2) {
				flushText();
				nodes.push({
					type: 'strikethrough',
					children: parseInline(input.slice(i + 2, end))
				});
				i = end + 2;
				continue;
			}
		}

		// 15. ''''' — bold+italic
		if (startsWith("'''''")) {
			const end = input.indexOf("'''''", i + 5);
			if (end > i + 5) {
				flushText();
				nodes.push({
					type: 'bold',
					children: [
						{
							type: 'italic',
							children: parseInline(input.slice(i + 5, end))
						}
					]
				});
				i = end + 5;
				continue;
			}
		}

		// 16. ''' — bold
		if (startsWith("'''") && !startsWith("''''")) {
			const end = input.indexOf("'''", i + 3);
			if (end > i + 3) {
				flushText();
				nodes.push({
					type: 'bold',
					children: parseInline(input.slice(i + 3, end))
				});
				i = end + 3;
				continue;
			}
		}

		// 17. '' — italic
		if (startsWith("''") && !startsWith("'''")) {
			const end = input.indexOf("''", i + 2);
			if (end > i + 2) {
				flushText();
				nodes.push({
					type: 'italic',
					children: parseInline(input.slice(i + 2, end))
				});
				i = end + 2;
				continue;
			}
		}

		// Default: accumulate text
		textBuf += input[i];
		i++;
	}

	flushText();
	return nodes;
}

// ============================================================================
// Template parsing: {{name|arg1|key=value|...}}
// ============================================================================

interface ParseResult<T> {
	node: T;
	end: number;
}

function parseTemplate(input: string, start: number): ParseResult<WikiNode> | null {
	if (!input.startsWith('{{', start)) return null;

	let i = start + 2;
	let depth = 1;

	// Find matching }}
	while (i < input.length && depth > 0) {
		if (input[i] === '{' && i + 1 < input.length && input[i + 1] === '{') {
			depth++;
			i += 2;
		} else if (input[i] === '}' && i + 1 < input.length && input[i + 1] === '}') {
			depth--;
			if (depth === 0) break;
			i += 2;
		} else {
			i++;
		}
	}

	if (depth !== 0) return null;

	const inner = input.slice(start + 2, i);
	i += 2; // skip closing }}

	// Split on | but respect nested {{ }} and [[ ]]
	const parts = splitTemplateParts(inner);
	const name = parts[0]?.trim() || '';
	const args: TemplateArg[] = [];

	for (let p = 1; p < parts.length; p++) {
		const part = parts[p];
		const eqIdx = part.indexOf('=');
		if (eqIdx >= 0) {
			const key = part.slice(0, eqIdx).trim();
			const val = part.slice(eqIdx + 1).trim();
			args.push({ name: key, value: val });
		} else {
			args.push({ name: null, value: part.trim() });
		}
	}

	return { node: { type: 'template', name, args }, end: i };
}

/**
 * Split template inner content on `|`, respecting nested {{ }}, [[ ]], and {{{ }}}.
 */
function splitTemplateParts(inner: string): string[] {
	const parts: string[] = [];
	let current = '';
	let braceDepth = 0;
	let bracketDepth = 0;

	for (let i = 0; i < inner.length; i++) {
		const ch = inner[i];
		const next = inner[i + 1];

		if (ch === '{' && next === '{') {
			braceDepth++;
			current += '{{';
			i++;
		} else if (ch === '}' && next === '}') {
			braceDepth--;
			if (braceDepth < 0) braceDepth = 0;
			current += '}}';
			i++;
		} else if (ch === '[' && next === '[') {
			bracketDepth++;
			current += '[[';
			i++;
		} else if (ch === ']' && next === ']') {
			bracketDepth--;
			if (bracketDepth < 0) bracketDepth = 0;
			current += ']]';
			i++;
		} else if (ch === '|' && braceDepth === 0 && bracketDepth === 0) {
			parts.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	parts.push(current);
	return parts;
}

// ============================================================================
// Internal link parsing: [[target|display]] or [[File:...|options]] or [[Category:...]]
// ============================================================================

function parseInternalLink(input: string, start: number): ParseResult<WikiNode> | null {
	if (!input.startsWith('[[', start)) return null;

	let i = start + 2;
	let depth = 1;

	while (i < input.length && depth > 0) {
		if (input[i] === '[' && i + 1 < input.length && input[i + 1] === '[') {
			depth++;
			i += 2;
		} else if (input[i] === ']' && i + 1 < input.length && input[i + 1] === ']') {
			depth--;
			if (depth === 0) break;
			i += 2;
		} else {
			i++;
		}
	}

	if (depth !== 0) return null;

	const inner = input.slice(start + 2, i);
	i += 2; // skip ]]

	// Split on | respecting nested [[ ]]
	const parts = splitLinkParts(inner);
	const target = parts[0]?.trim() || '';

	// Category: prefix
	if (/^category:/i.test(target)) {
		const catName = target.replace(/^category:\s*/i, '');
		return { node: { type: 'category', name: catName }, end: i };
	}

	// File: or Image: prefix
	if (/^(file|image):/i.test(target)) {
		const filename = target.replace(/^(file|image):\s*/i, '');
		const options: ImageOption[] = [];

		for (let p = 1; p < parts.length; p++) {
			const opt = parts[p].trim();
			const optLower = opt.toLowerCase();

			if (optLower === 'thumb' || optLower === 'thumbnail') {
				options.push({ type: 'thumb' });
			} else if (optLower === 'frame') {
				options.push({ type: 'frame' });
			} else if (optLower === 'frameless') {
				options.push({ type: 'frameless' });
			} else if (optLower === 'right') {
				options.push({ type: 'right' });
			} else if (optLower === 'left') {
				options.push({ type: 'left' });
			} else if (optLower === 'center' || optLower === 'centre') {
				options.push({ type: 'center' });
			} else if (/^\d+px$/i.test(opt)) {
				options.push({ type: 'width', value: parseInt(opt) });
			} else if (optLower.startsWith('alt=')) {
				options.push({ type: 'alt', text: opt.slice(4) });
			} else {
				// Last unrecognized option is caption
				options.push({ type: 'caption', text: opt });
			}
		}

		return { node: { type: 'image', filename, options }, end: i };
	}

	// Regular internal link
	if (parts.length > 1) {
		const display = parseInline(parts.slice(1).join('|'));
		return { node: { type: 'internal_link', target, display }, end: i };
	}

	return { node: { type: 'internal_link', target, display: null }, end: i };
}

function splitLinkParts(inner: string): string[] {
	const parts: string[] = [];
	let current = '';
	let bracketDepth = 0;
	let braceDepth = 0;

	for (let i = 0; i < inner.length; i++) {
		const ch = inner[i];
		const next = inner[i + 1];

		if (ch === '[' && next === '[') {
			bracketDepth++;
			current += '[[';
			i++;
		} else if (ch === ']' && next === ']') {
			bracketDepth--;
			if (bracketDepth < 0) bracketDepth = 0;
			current += ']]';
			i++;
		} else if (ch === '{' && next === '{') {
			braceDepth++;
			current += '{{';
			i++;
		} else if (ch === '}' && next === '}') {
			braceDepth--;
			if (braceDepth < 0) braceDepth = 0;
			current += '}}';
			i++;
		} else if (ch === '|' && bracketDepth === 0 && braceDepth === 0) {
			parts.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	parts.push(current);
	return parts;
}
