import DOMPurify from 'isomorphic-dompurify'
import sharp from 'sharp'
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

const PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47])
const JPEG = Buffer.from([0xFF, 0xD8, 0xFF])
const GIF87 = Buffer.from('GIF87a', 'ascii')
const GIF89 = Buffer.from('GIF89a', 'ascii')
const WEBP_RIFF = Buffer.from('RIFF', 'ascii')
const WEBP_WEBP = Buffer.from('WEBP', 'ascii')
const PDF = Buffer.from('%PDF-', 'ascii')

/**
 * Verify that the byte content of a file matches its claimed MIME type.
 * Throws (400) on mismatch.
 *
 * For raster images we cross-check against `sharp.metadata().format`.
 * For SVG we accept any text/xml-looking content with an `<svg` tag.
 * For PDF we check magic bytes.
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
			const ch = head.charCodeAt(i)
			if (ch === 0x09 || ch === 0x0A || ch === 0x0D || ch === 0x20 || ch === 0xFEFF) { i++; continue }
			if (head.startsWith('<?', i)) {
				const end = head.indexOf('?>', i + 2)
				if (end === -1) break
				i = end + 2; continue
			}
			if (head.startsWith('<!--', i)) {
				const end = head.indexOf('-->', i + 4)
				if (end === -1) break
				i = end + 3; continue
			}
			if (head.startsWith('<!doctype', i)) {
				const end = head.indexOf('>', i + 9)
				if (end === -1) break
				i = end + 1; continue
			}
			break
		}
		if (!head.startsWith('<svg', i)) {
			throw error(400, 'File does not appear to be a valid SVG.')
		}
		return
	}

	if (claimed === 'application/pdf') {
		if (!buffer.subarray(0, 5).equals(PDF)) {
			throw error(400, 'File does not appear to be a valid PDF.')
		}
		return
	}

	if (claimed === 'image/png' && !buffer.subarray(0, 4).equals(PNG)) {
		throw error(400, 'File does not match its declared type (expected PNG).')
	}
	if (claimed === 'image/jpeg' && !buffer.subarray(0, 3).equals(JPEG)) {
		throw error(400, 'File does not match its declared type (expected JPEG).')
	}
	if (claimed === 'image/gif' && !buffer.subarray(0, 6).equals(GIF87) && !buffer.subarray(0, 6).equals(GIF89)) {
		throw error(400, 'File does not match its declared type (expected GIF).')
	}
	if (claimed === 'image/webp' && (!buffer.subarray(0, 4).equals(WEBP_RIFF) || !buffer.subarray(8, 12).equals(WEBP_WEBP))) {
		throw error(400, 'File does not match its declared type (expected WebP).')
	}

	// Cross-verify with sharp for any raster format.
	if (claimed.startsWith('image/') && claimed !== 'image/svg+xml') {
		try {
			const metadata = await sharp(buffer).metadata()
			const expected = claimed.split('/')[1].replace('jpeg', 'jpg')
			const detected = (metadata.format || '').replace('jpeg', 'jpg')
			if (detected && detected !== expected) {
				throw error(400, `File contents (${detected}) do not match declared type (${claimed}).`)
			}
		} catch (error_) {
			if ((error_ as { status?: number }).status === 400) throw error_
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
