/**
 * HTML email sanitization. The number-one attack surface in any mail
 * client: rendering untrusted HTML and CSS from arbitrary senders.
 *
 * This neutralizes scripts, event handlers, dangerous tags, and unsafe
 * URI schemes via a strict allowlist, hardens links, and (optionally)
 * blocks remote content so senders can't beacon a read receipt or track
 * an open. The sanitized string is meant to be rendered inside a
 * sandboxed iframe with a strict CSP, never injected into the app DOM
 * directly.
 *
 * Pure and DOM-injected: pass a real window in the app, a jsdom window
 * in tests. No bundled jsdom in production builds.
 */

import DOMPurify from 'dompurify'

export type SanitizerWindow = Parameters<typeof DOMPurify>[0]

export interface SanitizeOptions {
  /** Strip remote src/background/poster and remote url() in styles. */
  readonly blockRemoteContent: boolean
}

export interface SanitizeResult {
  readonly html: string
  /** Distinct remote resources that were blocked. */
  readonly blockedRemoteCount: number
}

export interface EmailSanitizer {
  sanitize(html: string, options: SanitizeOptions): SanitizeResult
}

const ALLOWED_TAGS = [
  'a',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'col',
  'colgroup',
  'div',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]

const ALLOWED_ATTR = [
  'href',
  'src',
  'alt',
  'title',
  'width',
  'height',
  'style',
  'colspan',
  'rowspan',
  'align',
  'valign',
  'dir',
  'lang',
]

// http(s) for remote, mailto/tel for actions, cid for inline parts.
// Blocks javascript:, data:, vbscript:, file:, and friends.
const ALLOWED_URI_REGEXP = /^(?:https?|mailto|tel|cid):/i

// Remote includes protocol-relative (//host) as well as http(s).
const REMOTE_URL = /^(?:https?:)?\/\//i
// Catches remote refs inside url(...) and image-set(...), including
// protocol-relative and quoted forms.
const REMOTE_STYLE_URL = /(?:url|image-set)\(\s*['"]?\s*(?:https?:)?\/\/[^)]*\)/gi

const REMOTE_ATTRS = ['src', 'srcset', 'background', 'poster'] as const

export function createEmailSanitizer(window: SanitizerWindow): EmailSanitizer {
  const purify = DOMPurify(window)

  let blockRemote = false
  let blocked = new Set<string>()

  purify.addHook('afterSanitizeAttributes', (node) => {
    if (!('getAttribute' in node) || typeof node.getAttribute !== 'function') {
      return
    }
    const el = node as Element

    if (el.tagName === 'A' && el.hasAttribute('href')) {
      el.setAttribute('rel', 'noopener noreferrer')
      el.setAttribute('target', '_blank')
    }

    if (!blockRemote) return

    for (const attr of REMOTE_ATTRS) {
      const value = el.getAttribute(attr)
      if (value !== null && REMOTE_URL.test(value)) {
        el.removeAttribute(attr)
        el.setAttribute(`data-blocked-${attr}`, value)
        blocked.add(value)
      }
    }

    const style = el.getAttribute('style')
    if (style !== null && REMOTE_STYLE_URL.test(style)) {
      for (const match of style.match(REMOTE_STYLE_URL) ?? []) {
        blocked.add(match)
      }
      el.setAttribute('style', style.replace(REMOTE_STYLE_URL, 'url()'))
    }
  })

  return {
    sanitize(html, options) {
      blockRemote = options.blockRemoteContent
      blocked = new Set()
      const clean = purify.sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOWED_URI_REGEXP,
        ALLOW_DATA_ATTR: false,
        ADD_ATTR: ['target', 'rel'],
        FORBID_CONTENTS: ['script', 'style'],
      })
      return { html: clean, blockedRemoteCount: blocked.size }
    },
  }
}
