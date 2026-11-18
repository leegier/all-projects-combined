# UTM Parameter Guide

UTM parameters are query string tags that tell analytics tools where traffic came from.

## Standard Parameters

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `utm_source` | Who sent the traffic | `amazon-associates` |
| `utm_medium` | How it was sent | `affiliate` |
| `utm_campaign` | Which campaign/product | `unity-book` |
| `utm_content` | Which specific link (A/B) | `sidebar-link` |
| `utm_term` | Keyword (paid search) | usually unused for affiliates |

## Example

Base URL: `https://amazon.com/dp/B0XXXXX?tag=nightshade-20`

With UTM: `https://amazon.com/dp/B0XXXXX?tag=nightshade-20&utm_source=amazon-associates&utm_medium=affiliate&utm_campaign=unity-book`

## Why Use UTM Tags

- Track which content pieces drive affiliate clicks
- See in Google Analytics exactly which posts generate revenue
- Compare link placements (header vs. body vs. end of post)

## Amazon Affiliate Note

Amazon strips UTM params on redirect — the `tag=` parameter is what actually tracks commission. UTM params help YOU know where the click came from in your own analytics, but don't affect Amazon's tracking.

## Shortening Links

Long UTM URLs look spammy. Use a URL shortener or custom domain redirect:
- `bit.ly` (free, basic)
- `rebrandly.com` (custom domain)
- Your own domain: `nightshadehollow.com/go/unity-book` → redirects with UTM
