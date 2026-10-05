# Neural Vault

<img width="1920" height="945" alt="Neural Vault" src="https://github.com/user-attachments/assets/03b654dd-eeac-4166-92cd-a8d5bca61a53" />


一个桌面版 Obsidian 插件，自动把知识库里的根目录变成水母星图。打开分支查看笔记，切换洞察探索双链关系。



https://github.com/user-attachments/assets/ab8842e2-7b6a-4f41-8885-7a860de928bb



**许可：个人非商业使用免费；商业用途需另行授权；二次开发后分发须保留原作者及来源。** 详见下方许可说明。

## 功能

- **星图**：自动识别实际根目录，每个水母对应一个目录，图例同步显示名称、颜色和笔记数量。水母优先沿椭圆围绕混沌体排列，窗口收窄时自动避让；目录很多时分组浏览。
- **分支**：固定行距的滚动列表按需显示笔记；普通连线保持淡色，选中或悬停时高亮并播放流光。查看字数、库占比、双链和正文，点击卡片右上角的快捷按钮在 Obsidian 中打开原文。
- **洞察**：显示笔记标题，拖动节点时，关联节点会随连接移动。大库支持缩放与平移，从概览放大查看标题。
- **技术内容**：区分配置、JSON、命令与路径，支持代码配色和快捷复制。
- **阅读足迹**：查看最近半年的阅读日期，悬停显示当天是否阅读。
- **搜索**：按笔记标题、标签和根目录定位笔记，并打开原笔记。

界面和知识库数据在本机运行，插件支持离线使用。阅读历史从启用插件后开始记录，保存于插件自己的数据文件；笔记正文保持原样。

## 知识库结构

作者的知识库架构参考 Andrej Karpathy 的[原始 LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)。Neural Vault 是作者独立开发的可视化浏览插件，用于查看现有知识库中的笔记与连接。

下面是作者的目录示例，使用者可以沿用自己的目录名称和数量：

```text
你的知识库/
├── 01-项目/
├── 02-资产/
├── 03-资源/
├── 04-辅助/
├── 05-灵感/
└── 06-Skills/
```

插件自动识别任意一级目录，包括空目录。子目录中的 Markdown 笔记统一归入所属根目录，二级目录不额外生成水母；直接放在知识库根目录中的笔记归入“根目录”水母。笔记标题采用 frontmatter 的 `title`、一级标题或文件名，同名笔记以完整路径区分。文件夹和笔记增删、改名后自动同步。

上述六类目录及不带数字前缀的名称保留熟悉的配色与图标；其他目录自动分配。两个实际目录即使名称属于同一类，也分别显示。

## 安装到 Obsidian

需要 **桌面版 Obsidian 1.7.2 或更新版本**。

1. 从本项目的 [Releases 页面](https://github.com/useroneoneone/neural-vault/releases/latest)下载 `neural-vault.zip`。
2. 解压，将其中的 `neural-vault` 文件夹放入知识库的 `.obsidian/plugins/`。
3. 确认插件文件直接位于以下位置，避免多套一层目录：

   ```text
   你的知识库/.obsidian/plugins/neural-vault/
   ├── main.js
   ├── manifest.json
   └── styles.css
   ```

4. 打开 Obsidian「设置 → 第三方插件」，关闭受限模式，刷新插件列表并启用 **Neural Vault**。
5. 点击左侧的网络图标，或在命令面板执行 **Neural Vault: 打开知识库水母星图**。

完整压缩包还附带 `LICENSE`、`NOTICE` 和 `THIRD_PARTY_NOTICES.txt`，请一并保留。

需要更新时，关闭插件，用新版压缩包中的文件覆盖插件目录，然后重新启用。保留已有 `data.json` 可以保留阅读历史。

## 本地开发

```sh
npm ci
npm run build:plugin
```

插件产物位于 `plugin-dist/neural-vault/`，可按上面的目录结构手动安装。

启动 Web 预览：

```sh
npm run dev
```

浏览器打开终端显示的本地地址。若要在 Web 预览中查看自己的笔记，先导入本地知识库：

```sh
npm run import:vault -- "/path/to/your-vault"
```

Web 预览导入的快照只用于本地开发；安装后的插件直接读取当前 Obsidian 知识库。详细构建和数据说明见 [插件部署文档](docs/obsidian-plugin.md)。

核验大量目录和笔记的合成预览：

```sh
npm run dev:stress
```

打开 `http://127.0.0.1:5174/`，默认展示 12 个水母、472 篇合成笔记；左下角“合成预览”可切换到 30 个目录、六类示例或空知识库。该模式独立于本地导入的快照。

## 许可与二次开发

项目作者拥有的代码和文档采用 **[PolyForm Noncommercial 1.0.0](LICENSE)**（SPDX：`PolyForm-Noncommercial-1.0.0`）。这是源码公开的非商业许可证。

- 个人学习、研究、兴趣项目等非商业使用免费，也允许非商业修改和分享；许可列明的教育、慈善等非商业机构用途按许可证原文执行。
- 商业用途须先取得作者单独的书面授权。可通过 [GitHub Issues](https://github.com/useroneoneone/neural-vault/issues)提交授权申请。
- 二次开发后对外分发，须随复制品保留 `LICENSE`（或官方许可证链接）及 [NOTICE](NOTICE) 中两条 `Required Notice:`，注明原作者 `useroneoneone` 和原始仓库地址；第三方版权与许可证声明也须保留。

二次开发项目可在 README 中写明：

> 本项目基于 [Neural Vault](https://github.com/useroneoneone/neural-vault) 二次开发，原作者为 useroneoneone；原始代码采用 PolyForm Noncommercial 1.0.0，商业用途需另行授权。

许可证完整条款以 `LICENSE` 为准。第三方依赖按各自许可证授权，插件包附 `THIRD_PARTY_NOTICES.txt`；使用者自己的知识库笔记保持其原有权属。
