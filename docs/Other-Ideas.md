This is the right question. The Wordbook worked because you didn't replicate Wiktionary's "templates pretending to be data" — you built a real relational model for linguistic data. The same principle applies everywhere: structured data where MediaWiki has unstructured markup.

Here are the ideas I think are genuinely novel and play to your stack's strengths.

1. Knowledge Graph — Typed Relationships Between Pages
MediaWiki pages are linked by dumb hyperlinks. [[Amalur]] means nothing except "there's a page called Amalur." Wikidata tries to fix this but it's a separate system bolted on.

You could make relationships first-class:


Amalur  --[capital-of]-->  Onchera
Oncheran  --[spoken-in]-->  Onchera
Teyaran III  --[ruled]-->  Onchera  {from: 1842, to: 1891}
A relations table with source_slug, target_slug, relation_type, and optional metadata (dates, qualifiers). Defined via wikitext syntax — maybe something like [[Onchera|capital-of]] or a dedicated {{rel|capital-of|Onchera}} template.

What this unlocks:

Infoboxes that auto-populate from relations instead of manual fields
"What links here" becomes "What relates to here, and how"
Reverse queries: "Who ruled Onchera?" is a DB query, not a manual list
Graph visualization of your world's structure
This is exactly what you did with Wordbook — take something that's convention-in-markup on Wikipedia and make it queryable data.

2. Structured Queries in Wikitext
MediaWiki has Semantic MediaWiki (an extension) and Cargo, both clunky. You own the parser. Add a query node:


{{#query: type=country | population > 1000000 | sort=population desc}}
This renders as an auto-generated table/list pulled from structured data (infobox fields, relations, categories). The page never goes stale because the results are computed at render time.

For worldbuilding this is huge: "List of battles in the Third Era", "All languages descended from Proto-Oncheran", "Cities by population" — these are currently pages someone maintains by hand. They should be live queries.

Your parser already handles magic words and conditionals. A query node is a natural extension.

3. Timeline as a First-Class Data Type
You already built a custom calendar system — you clearly care about time. Go further: make temporal data structured.

Events, reigns, wars, eras — these have start dates, end dates, and participants. Store them as structured records tied to pages. Render them as interactive timelines (your Svelte frontend is perfect for this).


{{event|Battle of Amalur|date=1842-06-15|era=Third Age|participants=Onchera,Teyaran Empire}}
A timeline component on any page that shows events related to that entity, pulled from structured data. The calendar system you already have provides the date math.

MediaWiki can't do this. At all. They have static timeline images and manually formatted lists.

4. Live Collaborative Editing
MediaWiki's edit model is from 2002: lock the page, edit, save, hope nobody else edited it. Edit conflicts are a constant pain on Wikipedia.

With your stack (SvelteKit + WebSockets or server-sent events), you could add real-time collaborative editing. A CRDT library like Yjs integrates with CodeMirror 6 — which you're already using. Two people editing the same page see each other's cursors and changes live.

This is genuinely modern and something no wiki platform does well.

5. Computed / Derived Sections
Sections of a page that render from structured data, not static markup. Example: on the Onchera page, a "Cities" section that auto-lists all pages categorized as cities with capital-of or located-in relations to Onchera.


{{#section:cities|relation=located-in|target=Onchera|type=settlement}}
The content is always current. Adding a new city page with the right relation automatically updates the parent page. No human maintenance.

This is the inverse of the query idea — instead of a dedicated query page, it's embedded structured content within narrative pages.

6. Branching Drafts
Git-like branching for wiki content. "What if the Teyaran Empire won the war?" Create a branch, edit freely, share it, optionally merge it back.

For worldbuilding this is uniquely powerful — exploring alternate histories, drafting major rewrites, or just letting a contributor propose sweeping changes without touching the live wiki.

Your revision system already stores snapshots. A branch column on pages (or a separate drafts table pointing to a base revision) would be lightweight to implement.

Which to Prioritize
Idea	Impact	Effort	Builds on existing
Knowledge graph	Highest	Medium	Relations table + parser node + renderer
Structured queries	High	Medium	Parser + query executor + table renderer
Timelines	High	Medium	Calendar system + new Svelte component
Live collaboration	Medium	High	Yjs + CodeMirror 6 (already using CM6)
Computed sections	Medium	Low	Builds directly on knowledge graph
Branching drafts	Medium	Medium	Revision system + branch concept
The knowledge graph is the foundation. Structured queries and computed sections are natural consequences of it. Timelines leverage your existing calendar work. I'd sequence it as: knowledge graph → queries → timelines, with computed sections falling out naturally from the first two.

The common thread: MediaWiki treats everything as a flat document. You can treat everything as structured, queryable, interconnected data that renders as documents. That's the architectural bet the Wordbook already validated.