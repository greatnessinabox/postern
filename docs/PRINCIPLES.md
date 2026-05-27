# Principles

The seven rule-breaks that define Postern, codified as engineering principles. Every PR can be measured against this document.

## Why this doc exists

Postern is opinionated. The opinions are the product. Without a written record of what the opinions are, they erode under the weight of feature requests, framework defaults, and the gravitational pull of every other email client ever shipped. This doc is how the opinions get enforced in code review and design review.

If a PR violates a rule-break, the PR is wrong. The exception is the rare case where the rule-break itself is being amended, in which case the doc gets updated first and the PR ships against the new version.

## The seven rule-breaks

### 1. Threads, not inboxes

**The principle.** The home screen shows active correspondence, not an unread queue. Sent and received messages live together in the same thread, in the same view. The unit of work is the conversation, not the message.

**What it looks like in the product.** The Postern home is a grid of thread tiles. Each tile shows a subject, two or three message previews with sent and received messages interleaved by time, and a "your turn" indicator when the last message is inbound and unreplied. There is no tab labeled Inbox. There is no folder list in the primary chrome.

**The anti-pattern.** Adding an unread count to the home. Splitting sent and received into separate views. Hiding the "your turn" signal behind a filter. Introducing a tab called Inbox because the existing UI library has a sidebar pattern that wants one.

### 2. Spaces, not folders

**The principle.** Identity is the unit of organization. A user has a Work self, a Personal self, a Side Projects self, and the client respects that. Each Space carries its own theme, accounts, signature, and AI persona. Folders and labels are derived from the underlying mail provider, never exposed for the user to manage by hand.

**What it looks like in the product.** Three default Spaces ship with Postern. The sidebar lists them, each with a glyph and accent color. Cmd-1, Cmd-2, Cmd-3 switch between them. Switching a Space recolors the accent, swaps the glyph, and changes the signature on any open draft. There is no folder tree anywhere.

**The anti-pattern.** Adding a "Folders" sidebar item because Gmail has labels. Exposing the IMAP folder hierarchy in the UI. Letting users create nested Spaces. Treating a Space as a saved filter instead of an identity container.

### 3. Continue, not Compose

**The principle.** Most email is reply or re-up, not cold drafting. The default new-message action surfaces existing correspondence to continue, with cold compose available but not primary. The keyboard shortcut hierarchy reflects this.

**What it looks like in the product.** Cmd-N opens a Continue picker showing recent threads and Handles. The user picks one and a draft opens scoped to that thread or that Handle. Cmd-Shift-N opens a blank compose for a true cold start. The Continue picker is the default because cold-start composition is the rare case.

**The anti-pattern.** Cmd-N opens a blank compose window. Burying the Continue picker behind a menu. Showing a "New Message" button as the primary call to action on the empty state. Treating "compose" and "reply" as architecturally distinct flows when they are the same flow with different initial context.

### 4. Reader and Ledger, not inbox bloat

**The principle.** Newsletters and transactional mail do not belong in the same surface as active correspondence. Newsletters auto-route to a Reader, sized for long-form reading. Transactional mail auto-routes to a Ledger, presented as a searchable table with amount, vendor, and date columns. Neither touches the Threads home.

**What it looks like in the product.** A message with a List-Unsubscribe header lands in Reader. A message matching a receipt pattern lands in Ledger. The user can promote a sender to Threads if the routing is wrong, but the default routing is automatic and silent. The Threads home stays clean.

**The anti-pattern.** Letting newsletters appear in Threads with a "Newsletter" badge. Building a generic "Categories" feature with tabs along the top of the inbox. Asking the user to label newsletters by hand. Treating Reader and Ledger as folders rather than separate surfaces with their own affordances.

### 5. Command Bar is the client

**The principle.** Cmd-K does everything. Search, compose, snooze, schedule, switch Space, invoke a Boost, ask AI. The Command Bar is the primary interface, the rest of the chrome exists to support readers who have not learned the shortcuts yet.

**What it looks like in the product.** A single keystroke opens a search-driven palette. Typing a verb runs the verb. Typing a name finds the Handle. Typing a date snoozes. The palette is the spine of the application. UI buttons remain available, the palette is faster.

