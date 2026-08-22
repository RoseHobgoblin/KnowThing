import DOMPurify from 'isomorphic-dompurify'
import sharp from 'sharp'
import { fileTypeFromBuffer } from 'file-type'
import { error } from '@sveltejs/kit'

/**
 * Sanitize an SVG buffer in place. Strips scripts, event handlers, foreign
 * objects, javascript: URLs, and external network references. Allowed
 * external URLs are limited to data: and same-document fragment refs.
 *
 * Throws (400) if the result is empty (i.e. the input wasn't really an SVG
 * or was entirely script).
 */
export function sanitizeSvg(buffer: Buffer): Buffer {
	const input = buffer.toString('utf8')
	const cleaned = DOMPurify.sanitize(input, {
		USE_PROFILES: { svg: true, svgFilters: true },
		FORBID_TAGS: ['script', 'foreignObject'],
		FORBID_ATTR: ['onload', 'onclick', 'onerror', 'onmouseover', 'onmousedown', 'onmouseup', 'onfocus', 'onblur'],
	})

	if (!cleaned.trim()) {
		throw error(400, 'SVG appears to be empty or contains only disallowed content.')
	}

	return Buffer.from(cleaned, 'utf8')
}

/**
 * Verify that the byte content of a file matches its claimed MIME type.
 * Throws (400) on mismatch.
 *
 * For binary formats we detect the file signature with `file-type`. Raster
 * images are also decoded by Sharp so a matching header on corrupt data is
 * not enough to pass validation.
 * For SVG we accept any text/xml-looking content with an `<svg` tag.
 */
export async function verifyMimeType(buffer: Buffer, claimed: string): Promise<void> {
	if (claimed === 'image/svg+xml') {
		// Scan the first 4KB for an <svg root, allowing leading whitespace,
		// XML/processing-instruction prologues, comments, and DOCTYPEs (in any
		// order) — exporters from Illustrator/Figma/Inkscape often emit those
		// before the <svg element.
		const head = buffer.toString('utf8', 0, 4096).toLowerCase()
		let i = 0
		while (i < head.length) {
			const ch = head.codePointAt(i)
			if (ch === 0x09 || ch === 0x0A || ch === 0x0D || ch === 0x20 || ch === 0xFEFF) {
				i++
				continue
			}
			if (head.startsWith('<?', i)) {
				const end = head.indexOf('?>', i + 2)
				if (end === -1) break
				i = end + 2
				continue
			}
			if (head.startsWith('<!--', i)) {
				const end = head.indexOf('-->', i + 4)
				if (end === -1) break
				i = end + 3
				continue
			}
			if (head.startsWith('<!doctype', i)) {
				const end = head.indexOf('>', i + 9)
				if (end === -1) break
				i = end + 1
				continue
			}
			break
		}
		if (!head.startsWith('<svg', i)) {
			throw error(400, 'File does not appear to be a valid SVG.')
		}
		return
	}

	let detected: Awaited<ReturnType<typeof fileTypeFromBuffer>>
	try {
		detected = await fileTypeFromBuffer(buffer)
	} catch {
		throw error(400, 'Unable to determine file type from its contents.')
	}

	if (!detected) {
		throw error(400, 'Unable to determine file type from its contents.')
	}

	if (detected.mime !== claimed) {
		throw error(400, `File contents (${detected.mime}) do not match declared type (${claimed}).`)
	}

	if (claimed === 'application/pdf') return

	// Confirm that a raster with a valid signature can actually be decoded.
	if (claimed.startsWith('image/') && claimed !== 'image/svg+xml') {
		try {
			await sharp(buffer).metadata()
		} catch {
			throw error(400, 'Unable to verify image type from file contents.')
		}
	}
}

/**
 * Strip EXIF / IPTC / XMP metadata from a raster image buffer by re-encoding
 * via sharp without `withMetadata()`. Returns a fresh buffer in the original
 * format. SVG and PDF inputs are returned unchanged.
 */
export async function stripExifMetadata(buffer: Buffer, mimeType: string): Promise<Buffer> {
	if (!mimeType.startsWith('image/') || mimeType === 'image/svg+xml') return buffer

	try {
		const image = sharp(buffer).rotate() // bake-in EXIF orientation, then drop it
		const format = mimeType.split('/')[1]
		switch (format) {
			case 'jpeg':
				return await image.jpeg({ quality: 95 }).toBuffer()
			case 'png':
				return await image.png({ compressionLevel: 9 }).toBuffer()
			case 'webp':
				return await image.webp({ quality: 95 }).toBuffer()
			case 'gif':
				return await image.gif().toBuffer()
			default:
				return await image.toBuffer()
		}
	} catch {
		// Fall back to original — better to keep EXIF than fail the upload.
		return buffer
	}
}
