# Garment product photos

Drop real product photos here so each garment shows a multi-angle gallery
(Front / Back / Left / Right) when a buyer taps its thumbnail in "Choose your garments".

## How it works

Each garment has its own folder, named after the garment (a "slug").
Inside each folder, add up to four images:

```
public/garments/<slug>/front.jpg
public/garments/<slug>/back.jpg
public/garments/<slug>/left.jpg
public/garments/<slug>/right.jpg
```

- Filenames must be exactly `front.jpg`, `back.jpg`, `left.jpg`, `right.jpg` (lowercase).
- Any missing view automatically falls back to the line-drawing icon, so you can
  add photos gradually — one garment (or one angle) at a time.
- Recommended: portrait images around **900 × 1200 px**, product centred on a
  plain background (like the Flipkart reference), each angle framed consistently.

## Folder name = the garment slug

The slug is the garment name in lowercase with spaces/symbols turned into `-`.
Examples:

| Garment in the app      | Folder              |
| ----------------------- | ------------------- |
| T-Shirts                | `t-shirts`          |
| Polo T-Shirts           | `polo-t-shirts`     |
| Hoodies                 | `hoodies`           |
| Shirts (Formal)         | `shirts-formal`     |
| Track Pants             | `track-pants`       |
| Lehenga / Skirt Sets    | `lehenga-skirt-sets`|
| Ethnic Wear (Girls)     | `ethnic-wear-girls` |

All 45 folders are already created for you — just drop the photos in.

> Note: photos are shared across Men's / Women's / Kids for the same garment name.
> If you later want different photos per audience, tell the developer and we can
> extend the folder scheme (e.g. `t-shirts/mens/front.jpg`).
