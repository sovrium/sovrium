# Attachment

> The `attachment` component — an attachment chip: one file drawn by its icon or thumbnail, its name and size, and a way to open it.

An `attachment` lists one file the way a conversation or a page shows it: a small chip with the file's icon or a thumbnail, its name, a line describing it, and a link that opens it once it is ready. Everything on the chip is written in the config; a file held by a record is shown with `file-preview` instead. Reference: shadcn/ui Attachment.

```yaml
components:
  - type: attachment
    name: signed-contract-2026.pdf
    description: PDF, 2.4 MB
    href: /files/contracts/signed-contract-2026.pdf
  - type: attachment
    name: site-visit-photo.avif
    description: Image, 860 KB
    media: image
    src: /files/visits/site-visit-photo.avif
    orientation: vertical
  - type: attachment
    name: quarterly-report.xlsx
    description: Uploading
    state: uploading
```

<!-- sovrium:options type:attachment -->

`name` is required. The icon is chosen from the file extension (a PDF, a spreadsheet, an image, an archive), or named with `icon`; it is decorative. `media: image` draws `src` as a thumbnail instead, and requires `src`: an image chip without one is refused when the config is validated. `state` draws where the file is — `done` by default, or `idle`, `uploading`, `processing` or `error` — and only a `done` file with an `href` is a link, named after the file; a chip in any other state offers nothing to open. `size` (`default`, `sm`, `xs`) and `orientation` (`horizontal`, or `vertical` for a tile with the media above the name) shape the chip.