**The anti-pattern.** Burying functionality behind nested menus that the palette does not also expose. Building a palette that only searches and cannot act. Treating the palette as a power-user feature behind a settings flag. Letting the button-and-menu UI grow without keeping palette parity.

### 6. Boosts, the per-sender lens

**The principle.** Customization is per-sender, per-Space, or per-thread, written as Boosts. A Boost is CSS for rendering, JS for thread transforms, or a prompt template for AI behavior. Boosts are local files, shareable as gists. The community surface looks like the Obsidian plugin ecosystem at small scale, not the Chrome Web Store.

**What it looks like in the product.** A user installs a Boost by pasting a gist URL. The Boost gets attached to a sender, a Space, or a filter. The Boost runs in a sandboxed worker with a documented API surface. Boosts have versions, can be disabled, can be inspected.

**The anti-pattern.** A monolithic settings panel where every possible rendering option lives. A proprietary plugin marketplace with reviews and ratings. An RPC bridge from Boosts to the rest of the app with no sandbox. A Boost API that grows to swallow features that should live in the core.

### 7. Handles, the addresses are routing

**The principle.** A person is one Handle. The addresses marquis@cleverer.tech, marquis@ted.com, marquis@gmail.com belong to the same Handle. Correspondence happens with the Handle. The address is metadata about delivery, not the identity of the correspondent.

**What it looks like in the product.** Search for a name and the result is one Handle, not three rows. Look at a thread and the sender's avatar shows the Handle, with the address available on hover. Merge and split affordances let the user fix the routing when the auto-grouping is wrong. The schema carries Handles from Phase 1.

**The anti-pattern.** Treating each email address as a separate contact. Building a "Contacts" feature that mirrors the address book without de-duplication. Showing different avatars for the same person across two accounts. Letting Handles drift out of the schema because the UI is not ready, so the data has to be re-derived later from incomplete history.

## The eight canonical primitives

The rule-breaks above are enforced through eight types that make up the stable interface of Postern. Every PR touches at least one. Anything that does not fit one of these eight should make us pause.

1. **Account.** A connected mail source (Gmail, Outlook, Fastmail, generic IMAP). Belongs to one or more Spaces.
2. **Handle.** A person, identified across multiple addresses.
3. **Space.** An identity container with its own theme, accounts, signature, and AI persona.
4. **Thread.** A conversation. The unit of work. Sent and received messages live together.
5. **Message.** A single piece of correspondence within a Thread.
6. **Part.** A section of a Message (text body, HTML body, attachment, signature). MIME-derived, protocol-neutral.
7. **Boost.** A scriptable customization attached to a sender, Space, or thread filter.
8. **Command.** A callable action surfaced via Cmd-K.

The full TypeScript signatures live in ARCHITECTURE.md. The principle here is that these eight types are the lingua franca. UI code talks to the core in these terms. The core talks to protocol adapters in these terms. The shape of a Thread does not change because a particular adapter is JMAP or IMAP. The shape of a Boost does not change because the active AI provider is Anthropic or Ollama.

## How to use this doc

A checklist for PR review. The reviewer asks five questions, in order.

1. Does this PR violate any of the seven rule-breaks? If yes, the PR is wrong unless the doc is being updated in the same stack.
2. Which of the eight primitives does this PR touch? Does the change preserve the shape of the primitive, or does it add fields that leak protocol-specific structure into the core?
3. Does any code in `apps/*` or `packages/ui` import directly from `packages/protocol`, `packages/ai`, or `packages/storage`? If yes, the PR is wrong. The flow goes through `packages/core`.
4. Is any AI feature in the PR missing a non-AI fallback? If yes, the PR is wrong. Every AI feature has a fallback path that works without a cloud key.
5. Is any brand asset (font, icon, image) loaded from a third-party CDN? If yes, the PR is wrong. Brand assets are bundled.

If all five answers are clean, the PR is ready for the usual code review on top of this. If any answer is dirty, the principle was the breaking change and the principle review happens first.
