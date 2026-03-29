import type { WikiNode, TemplateArg as TemplateArgument, ImageOption, GalleryItem } from './types.js'

/**
 * Parse inline wikitext markup into WikiNode[].
 * Handles: bold, italic, strikethrough, links, templates, images,
 * refs, nowiki, HTML tags (sub, sup, br, gallery, syntaxhighlight), etc.
 */
export function parseInline(input: string): WikiNode[] {
	const nodes: WikiNode[] = []
	let textBuf = ''
	let index = 0

	function flushText() {
		if (textBuf) {
			nodes.push({ type: 'text', text: textBuf })
			textBuf = ''
		}
	}

	function remaining(): string {
		return input.slice(index)
	}

	function startsWith(s: string): boolean {
		return input.startsWith(s, index)
	}

	function startsWithCI(s: string): boolean {
		return input.slice(index, index + s.length).toLowerCase() === s.toLowerCase()
	}

	while (index < input.length) {
		// 1. <nowiki>...</nowiki> — escape everything inside
		if (startsWithCI('<nowiki>')) {
			flushText()
			index += 8 // '<nowiki>'.length
			const end = input.toLowerCase().indexOf('</nowiki>', index)
			if (end === -1) {
				nodes.push({ type: 'nowiki', text: input.slice(index) })
				index = input.length
			} else {
				nodes.push({ type: 'nowiki', text: input.slice(index, end) })
				index = end + 9 // '</nowiki>'.length
			}
			continue
		}

		// 2. HTML comments <!-- ... --> — strip silently without flushing text
		if (startsWith('<!--')) {
			const end = input.indexOf('-->', index + 4)
			if (end === -1) {
				index = input.length
			} else {
				index = end + 3
			}
			continue
		}

		// 3. <references/> or <references /> — self-closing reference list
		if (startsWithCI('<references')) {
			const referenceMatch = input.slice(index).match(/^<references\s*\/?\s*>/i)
			if (referenceMatch) {
				flushText()
				nodes.push({ type: 'reference_list' })
				index += referenceMatch[0].length
				continue
			}
		}

		// 4. <ref>...</ref> — footnote
		if (startsWithCI('<ref')) {
			const referenceOpenMatch = input.slice(index).match(/^<ref(\s[^>]*)?\s*>/i)
			if (referenceOpenMatch) {
				flushText()
				index += referenceOpenMatch[0].length
				const end = input.toLowerCase().indexOf('</ref>', index)
				if (end === -1) {
					const content = input.slice(index)
					nodes.push({ type: 'reference', content: parseInline(content) })
					index = input.length
				} else {
					const content = input.slice(index, end)
					nodes.push({ type: 'reference', content: parseInline(content) })
					index = end + 6
				}
				continue
			}
			// self-closing <ref name="..." />
			const referenceSelfClose = input.slice(index).match(/^<ref\s[^>]*\/\s*>/i)
			if (referenceSelfClose) {
				index += referenceSelfClose[0].length
				continue
			}
		}

		// 5. <syntaxhighlight> or <source> — code block
		if (startsWithCI('<syntaxhighlight') || startsWithCI('<source')) {
			const tag = startsWithCI('<syntaxhighlight') ? 'syntaxhighlight' : 'source'
			const openMatch = input.slice(index).match(new RegExp(String.raw`^<${tag}(\s[^>]*)?>`, 'i'))
			if (openMatch) {
				flushText()
				const langMatch = openMatch[1]?.match(/lang\s*=\s*"([^"]+)"/i)
				const lang = langMatch ? langMatch[1] : null
				index += openMatch[0].length
				const closeTag = `</${tag}>`
				const end = input.toLowerCase().indexOf(closeTag.toLowerCase(), index)
				if (end === -1) {
					nodes.push({ type: 'code_block', lang, code: input.slice(index) })
					index = input.length
				} else {
					nodes.push({ type: 'code_block', lang, code: input.slice(index, end) })
					index = end + closeTag.length
				}
				continue
			}
		}

		// 6. <br>, <br/>, <br />
		if (startsWithCI('<br')) {
			const brMatch = input.slice(index).match(/^<br\s*\/?\s*>/i)
			if (brMatch) {
				flushText()
				nodes.push({ type: 'line_break' })
				index += brMatch[0].length
				continue
			}
		}

		// 7. <sub>...</sub>
		if (startsWithCI('<sub>')) {
			flushText()
			index += 5
			const end = input.toLowerCase().indexOf('</sub>', index)
			if (end === -1) {
				nodes.push({ type: 'subscript', children: parseInline(input.slice(index)) })
				index = input.length
			} else {
				nodes.push({ type: 'subscript', children: parseInline(input.slice(index, end)) })
				index = end + 6
			}
			continue
		}

		// 8. <sup>...</sup>
		if (startsWithCI('<sup>')) {
			flushText()
			index += 5
			const end = input.toLowerCase().indexOf('</sup>', index)
			if (end === -1) {
				nodes.push({ type: 'superscript', children: parseInline(input.slice(index)) })
				index = input.length
			} else {
				nodes.push({ type: 'superscript', children: parseInline(input.slice(index, end)) })
				index = end + 6
			}
			continue
		}

		// 9. <s> or <del> — strikethrough via HTML
		if (startsWithCI('<s>') || startsWithCI('<del>')) {
			const isS = startsWithCI('<s>')
			const openLength = isS ? 3 : 5
			const closeTag = isS ? '</s>' : '</del>'
			flushText()
			index += openLength
			const end = input.toLowerCase().indexOf(closeTag.toLowerCase(), index)
			if (end === -1) {
				nodes.push({ type: 'strikethrough', children: parseInline(input.slice(index)) })
				index = input.length
			} else {
				nodes.push({ type: 'strikethrough', children: parseInline(input.slice(index, end)) })
				index = end + closeTag.length
			}
			continue
		}

		// 10. <gallery>...</gallery>
		if (startsWithCI('<gallery')) {
			const galleryOpen = input.slice(index).match(/^<gallery(\s[^>]*)?>/i)
			if (galleryOpen) {
				flushText()
				index += galleryOpen[0].length
				const end = input.toLowerCase().indexOf('</gallery>', index)
				const content = end === -1 ? input.slice(index) : input.slice(index, end)
				const items: GalleryItem[] = content
					.split('\n')
					.filter(l => l.trim())
					.map((line) => {
						const pipeIndex = line.indexOf('|')
						if (pipeIndex !== -1) {
							return {
								filename: line.slice(0, pipeIndex).trim(),
								caption: line.slice(pipeIndex + 1).trim(),
							}
						}
						return { filename: line.trim(), caption: '' }
					})
				nodes.push({ type: 'gallery', items })
				index = end === -1 ? input.length : end + 10
				continue
			}
		}

		// 11. {{...}} — templates (with brace-depth tracking for nesting)
		if (startsWith('{{')) {
			flushText()
			const templateResult = parseTemplate(input, index)
			if (templateResult) {
				nodes.push(templateResult.node)
				index = templateResult.end
				continue
			}
			// Failed to parse — emit as text
			textBuf += '{'
			index++
			continue
		}

		// 12. [[...]] — internal links (includes File: and Category:)
		if (startsWith('[[')) {
			flushText()
			const linkResult = parseInternalLink(input, index)
			if (linkResult) {
				nodes.push(linkResult.node)
				index = linkResult.end
				continue
			}
			textBuf += '['
			index++
			continue
		}

		// 13. [http...] — external links
		if (startsWith('[') && !startsWith('[[')) {
			const extensionMatch = input.slice(index).match(/^\[((https?:\/\/|\/\/)[^\s\]]+)(\s([^\]]*))?]/)
			if (extensionMatch) {
				flushText()
				nodes.push({
					type: 'external_link',
					url: extensionMatch[1],
					display: extensionMatch[4] || null,
				})
				index += extensionMatch[0].length
				continue
			}
		}

		// 14. ~~text~~ — strikethrough
		if (startsWith('~~') && !startsWith('~~~')) {
			const end = input.indexOf('~~', index + 2)
			if (end > index + 2) {
				flushText()
				nodes.push({
					type: 'strikethrough',
					children: parseInline(input.slice(index + 2, end)),
				})
				index = end + 2
				continue
			}
		}

		// 15. ''''' — bold+italic
		if (startsWith('\'\'\'\'\'')) {
			const end = input.indexOf('\'\'\'\'\'', index + 5)
			if (end > index + 5) {
				flushText()
				nodes.push({
					type: 'bold',
					children: [
						{
							type: 'italic',
							children: parseInline(input.slice(index + 5, end)),
						},
					],
				})
				index = end + 5
				continue
			}
		}

		// 16. ''' — bold
		if (startsWith('\'\'\'') && !startsWith('\'\'\'\'')) {
			const end = input.indexOf('\'\'\'', index + 3)
			if (end > index + 3) {
				flushText()
				nodes.push({
					type: 'bold',
					children: parseInline(input.slice(index + 3, end)),
				})
				index = end + 3
				continue
			}
		}

		// 17. '' — italic
		if (startsWith('\'\'') && !startsWith('\'\'\'')) {
			const end = input.indexOf('\'\'', index + 2)
			if (end > index + 2) {
				flushText()
				nodes.push({
					type: 'italic',
					children: parseInline(input.slice(index + 2, end)),
				})
				index = end + 2
				continue
			}
		}

		// Default: accumulate text
		textBuf += input[index]
		index++
	}

	flushText()
	return nodes
}

