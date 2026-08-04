# Privacy Policy — Nepo Baby Detector for Letterboxd

Last updated: 2026-08-04

## What this extension does

Nepo Baby Detector for Letterboxd runs only on `letterboxd.com` film and
actor pages. It highlights cast members who have a notable parent, using a
pre-built dataset published by the
[nepo-babies-scraper](https://github.com/SomeLikeItChott/nepo-babies-scraper)
project.

## Data collection

This extension does **not** collect, transmit, or sell any personal data,
browsing history, or usage analytics. It has no tracking, no telemetry, and
no third-party scripts.

## Data storage

The extension downloads a static, pre-generated dataset (actor/parent
relationships sourced from Wikidata) from a public GitHub Pages URL and
stores it in your browser's local extension storage (`chrome.storage.local` /
`browser.storage.local`) so it doesn't need to be re-downloaded on every
page load. This dataset contains only public information about film
industry figures — nothing about you or your browsing activity.

## Network requests

The only network request the extension makes is fetching the dataset file
from:

```
https://somelikeitchott.github.io/nepo-babies-scraper/nepo-babies.json.gz
```

This happens at most once a week, in the background. No request includes
any identifying information about you.

## Permissions

- `storage` — to cache the dataset locally.
- Host access to `letterboxd.com` — to read cast/actor names and insert
  the badges and tooltips.
- Host access to the GitHub Pages dataset URL above — to fetch dataset
  updates.

## Contact

Questions about this policy: samchott@gmail.com
