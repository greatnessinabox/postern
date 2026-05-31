import { JSDOM } from 'jsdom'
import { beforeAll, describe, expect, it } from 'vitest'
import { createEmailSanitizer, type EmailSanitizer } from '../sanitize.ts'

let sanitizer: EmailSanitizer

beforeAll(() => {
  const { window } = new JSDOM('')
  sanitizer = createEmailSanitizer(window as unknown as Parameters<typeof createEmailSanitizer>[0])
})

const allow = { blockRemoteContent: false }
const block = { blockRemoteContent: true }

describe('createEmailSanitizer', () => {
  it('preserves safe formatting', () => {
    const { html } = sanitizer.sanitize('<p>Hello <strong>world</strong></p>', allow)
    expect(html).toContain('<strong>world</strong>')
    expect(html).toContain('<p>')
  })

  it('strips script tags', () => {
    const { html } = sanitizer.sanitize('<p>hi</p><script>steal()</script>', allow)
    expect(html).not.toContain('<script')
    expect(html).not.toContain('steal()')
    expect(html).toContain('<p>hi</p>')
  })

  it('strips inline event handlers', () => {
    const { html } = sanitizer.sanitize('<img src="https://x.test/a.png" onerror="evil()">', allow)
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('evil()')
  })

  it('strips javascript: and data: URI schemes', () => {
    const js = sanitizer.sanitize('<a href="javascript:alert(1)">x</a>', allow)
    expect(js.html).not.toContain('javascript:')
    const data = sanitizer.sanitize('<a href="data:text/html,<script>1</script>">x</a>', allow)
    expect(data.html).not.toContain('data:text/html')
  })

  it('removes iframes, forms, and embeds (phishing and framing vectors)', () => {
    const { html } = sanitizer.sanitize(
      '<iframe src="https://evil.test"></iframe><form action="https://evil.test"><input></form><embed src="x">',
      allow,
    )
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('<input')
    expect(html).not.toContain('<embed')
  })

  it('hardens links with rel and target', () => {
    const { html } = sanitizer.sanitize('<a href="https://good.test/x">link</a>', allow)
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('target="_blank"')
  })

  it('keeps remote images when blocking is off', () => {
    const result = sanitizer.sanitize('<img src="https://cdn.test/a.png">', allow)
    expect(result.html).toContain('src="https://cdn.test/a.png"')
    expect(result.blockedRemoteCount).toBe(0)
  })

  it('blocks remote images and counts them when blocking is on', () => {
    const result = sanitizer.sanitize(
      '<img src="https://tracker.test/pixel.gif"><img src="https://tracker.test/two.gif">',
      block,
    )
    // No live src attribute (preceded by whitespace or quote); only the
    // data-blocked-src marker remains.
    expect(result.html).not.toMatch(/[\s"]src="https:\/\/tracker/)
    expect(result.html).toContain('data-blocked-src="https://tracker.test/pixel.gif"')
    expect(result.blockedRemoteCount).toBe(2)
  })

  it('neutralizes remote url() in inline styles when blocking is on', () => {
    const result = sanitizer.sanitize(
      '<div style="background-image: url(https://tracker.test/bg.png)">x</div>',
      block,
    )
    expect(result.html).not.toContain('tracker.test/bg.png')
    expect(result.blockedRemoteCount).toBe(1)
  })

  it('leaves cid: inline references intact', () => {
    const { html } = sanitizer.sanitize('<img src="cid:logo123">', block)
    expect(html).toContain('src="cid:logo123"')
  })

  it('blocks protocol-relative image sources (DOMPurify scheme allowlist)', () => {
    // Protocol-relative // is not an allowed scheme, so DOMPurify strips the
    // src outright before the remote-blocking hook runs. The image cannot
    // load either way; what matters is the URL is gone.
    const result = sanitizer.sanitize('<img src="//tracker.test/pixel.gif">', block)
    expect(result.html).not.toContain('tracker.test')
  })

  it('blocks protocol-relative url() in styles', () => {
    const result = sanitizer.sanitize(
      '<div style="background: url(//tracker.test/bg.png)">x</div>',
      block,
    )
    expect(result.html).not.toContain('tracker.test/bg.png')
    expect(result.blockedRemoteCount).toBe(1)
  })

  it('blocks image-set() remote urls in styles', () => {
    const result = sanitizer.sanitize(
      `<div style="background-image: image-set('https://tracker.test/x.png' 1x)">x</div>`,
      block,
    )
    expect(result.html).not.toContain('tracker.test/x.png')
    expect(result.blockedRemoteCount).toBe(1)
  })

  // Regression guards on the number-one attack surface. These are
  // neutralized today; the tests stop a DOMPurify bump or allowlist tweak
  // from silently reintroducing them.
  it('strips style tags and their css payloads', () => {
    const { html } = sanitizer.sanitize(
      '<style>body { background: url(https://evil.test/x) }</style><p>hi</p>',
      block,
    )
    expect(html).not.toContain('<style')
    expect(html).not.toContain('evil.test')
  })

  it('strips svg with embedded scripts', () => {
    const { html } = sanitizer.sanitize(
      '<svg><script>alert(1)</script><a xlink:href="javascript:alert(1)">x</a></svg>',
      allow,
    )
    expect(html).not.toContain('<script')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('alert(1)')
  })

  it('strips control-character obfuscated javascript schemes', () => {
    const { html } = sanitizer.sanitize('<a href="java\tscript:alert(1)">x</a>', allow)
    expect(html).not.toContain('alert(1)')
    expect(html.toLowerCase()).not.toContain('javascript')
  })
})
