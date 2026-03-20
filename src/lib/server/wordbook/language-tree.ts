import { db } from '$lib/server/db/index.js'
import { languages } from '$lib/server/db/schema.js'
import { eq, sql, isNull, asc } from 'drizzle-orm'

export interface TreeNode {
	id: number
	name: string
	slug: string
	nativeName: string | null
	languageType: string
	color: string | null
	children: TreeNode[]
}

/** Get the root ancestor of a language by walking up parent chain */
export async function getRootAncestor(languageId: number): Promise<{ id: number, name: string, slug: string }> {
	const result = await db.execute(sql`
		WITH RECURSIVE ancestors AS (
			SELECT id, name, slug, parent_language_id, 0 AS depth
			FROM languages WHERE id = ${languageId}
			UNION ALL
			SELECT l.id, l.name, l.slug, l.parent_language_id, a.depth + 1
			FROM ancestors a
			JOIN languages l ON l.id = a.parent_language_id
			WHERE a.depth < 20
		)
		SELECT id, name, slug FROM ancestors
		WHERE parent_language_id IS NULL
		LIMIT 1
	`)

	const rows = result as any[]
	if (rows.length === 0) {
		// This language itself is the root
		const [lang] = await db.select({ id: languages.id, name: languages.name, slug: languages.slug }).from(languages).where(eq(languages.id, languageId))
		return lang || { id: languageId, name: 'Unknown', slug: 'unknown' }
	}
	return { id: rows[0].id, name: rows[0].name, slug: rows[0].slug }
}

/** Get the ancestry chain from root down to this language */
export async function getAncestryChain(languageId: number): Promise<Array<{ id: number, name: string, slug: string, languageType: string }>> {
	const result = await db.execute(sql`
		WITH RECURSIVE ancestors AS (
			SELECT id, name, slug, language_type, parent_language_id, 0 AS depth
			FROM languages WHERE id = ${languageId}
			UNION ALL
			SELECT l.id, l.name, l.slug, l.language_type, l.parent_language_id, a.depth + 1
			FROM ancestors a
			JOIN languages l ON l.id = a.parent_language_id
			WHERE a.depth < 20
		)
		SELECT id, name, slug, language_type FROM ancestors
		ORDER BY depth DESC
	`)

	return (result as any[]).map(r => ({
		id: r.id as number,
		name: r.name as string,
		slug: r.slug as string,
		languageType: r.language_type as string,
	}))
}

/** Get direct child languages */
export async function getChildren(languageId: number): Promise<Array<{ id: number, name: string, slug: string, nativeName: string | null, languageType: string, color: string | null }>> {
	return db
		.select({
			id: languages.id,
			name: languages.name,
			slug: languages.slug,
			nativeName: languages.nativeName,
			languageType: languages.languageType,
			color: languages.color,
		})
		.from(languages)
		.where(eq(languages.parentLanguageId, languageId))
		.orderBy(asc(languages.name))
}

/** Get the full subtree for visualization */
export async function getSubtree(rootId: number): Promise<TreeNode> {
	const result = await db.execute(sql`
		WITH RECURSIVE tree AS (
			SELECT id, name, slug, native_name, language_type, color, parent_language_id, 0 AS depth
			FROM languages WHERE id = ${rootId}
			UNION ALL
			SELECT l.id, l.name, l.slug, l.native_name, l.language_type, l.color, l.parent_language_id, t.depth + 1
			FROM tree t
			JOIN languages l ON l.parent_language_id = t.id
			WHERE t.depth < 20
		)
		SELECT id, name, slug, native_name, language_type, color, parent_language_id
		FROM tree ORDER BY depth, name
	`)

	const rows = result as any[]
	const nodeMap = new Map<number, TreeNode>()

	// Build all nodes
	for (const r of rows) {
		nodeMap.set(r.id, {
			id: r.id,
			name: r.name,
			slug: r.slug,
			nativeName: r.native_name,
			languageType: r.language_type,
			color: r.color,
			children: [],
		})
	}

	// Link children to parents
	let root: TreeNode | null = null
	for (const r of rows) {
		const node = nodeMap.get(r.id)!
		if (r.id === rootId) {
			root = node
		} else if (r.parent_language_id && nodeMap.has(r.parent_language_id)) {
			nodeMap.get(r.parent_language_id)!.children.push(node)
		}
	}

	return root || nodeMap.get(rootId) || { id: rootId, name: 'Unknown', slug: 'unknown', nativeName: null, languageType: 'language', color: null, children: [] }
}

/** Check if targetId is a descendant of languageId (for circular ref prevention) */
export async function isDescendant(languageId: number, targetId: number): Promise<boolean> {
	if (languageId === targetId) return true

	const result = await db.execute(sql`
		WITH RECURSIVE descendants AS (
			SELECT id FROM languages WHERE parent_language_id = ${languageId}
			UNION ALL
			SELECT l.id FROM descendants d JOIN languages l ON l.parent_language_id = d.id
		)
		SELECT 1 FROM descendants WHERE id = ${targetId} LIMIT 1
	`)

	return (result as any[]).length > 0
}
