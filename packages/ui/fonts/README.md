# Fonts

Postern self-hosts its brand fonts. No Google Fonts CDN, no third-party loading. The brand outlives the CDN.

## What lives here

- **Inter** (variable, weights 400 / 500 / 600 used). Source: [rsms.me/inter](https://rsms.me/inter/) or [github.com/rsms/inter](https://github.com/rsms/inter/releases). License: SIL Open Font License 1.1.
- **Source Serif 4** (variable, weights 400 / 600 used). Source: [github.com/adobe-fonts/source-serif](https://github.com/adobe-fonts/source-serif/releases). License: SIL Open Font License 1.1.

## File layout

```
fonts/
├── inter/
│   ├── InterVariable.woff2
│   └── InterVariable-Italic.woff2
└── source-serif-4/
    ├── SourceSerif4Variable-Roman.woff2
    └── SourceSerif4Variable-Italic.woff2
```

## How to populate

Run `scripts/fetch-fonts.sh` from the repo root. The script downloads the latest variable WOFF2 files from the upstream sources into this directory. It does not commit them.

WOFF2 files are committed to the repo. They are part of the brand asset bundle, not regenerated at build time.

## Why we self-host

The plan's "20-Year Durability Principles" require it. Third-party font hosting goes down. Google Fonts could change its terms. The brand assets need to live with the code, under the same license, forever.
