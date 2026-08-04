**English** | [简体中文](RELEASING.zh-CN.md)

# Releasing Pi Kanban

Releases are managed by GitHub Actions, Release Please, and npm Trusted Publishing. No long-lived npm token is stored in GitHub.

## One-time setup

1. In GitHub, open **Settings → Actions → General**. Keep the default workflow permission read-only, and enable **Allow GitHub Actions to create and approve pull requests**. The release workflow grants write access only to the job that needs it.
2. Create a GitHub environment named `npm`. Optionally require a reviewer so npm publication has a final manual gate.
3. In the npm settings for `pi-kanban0`, add a GitHub Actions trusted publisher with:
   - Organization or user: `AHGGG`
   - Repository: `pi-kanban0`
   - Workflow filename: `release.yml`
   - Environment: `npm`
   - Allowed action: `npm publish`
4. Do not add an `NPM_TOKEN` secret. The publish job authenticates with a short-lived OIDC token and npm adds provenance automatically.

## Normal release flow

1. Merge normal pull requests into `main`. Use Conventional Commit prefixes:
   - `fix:` creates a patch release.
   - `feat:` creates a minor release.
   - `feat!:` or a `BREAKING CHANGE:` footer creates a major release.
   - `docs:`, `test:`, `ci:`, and `chore:` normally do not trigger a release.
2. The Release workflow verifies `main`, then creates or updates a Release Please pull request containing the version bump and `CHANGELOG.md` changes.
3. Review and merge that release pull request when the package is ready.
4. The same workflow verifies the merged commit, creates the `vX.Y.Z` tag and GitHub Release, and publishes that exact tag to npm.

Release Please uses the short-lived repository `GITHUB_TOKEN`. GitHub may place CI on its pull request in an approval-required state; approve that run from the pull request checks. Do not add a personal access token merely to bypass this safeguard.

Do not edit `package.json` or `.release-please-manifest.json` versions by hand during normal development. To force a specific version, add `Release-As: X.Y.Z` to the body of a Conventional Commit.

## Recovery

If npm publication fails after the GitHub Release is created, fix the configuration and rerun the failed `Publish to npm` job. The workflow checks the registry first, so rerunning it is safe when the version was already published.

The release baseline is npm `0.1.0` at commit `db66ff7eb900ee8cb440caa5ce3583672d5a8931`. The bootstrap SHA is ignored after Release Please creates the first release pull request.
