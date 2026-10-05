# Obsidian 插件部署与实现

Neural Vault 支持桌面版 Obsidian 1.7.2 及以上，插件 ID 为 `neural-vault`。安装后的界面、脚本和样式均在本机运行，支持离线浏览当前知识库。

## 手动安装

1. 从项目的 GitHub Releases 下载 `neural-vault.zip`，解压得到 `neural-vault` 目录。
2. 将目录复制到 `<知识库>/.obsidian/plugins/neural-vault/`。使用自定义配置目录时，将 `.obsidian` 替换为实际配置目录。
3. 确认 `main.js`、`manifest.json` 和 `styles.css` 直接位于该目录中。
4. 在 Obsidian「设置 → 第三方插件」关闭受限模式，刷新列表并启用 **Neural Vault**。
5. 点击左侧网络图标，或执行命令 **Neural Vault: 打开知识库水母星图**。

命令 **Neural Vault: 刷新知识库数据** 可手动刷新；通常文件变化会自动更新界面。

更新时先关闭插件，用新版发布包内的文件覆盖插件目录，包括许可和第三方声明，再重新启用。保留插件目录中的 `data.json` 可保留阅读历史。卸载时关闭插件，再删除 `neural-vault` 目录。

## 从源码构建

在项目目录执行：

```sh
npm ci
npm run build:plugin
```

输出目录：

```text
plugin-dist/neural-vault/
├── main.js
├── manifest.json
├── styles.css
├── README.md
├── LICENSE
├── NOTICE
└── THIRD_PARTY_NOTICES.txt
```

构建使用 Vite 将 React 界面打包为单文件 IIFE，再使用 esbuild 生成 Obsidian 加载的 CommonJS 插件。`obsidian` API 由宿主提供。界面在 iframe 中运行，脚本和样式内嵌于插件，使用系统字体回退，因此安装后无需启动开发服务器。

发布包构建排除本地预览快照，内置合成演示数据；安装运行后从使用者当前打开的 Obsidian 知识库读取笔记内容。

运行检查：

```sh
npm test
```

## Web 预览

```sh
npm run dev
```

按终端给出的地址打开浏览器。导入本地知识库可使用：

```sh
npm run import:vault -- "/path/to/your-vault"
```

可通过第二个参数指定快照输出位置：

```sh
npm run import:vault -- "/path/to/your-vault" "/path/to/preview-snapshot.json"
```

默认输出为 `src/data/vaultSnapshot.json`，供 Web 预览读取。指定其它输出位置用于导出快照时，预览仍读取默认文件。导入器扫描六个根目录下的 Markdown 文件，输出正文、路径和文件时间；这些本地预览数据应留在开发环境中。

## 目录与数据

插件读取六个根分组：

| 水母 | 支持的根目录名 |
| --- | --- |
| 项目 | `01-项目`、`项目` |
| 资产 | `02-资产`、`资产` |
| 资源 | `03-资源`、`资源` |
| 辅助 | `04-辅助`、`辅助` |
| 灵感 | `05-灵感`、`灵感` |
| skills | `06-Skills`、`skills` |

子目录中的 Markdown 笔记归入其根分组。笔记标题依次采用 frontmatter 的 `title`、正文第一个一级标题、文件名；文件在图中通过库内完整路径区分，因此重名笔记也可以打开正确的文件。

插件通过 `app.vault.getMarkdownFiles()` 和 `cachedRead()` 读取文件，双链采用 Obsidian 已解析的 `metadataCache.resolvedLinks`。文件增删、改名、修改及链接解析更新后，事件合并触发刷新。

Web 预览使用本地 Markdown 链接解析。别名、重名和复杂相对路径的解析结果，以实际插件中的 Obsidian 数据为准。

## 正文与复制

笔记详情保留 Markdown 的标题、列表、表格、代码块和行内代码。显示时会识别常见路径、完整 JSON、命令行和配置，提供类型标签、配色和复制按钮；识别仅作用于界面。

代码保留缩进和换行，长行在代码块内部横向滚动。卡片内容按阅读顺序在约两秒内逐项显现。复制成功后显示反馈；命令以文本方式供查看与复制。

网页预览使用浏览器剪贴板。插件 iframe 通过消息向宿主请求复制，宿主验证来源并返回写入结果；打开笔记请求同样验证来源和目标文件。

## 阅读足迹

插件记录启用后打开笔记的日期，同一天重复打开只记一次，界面显示最近半年。阅读历史保存在插件的 `data.json` 中，文件修改时间仅用于文件信息展示。

## 架构参考

作者的知识库架构参考 Andrej Karpathy 的[原始 LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)。本项目是作者独立开发的 Obsidian 浏览插件，聚焦已有笔记的可视化、阅读与连接探索。

相关 Obsidian API 文档：

- [Vault](https://docs.obsidian.md/Plugins/Vault)
- [Events](https://docs.obsidian.md/Plugins/Events)
- [Obsidian API 类型](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts)

## 许可与分发

本项目原始代码和文档采用 [PolyForm Noncommercial 1.0.0](../LICENSE)。个人非商业用途免费；商业用途须取得作者单独书面授权；许可证列明的非商业机构用途按原文执行。

分发原版或二次开发版本时，须保留许可证或其官方链接，以及 [NOTICE](../NOTICE) 中的两条 `Required Notice:`，明确原作者和原始仓库。推荐在二次开发项目的 README 中同时注明来源。完整安装包随附项目许可和第三方许可证声明；第三方依赖仍采用各自许可证。
