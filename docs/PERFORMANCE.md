# Performance

Postern is local-first, which means performance is a promise the architecture has to keep. The mail lives in SQLite on the device. Opening a thread is a local read. Sync runs behind the UI, never in front of it. This doc turns that promise into specified targets and PR-checkable decisions. If a PR makes the local read slower, blocks the UI on the network, or re-downloads what is already on disk, the PR is wrong.

## What we optimize for

The user opens Postern and sees their correspondence now, not after a spinner. They type in search and results appear under their fingers. The phone does not cook in their pocket while syncing. Everything below follows from those three.

## Decisions

### 1. Large mailboxes

A real account holds 100k messages or more. Pulling all of it on first run is a non-starter.

**What we do.** Bound the initial sync to the last 90 days. Older mail loads on demand, when the user scrolls back or searches. After the first sync, every subsequent sync is incremental: IMAP CONDSTORE and QRESYNC, or JMAP state, tell the server what changed since the last cursor, and Postern fetches only the delta. A message body is never re-downloaded once it is on disk. The thread-tile canvas is virtualized, FlashList on mobile, virtual scroll on web, so a 100k-message account renders the same number of tiles as a 100-message account.

**Anti-pattern.** A full mailbox sync on first connect. Re-fetching headers Postern already has because the cursor logic was skipped. Rendering every thread tile into the DOM and letting the browser sort it out. Loading message bodies eagerly during list sync.

### 2. Search

Search has to feel instant, and semantic search must not make it slow.

**What we do.** Two tiers. The fast tier is FTS5, the SQLite full-text index, queried on keystroke behind a short debounce. It is local, it is sub-frame, and it returns as the user types. The second tier is semantic search: it uses embeddings, fires on Enter rather than on every keystroke, and runs async so it never sits on the keystroke path. Semantic is BYO key for the query embedding where a cloud model is used, off by default for users who have not configured it. The FTS5 index is kept current as sync streams new messages in, so search never lags the mailbox.

**Anti-pattern.** Running semantic search on every keystroke. Blocking the FTS5 result on the embedding round-trip. Letting the index fall behind sync, so a just-arrived message is unfindable. A search box that waits for a network call before showing local matches.

### 3. Local-first perceived speed

Perceived speed is the product. The architecture exists to deliver it.

**What we do.** Open reads from SQLite and paints immediately. Sync runs in the background and streams updates into the already-painted UI. The first-run experience is built on this: the welcome tile shows instantly, and the user watches their real correspondence stream onto the canvas as sync pulls it down. The UI never waits on the network to show what is already local.

**Anti-pattern.** A loading screen on open while sync runs. Painting the UI only after the first sync round completes. Coupling a render to a network response when the data is already in SQLite. A first-run that shows a spinner instead of arriving mail.

### 4. Embeddings

Embeddings power semantic search, and they are expensive enough to ruin sync if done wrong.

**What we do.** On desktop, embed locally with nomic-embed running in a worker, quantized to int8, off the critical sync path. New messages get embedded after they land, in the background, so sync throughput is never gated on the embedder. On mobile, embed on demand at query time rather than indexing the whole mailbox, until phone hardware makes background embedding cheap. The embedder never runs on the main thread.

**Anti-pattern.** Embedding on the main thread. Blocking sync until a batch is embedded. Eagerly embedding a 100k-message mailbox on a phone. Shipping a full-precision model where int8 holds the quality.

### 5. Rendering

A mail client renders long lists and heavy bodies. Both are virtualized or deferred.

**What we do.** Lists are virtualized, so on-screen tile count drives render cost, not total message count. Message bodies fetch lazily: the Part model supports loading a body on open rather than during list sync, so the list stays light and the body arrives when the thread is opened. Fonts are self-hosted subsets, Inter and Source Serif 4, bundled and trimmed to the glyphs used, so no CDN round-trip and no full-family download.

**Anti-pattern.** A non-virtualized list. Fetching every body during list render. Loading fonts from a CDN. Shipping the full font family when a subset covers the UI.

### 6. Sync efficiency and battery

On mobile, polling for new mail drains the battery and the data plan.

**What we do.** Use push, not polling. New mail flows through a push relay (Pub/Sub to APNs on iOS, FCM on Android) so the device wakes only when there is something to fetch. On desktop, IMAP IDLE holds an open connection and the server notifies on change. Every retry path uses exponential backoff, so a flaky network or a down server does not turn into a tight reconnect loop.

**Anti-pattern.** A fixed polling interval on mobile. A reconnect loop with no backoff. Holding an IDLE connection open on mobile where push relay is the right tool. Waking the device on a schedule when nothing has changed.

## Budgets

Rough targets, measured on a mid-range device against a warm local cache. These are the numbers a PR should not regress.

| Action | Budget | Source |
|---|---|---|
| Cold open to first paint | < 1s | Local SQLite cache, no network wait |
| Search keystroke to result | < 50ms | FTS5, local, debounced |
| Thread open to body visible | < 100ms | Local read, lazy body fetch |

The cold-open budget assumes the local cache exists, which it does after the first run. The search budget is the FTS5 tier only, semantic is async and excluded. The thread-open budget covers the body already on disk, a body fetched on demand from the server is a separate network operation with its own loading affordance.

## PR performance checklist

The reviewer asks these before approving any PR that touches sync, search, rendering, or storage reads.

1. Does any UI render wait on a network response when the data is already in SQLite?
2. Does sync re-download messages or bodies that are already on disk, or skip the incremental cursor?
3. Is search blocked on a network call before showing local FTS5 results, or does semantic run on the keystroke path?
4. Is any list non-virtualized, or any message body fetched eagerly during list sync?
5. Does embedding run on the main thread, on the critical sync path, or eagerly across a large mailbox?
6. Does mobile poll on a fixed interval where push relay applies, or does any retry skip exponential backoff?
7. Does any asset (font, icon) load from a CDN instead of a bundled subset?
8. Does the change regress the cold-open, search-keystroke, or thread-open budget?

A clean answer to all eight clears the PR for normal review. A dirty answer means the performance decision is the breaking change, and that review happens first.