// ============================================================================
// Template parsing: {{name|arg1|key=value|...}}
// ============================================================================

interface ParseResult<T> {
	node: T
	end: number
}

function parseTemplate(input: string, start: number): ParseResult<WikiNode> | null {
	if (!input.startsWith('{{', start)) return null

	let index = start + 2
	let depth = 1

	// Find matching }}
	while (index < input.length && depth > 0) {
		if (input[index] === '{' && index + 1 < input.length && input[index + 1] === '{') {
			depth++
			index += 2
		} else if (input[index] === '}' && index + 1 < input.length && input[index + 1] === '}') {
			depth--
			if (depth === 0) break
			index += 2
		} else {
			index++
		}
	}

	if (depth !== 0) return null

	const inner = input.slice(start + 2, index)
	index += 2 // skip closing }}

	// Split on | but respect nested {{ }} and [[ ]]
	const parts = splitTemplateParts(inner)
	const name = parts[0]?.trim() || ''
	const args: TemplateArgument[] = []

	for (let p = 1; p < parts.length; p++) {
		const part = parts[p]
		const eqIndex = part.indexOf('=')
		if (eqIndex === -1) {
			args.push({ name: null, value: part.trim() })
		} else {
			const key = part.slice(0, eqIndex).trim()
			const value = part.slice(eqIndex + 1).trim()
			args.push({ name: key, value: value })
		}
	}

	return { node: { type: 'template', name, args }, end: index }
}

