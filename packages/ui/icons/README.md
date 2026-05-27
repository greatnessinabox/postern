# Icons

Postern's SVG icon system. Self-hosted, no third-party icon fonts or icon libraries.

## Conventions

- One file per icon.
- File name in kebab-case: `archway.svg`, `your-turn-dot.svg`, `attachment.svg`.
- Single color, drawn with `stroke="currentColor"` or `fill="currentColor"` so the icon inherits its parent's color.
- 24x24 viewBox by default. Use the size that fits the icon's intended display size at 1x, the surface renders at its own scale.
- Stroke width 1.5px for outline icons. Filled icons have no stroke.
- No embedded fonts. No raster images. No external references.

## Naming

Icon names describe the thing, not the action.

- Yes: `archway`, `pin`, `compose`, `clock`, `attachment`
- No: `add-to-favorites`, `start-new-message`, `schedule-send-button`

The component layer chooses how each icon is used.

## Adding a new icon

1. Open the SVG in a vector editor (Figma, Illustrator, Boxy SVG).
2. Set the viewBox, set the stroke or fill to `currentColor`, save as SVG.
3. Run it through SVGO with the default preset to strip metadata.
4. Drop the file in this directory.
5. Add an entry to `packages/icons/src/index.ts` (the registry).

## Why no Lucide or Heroicons

Both are great. Both are third-party packages with their own release cycles, their own breaking changes, their own future. The 20-year durability principles say the brand assets live with the code. Icons are brand assets.
