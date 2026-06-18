# Deployment

## Cloudflare Pages
1. Create a Pages project connected to the private `openggf-webzone` repo. Build command:
   `npm run build`. Output dir: `dist`. (Pages auto-deploys on push to `main`.)
2. Add custom domain `openggf.com` (Cloudflare DNS preferred; otherwise CNAME to `*.pages.dev`).

## Release-triggered refresh (the "latest" promise)
Add this workflow to **`jamesj999/OpenGGF`** so a published release pings the webzone repo:

```yaml
name: Notify website
on:
  release:
    types: [published]
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Dispatch to webzone
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.WEBZONE_DISPATCH_PAT }}" \
            -H "Accept: application/vnd.github+json" \
            https://api.github.com/repos/<owner>/openggf-webzone/dispatches \
            -d '{"event_type":"engine-release"}'
```

`WEBZONE_DISPATCH_PAT` is a fine-grained PAT scoped to `openggf-webzone` with
**Contents: write** and **Metadata: read**. GitHub's "Create a repository dispatch event"
REST endpoint requires *Contents: write* for fine-grained tokens — `contents: read` is not
sufficient and the dispatch call will 403. The webzone `refresh-on-release.yml` then refreshes
the cache, commits, and pushes — which triggers the Pages build.
