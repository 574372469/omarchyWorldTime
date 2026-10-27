# World Clock

[English](README.md) | **简体中文**

这是一个网页版本的 **Elsewhen**——内置于 [Omarchy](https://github.com/omacom/omarchy) 的世界时钟面板。每座城市单独显示一行当地时间和 24 小时日照条，也可以查看并旋转地球。

- 参考项目：[Omarchy](https://github.com/omacom/omarchy)，主要参考 `shell/plugins/panels/elsewhen/`。更多信息见[参考记录](docs/omarchy-reference.md)（英文）。
- 技术栈：Vite、React 和 TypeScript。时区计算使用 `Intl.DateTimeFormat`。
- 部署方式：Cloudflare Pages 或 Cloudflare Workers 静态资源。应用是纯静态前端，没有后端或 API 调用。

## 开发缘由

我最近开始使用 Omarchy Linux，很欣赏它的设计风格。一次偶然的机会，我发现了它内置的 Elsewhen 世界时钟，觉得它对从事外贸以及需要跨时区工作和沟通的人尤其有用。我把它复刻成网页，希望没有使用 Omarchy 的人也能体验类似的功能和感受。我选择 Web，是因为不用等待应用商店审核，也不需要下载，打开就能用。希望你喜欢。

## 功能

| 功能 | 说明 |
|---|---|
| 城市列表 | 显示当地时间、日期、跨日标记、时区缩写和时差。首次使用时默认显示本地时区、纽约（美国）、伦敦（英国）、迪拜（阿联酋）和悉尼（澳大利亚）；若本地时区与其中一座城市相同，会自动去重。已自定义的城市列表会保留。本地城市固定在列表顶部，不能移除。 |
| 日照条 | 显示各城市的日出日落、当前时间标记，以及夜间月相。 |
| 问候语 | 显示 Elsewhen 的分时问候，并在有内容时显示罗马字转写。 |
| 地球 | 可旋转的地球，显示晨昏线和可选城市标签。地球与拖动柄之外的区域保留页面双指缩放。 |
| 搜索 | 通过城市名或时区搜索并添加城市。 |
| 排序与触控 | 使用专用拖动手柄调整城市顺序。列表支持触控滚动，拖动控件时不会选中文字。 |
| 界面语言 | 默认根据浏览器语言显示；也可手动选择 English、简体中文、繁體中文、日本語、한국어、Français、Deutsch、Español、Português、Русский、Italiano 或 Nederlands。 |
| 主题 | 可选 23 套 Omarchy 主题，包括亮色主题，也可以开启圆角。 |
| 偏好设置 | 城市列表、主题、语言和时钟设置会保存在浏览器的 localStorage 中。 |
| 屏幕适配 | 适配手机、平板和桌面屏幕。 |

快捷键：按 `T` 切换 12/24 小时制，按 `G` 显示或隐藏地球，按 `Esc` 返回上一层。

## 开发

需要 Node.js `^20.19.0` 或 `>=22.12.0`（Vite 8 的版本要求）。

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

构建生产版本到 `dist/`（先运行 `tsc -b`，再由 Vite 打包）：

```bash
npm run build
```

## 部署

### Cloudflare Pages

在 Cloudflare Dashboard → Workers & Pages → Create → Pages 中连接仓库，并使用以下设置：

| 设置项 | 值 |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js | `^20.19.0` 或 `>=22.12.0` |

应用没有客户端路由。`public/_headers` 会复制到构建产物中。

### Cloudflare Workers 静态资源

`deploy` 脚本会先构建应用，再根据 `wrangler.jsonc` 中的配置运行 Wrangler（`assets.directory` 为 `./dist`）。在命令行部署：

```bash
npm run deploy
```

如果 Wrangler 提示登录，请运行：

```bash
npx wrangler login
```

## 项目结构

- `src/App.tsx` — 应用布局、城市列表、地球视图、设置栏和快捷键。
- `src/components/` — 城市行、日照条、地球、城市搜索、主题选择器和标题小地球。
- `src/lib/` — 时区与日照计算、问候语、翻译、城市名、主题和设置存储。
- `src/data/` — 内置城市与世界海岸线数据。
- `public/_headers` — 静态部署使用的响应头配置。

## 与 Elsewhen 的差异

Elsewhen 作为 Omarchy 面板运行，并通过系统 `date` 进程读取时区偏移。本网页版本使用 `Intl.DateTimeFormat`，因此可以作为静态网站运行。此外还加入了主题和语言选择、城市排序、响应式布局以及 12/24 小时制控制；没有移植天气设置和桌面 IPC。

## 致谢与许可

本项目以 MIT 许可发布，详见 [LICENSE](LICENSE)。项目中的部分城市与海岸线数据、主题配色和移植逻辑基于 [Omarchy](https://github.com/omacom/omarchy)，版权归 David Heinemeier Hansson 所有；Elsewhen 面板作者为 Jason Fried。更多信息见[参考记录](docs/omarchy-reference.md)（英文）。
