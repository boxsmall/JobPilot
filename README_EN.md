# JobPilot

A local Chrome / Edge job-search assistant based on AutoCast. Includes local PDF/DOCX/text resume parsing, configurable DeepSeek-compatible AI matching, recommendation reports, application automation, scoped HR replies, requested attachments and daily reports.

This is a local development build, not a store release. Automated and isolated-browser checks pass; live AI and recruiting-account validation remain outstanding.

Load `extension/` as an unpacked extension. Read [the Chinese guide](使用说明.md) for setup and [privacy details](PRIVACY.md) for data handling.

Install development dependencies with `pnpm install --frozen-lockfile`, then run `pnpm run check`. Browser checks: `pnpm exec playwright install chromium` followed by `pnpm test:career:browser`.

Based on [AutoCast](https://github.com/gstranded/autocast-boss-assistant), MIT. Original copyright and license are retained. Bundled parser notices are in `extension/vendor/`. Upstream documents in `docs/upstream/` describe the original project, not this fork's release status.
