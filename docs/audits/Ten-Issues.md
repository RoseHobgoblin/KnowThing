# Structural Gaps

Ten first-class problems a user would put into words.

---

## 1. You can't see how anything connects

The database tracks every internal link between pages — source, target, domain — but none of that data is surfaced to the reader. There is no "What links here" panel on any article. No backlinks section. No graph or map showing how pages relate to one another.

In a knowledge system, discovering connections is half the value. A user builds a web of 200 articles and the only way to find a relationship is to already know what to search for. The structured link data exists in `contentLinks` — it's just invisible to everyone who isn't running SQL.

Without this, the wiki feels like a filing cabinet instead of a web. Pages are islands. The user who wrote the link knows the connection; nobody else does unless they happen to land on the source page and read through it.

---

## 2. There's no way to say "this page needs work"

No discussion pages. No comments. No article status flags — no "stub", "needs review", "outdated", "disputed" markers. If you're collaborating with even one other person, the only channel for editorial judgment is outside the app entirely.

Questions like "should this section be split into its own article?", "this contradicts what the other page says", or "someone who knows more about this should check the dates" have no place to live. They end up in a chat thread, a sticky note, or nowhere. MediaWiki solved this with Talk pages decades ago. The absence isn't a missing feature — it's a missing communication layer for the people doing the work.

---

## 3. Every save is a publish

There are no drafts. No way to mark an article as in-progress or hide it from public view. The moment you save, the content is live and visible to every user on the site.

For short edits this is fine. For longer articles — the kind that take days to research and structure, or that involve complex worldbuilding entries with cross-references to nail down — it's a real friction point. The user's options are: publish something half-finished, or write in a separate tool and paste it in later. Both are bad. The first pollutes the wiki with incomplete content. The second defeats the purpose of having a live editor with preview and internal link resolution.

A draft system doesn't need to be complex. Even a boolean "published" flag with a filter on queries would change the workflow significantly.

---

## 4. You can't see your own work

There is no "My contributions" page. No way to filter Recent Changes to just your own edits. No way to see all the words you've added to the wordbook, all the articles you've created, or all the celestial bodies you've configured.

The data is there — every revision stores a `userId`. But there's no user-facing view that assembles it. If you've been building out a corner of the wiki for weeks, there's no single place that shows your footprint. You'd have to scroll through the global Recent Changes feed and pick your name out of the list, page by page.

For a solo user this is a minor annoyance. For a team, it makes individual accountability and personal progress invisible.

---

## 5. Categories are flat

Categories cannot contain subcategories. Every category exists at the same level in a single flat list. There is no hierarchy, no nesting, no parent-child relationship between categories.

For a small wiki this works. For a knowledge system with any real breadth — especially one about a fictional world with locations, cultures, languages, historical periods, species — flat categories collapse fast. You'd naturally want structures like `Locations > Cities > Northshore` or `Languages > Elvish > Dialects`. Instead, you get a wall of 80 category names sorted alphabetically with no grouping.

The `contentCategories` table is a simple many-to-many join. Adding a `parentCategoryId` column and rendering a tree instead of a list would turn categories from a tagging system into an actual taxonomy.

---

## 6. The wordbook and wiki don't talk to each other enough

They're two parallel systems. The wiki has articles with prose. The wordbook has structured lexicon entries with pronunciation, etymology, definitions, and inflection tables. But when you're reading an article that uses a term defined in the wordbook, nothing happens. The word sits there as plain text.

There's a "See in Wordbook" badge on the article page header if the article's slug matches a word entry. But there's no inline integration — no hover tooltip showing the definition, no automatic detection of wordbook terms in article text, no way to mark a word in prose and pull its structured data into context.

For an app whose entire identity is connecting knowledge and language, this seam between the two halves is the most conspicuous gap. The user has to leave the article, navigate to the wordbook, find the word, read the definition, and hold it in their head while navigating back. The structured data exists — it just doesn't flow into the reading experience.

---

## 7. Calendar and Celestial data doesn't flow into articles

You can link a wiki page to a celestial body or a calendar entry. But the structured data stays on its own dedicated page. You cannot embed a planet's orbital parameters, a star's spectral classification, or a calendar date into an article as live data.

A user writing an article about a planet has to manually type out the mass, radius, and orbital period — duplicating numbers that already exist in the celestial module's database. When those numbers get updated in the celestial configuration, the article goes stale. There's no `{{celestial:planet-name|mass}}` transclusion, no infobox that pulls from the structured record, no widget that renders the data inline.

The calendar and celestial modules feel like separate apps that share a navigation bar rather than integrated parts of a single knowledge system. The linking is cosmetic — a URL reference, not a data connection.

---

## 8. No templates or starter structures for new articles

When a user creates a new article — about a character, a location, a species, a historical event — they start from a completely blank editor. There's a templates API on the backend (`/api/templates/`), but no "start from template" picker in the creation flow.

This means every new article requires the user to either remember the right markup patterns for infoboxes, categories, and section structure, or open an existing article and copy-paste its skeleton. Both are error-prone and slow. Consistency across articles of the same type (all character pages having the same sections, all location pages having the same infobox fields) depends entirely on the user's discipline and memory.

A template selector at article creation time — even just a dropdown with a handful of presets — would standardize structure and lower the barrier to contribution.

---

## 9. No user profiles

The app has a multi-user system with roles (owner, admin, editor, viewer), registration codes, and session management. But there are no user profile pages. Contributors are names in edit histories that lead nowhere.

You can't see when someone joined, what they've been working on, or what their role is (unless you're an admin looking at the user management table). In a collaborative tool, this makes contributors invisible as people. The name "jsmith" appears in a revision log, but there's no page at `/user/jsmith` showing their contributions, their focus areas, or even confirming they exist.

This ties into the "can't see your own work" gap — profiles would be the natural home for a contributions view, a watchlist, and any per-user preferences.

---

## 10. No way to watch or follow specific content

There is no watchlist. No notification system. No way to subscribe to changes on a specific article, language, or celestial body. If you care about a particular page, your only option is to check Recent Changes regularly and scan for it.

In a multi-user setup this means edits to pages you care about are silent. Someone rewrites the article you spent a week on — you find out next time you happen to visit it, or never. Someone adds a word to a language you're maintaining — it doesn't surface unless you're watching the global feed.

A watchlist doesn't require real-time push notifications to be useful. Even a simple "pages I'm watching" list with a filtered view of recent changes to those pages would close this gap.