/**
 * Split template inner content on `|`, respecting nested {{ }}, [[ ]], and {{{ }}}.
 */
function splitTemplateParts(inner: string): string[] {
	const parts: string[] = []
	let current = ''
	let braceDepth = 0
	let bracketDepth = 0

	for (let index = 0; index < inner.length; index++) {
		const ch = inner[index]
		const next = inner[index + 1]

		if (ch === '{' && next === '{') {
			braceDepth++
			current += '{{'
			index++
		} else if (ch === '}' && next === '}') {
			braceDepth--
			if (braceDepth < 0) braceDepth = 0
			current += '}}'
			index++
		} else if (ch === '[' && next === '[') {
			bracketDepth++
			current += '[['
			index++
		} else if (ch === ']' && next === ']') {
			bracketDepth--
			if (bracketDepth < 0) bracketDepth = 0
			current += ']]'
			index++
		} else if (ch === '|' && braceDepth === 0 && bracketDepth === 0) {
			parts.push(current)
			current = ''
		} else {
			current += ch
		}
	}
	parts.push(current)
	return parts
}

// ============================================================================
// Internal link parsing: [[target|display]] or [[File:...|options]] or [[Category:...]]
// ============================================================================

function parseInternalLink(input: string, start: number): ParseResult<WikiNode> | null {
	if (!input.startsWith('[[', start)) return null

	let index = start + 2
	let depth = 1

	while (index < input.length && depth > 0) {
		if (input[index] === '[' && index + 1 < input.length && input[index + 1] === '[') {
			depth++
			index += 2
		} else if (input[index] === ']' && index + 1 < input.length && input[index + 1] === ']') {
			depth--
			if (depth === 0) break
			index += 2
		} else {
			index++
		}
	}

	if (depth !== 0) return null

	const inner = input.slice(start + 2, index)
	index += 2 // skip ]]

	// Split on | respecting nested [[ ]]
	const parts = splitLinkParts(inner)
	const target = parts[0]?.trim() || ''

	// Category: prefix
	if (/^category:/i.test(target)) {
		const catName = target.replace(/^category:\s*/i, '')
		return { node: { type: 'category', name: catName }, end: index }
	}

	// File: or Image: prefix
	if (/^(file|image):/i.test(target)) {
		const filename = target.replace(/^(file|image):\s*/i, '')
		const options: ImageOption[] = []

		for (let p = 1; p < parts.length; p++) {
			const opt = parts[p].trim()
			const optLower = opt.toLowerCase()

			if (optLower === 'thumb' || optLower === 'thumbnail') {
				options.push({ type: 'thumb' })
			} else if (optLower === 'frame') {
				options.push({ type: 'frame' })
			} else if (optLower === 'frameless') {
				options.push({ type: 'frameless' })
			} else if (optLower === 'right') {
				options.push({ type: 'right' })
			} else if (optLower === 'left') {
				options.push({ type: 'left' })
			} else if (optLower === 'center' || optLower === 'centre') {
				options.push({ type: 'center' })
			} else if (/^\d+px$/i.test(opt)) {
				options.push({ type: 'width', value: Number.parseInt(opt) })
			} else if (optLower.startsWith('alt=')) {
				options.push({ type: 'alt', text: opt.slice(4) })
			} else {
				// Last unrecognized option is caption
				options.push({ type: 'caption', text: opt })
			}
		}

		return { node: { type: 'image', filename, options }, end: index }
	}

	// Wordbook link: [[wb:language:word]] or [[wb:language:word|display]]
	if (/^wb:/i.test(target)) {
		const wbTarget = target.replace(/^wb:\s*/i, '')
		const colonIndex = wbTarget.indexOf(':')
		if (colonIndex > 0) {
			const language = wbTarget.slice(0, colonIndex).trim().toLowerCase()
			const word = wbTarget.slice(colonIndex + 1).trim()
			const display = parts.length > 1 ? parseInline(parts.slice(1).join('|')) : null
			return { node: { type: 'wordbook_link', language, word, display }, end: index }
		}
	}

	// Cross-domain link: [[domain:target]] or [[domain:target|display]]
	if (/^[a-z][\da-z]*:/i.test(target)) {
		const colonIndex = target.indexOf(':')
		const domain = target.slice(0, colonIndex).trim().toLowerCase()
		const domainTarget = target.slice(colonIndex + 1).trim()
		if (domainTarget) {
			const display = parts.length > 1 ? parseInline(parts.slice(1).join('|')) : null
			return { node: { type: 'domain_link' as const, domain, target: domainTarget, display }, end: index }
		}
	}

	// Regular internal link
	if (parts.length > 1) {
		const display = parseInline(parts.slice(1).join('|'))
		return { node: { type: 'internal_link', target, display }, end: index }
	}

	return { node: { type: 'internal_link', target, display: null }, end: index }
}

function splitLinkParts(inner: string): string[] {
	const parts: string[] = []
	let current = ''
	let bracketDepth = 0
	let braceDepth = 0

	for (let index = 0; index < inner.length; index++) {
		const ch = inner[index]
		const next = inner[index + 1]

		if (ch === '[' && next === '[') {
			bracketDepth++
			current += '[['
			index++
		} else if (ch === ']' && next === ']') {
			bracketDepth--
			if (bracketDepth < 0) bracketDepth = 0
			current += ']]'
			index++
		} else if (ch === '{' && next === '{') {
			braceDepth++
			current += '{{'
			index++
		} else if (ch === '}' && next === '}') {
			braceDepth--
			if (braceDepth < 0) braceDepth = 0
			current += '}}'
			index++
		} else if (ch === '|' && bracketDepth === 0 && braceDepth === 0) {
			parts.push(current)
			current = ''
		} else {
			current += ch
		}
	}
	parts.push(current)
	return parts
}
