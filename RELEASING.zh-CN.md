[English](RELEASING.md) | **简体中文**

# 发布 Pi Kanban

发布由 GitHub Actions、Release Please 和 npm Trusted Publishing 管理。GitHub 中不保存长期有效的 npm token。

## 一次性设置

1. 在 GitHub 打开 **Settings → Actions → General**，保留默认 workflow 只读权限，并启用 **Allow GitHub Actions to create and approve pull requests**。只有确实需要写权限的 release job 会单独提权。
2. 创建名为 `npm` 的 GitHub environment。可以设置 required reviewer，为 npm 发布增加最后一道人工确认。
3. 在 npm 的 `pi-kanban0` 包设置中添加 GitHub Actions trusted publisher：
   - Organization or user：`AHGGG`
   - Repository：`pi-kanban0`
   - Workflow filename：`release.yml`
   - Environment：`npm`
   - Allowed action：`npm publish`
4. 不要添加 `NPM_TOKEN` secret。发布任务使用短期 OIDC token，npm 会自动生成 provenance。

## 日常发布流程

1. 正常合并 pull request 到 `main`，提交信息使用 Conventional Commits：
   - `fix:` 生成 patch 版本。
   - `feat:` 生成 minor 版本。
   - `feat!:` 或 `BREAKING CHANGE:` footer 生成 major 版本。
   - `docs:`、`test:`、`ci:` 和 `chore:` 通常不触发发布。
2. Release workflow 验证 `main`，然后创建或更新 Release Please pull request，其中包含版本更新和 `CHANGELOG.md`。
3. 准备发布时，审核并合并这个 release pull request。
4. 同一个 workflow 会验证合并后的提交，创建 `vX.Y.Z` tag 和 GitHub Release，并将该 tag 对应的内容发布到 npm。

Release Please 使用仓库的短期 `GITHUB_TOKEN`。GitHub 可能把它创建的 pull request CI 标记为等待批准；在 pull request 的 Checks 中批准运行即可，不要仅为了绕过这项保护而添加 personal access token。

日常开发不要手动修改 `package.json` 或 `.release-please-manifest.json` 的版本。如需指定版本，在一条 Conventional Commit 的正文中加入 `Release-As: X.Y.Z`。

## 失败恢复

如果 GitHub Release 已创建但 npm 发布失败，修复配置后重新运行失败的 `Publish to npm` job。workflow 会先检查 npm registry，因此版本已经成功发布时也可以安全重跑。

当前发布基线是 npm `0.1.0`，对应提交 `db66ff7eb900ee8cb440caa5ce3583672d5a8931`。Release Please 创建第一个 release pull request 后会忽略 bootstrap SHA。
