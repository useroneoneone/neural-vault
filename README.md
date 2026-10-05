# Neural Vault

一个桌面版 Obsidian 插件，把知识库里的六个根目录变成水母星图。打开分支查看笔记，切换洞察探索双链关系。

https://github.com/user-attachments/assets/ac28557a-42c7-4013-b7e9-4ee91eaa94c1



## 功能

- **星图**：每个水母对应一个根目录，显示笔记数量与连接。
- **分支**：查看该目录下的笔记列表、字数、库占比、双链和正文；点击卡片右上角的快捷按钮在 Obsidian 中打开原文。
- **洞察**：显示笔记标题，拖动节点时，关联节点会随连接移动。
- **技术内容**：区分配置、JSON、命令与路径，支持代码配色和快捷复制。
- **阅读足迹**：查看最近半年的阅读日期，悬停显示当天是否阅读。
- **搜索**：按笔记标题、标签和根目录定位笔记，并打开原笔记。

界面和知识库数据在本机运行，插件支持离线使用。阅读历史从启用插件后开始记录，保存于插件自己的数据文件；笔记正文保持原样。

## 知识库结构

作者的知识库架构参考 Andrej Karpathy 的[原始 LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)。Neural Vault 是作者独立开发的可视化浏览插件，用于查看现有知识库中的笔记与连接。

```text
你的知识库/
├── 01-项目/
├── 02-资产/
├── 03-资源/
├── 04-辅助/
├── 05-灵感/
└── 06-Skills/
```

也支持不带数字前缀的目录名：`项目`、`资产`、`资源`、`辅助`、`灵感`、`skills`。子目录中的 Markdown 笔记统一归入所属根目录，二级目录不额外生成水母。

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

需要更新时，关闭插件，用新版压缩包中的文件替换上述三个文件，然后重新启用。保留已有 `data.json` 可以保留阅读历史。

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
