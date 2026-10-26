# World Clock — an Omarchy Elsewhen for the web

把 [Omarchy](https://github.com/omacom/omarchy) 4.0 "Quattro" 桌面里的世界时钟面板
**Elsewhen**（`omarchy.elsewhen`）复刻成一个纯前端 Web 应用：一座城市一行，
每行带 24 小时日照条，右上角可以点开一颗可旋转的地球。

- 参考仓库：<https://github.com/omacom/omarchy>
- 参考源码：`shell/plugins/panels/elsewhen/`（见 [docs/omarchy-reference.md](docs/omarchy-reference.md)）
- 部署目标：Cloudflare（静态资源，无后端、无 API 调用）
- 技术栈：Vite + React + TypeScript，时区计算全部走 `Intl.DateTimeFormat`

## 功能

| | |
|---|---|
| 23 套 Omarchy 主题 | 直接取自 `themes/<id>/colors.toml`，含 catppuccin-latte / white 等亮色主题 |
| 城市行 | 当地时间、日期、跨日标记（Tomorrow / Yesterday / +N days）、时区缩写、相对偏移 |
| 24 小时日照条 | 按该城市经纬度算出的日出日落点亮，金色圆点是"现在"，夜间显示月相 |
| 问候语 | 悬停行时日期换成 Elsewhen 的问候（含罗马数字与原文语言），取自 `Greetings.js` |
| 地球 | 正射投影、晨昏线、可拖动甩动、点击城市定位，标签按海陆自动反色 |
| 搜索添加 | `Intl.supportedValuesOf("timeZone")` 全量时区，中英文名均可搜 |
| 拖动排序 | 长按行拖动改顺序，结果存 localStorage |
| 响应式 | 手机全屏面板 / 折叠屏横向滚动 / iPad 浮层卡片 / 桌面双栏 |

快捷键：`T` 切换 12/24 小时，`G` 切换地球，`Esc` 逐层退出。

## 开发

```bash
npm install
npm run dev
```

```bash
npm run build
```

`npm run build` 会先跑 `tsc -b` 再打包到 `dist/`，产物约 104 kB gzip（含字体约 190 kB）。

## 部署到 Cloudflare

### 方式一：Cloudflare Pages（推荐，零配置）

在 Cloudflare Dashboard → Workers & Pages → Create → Pages → 连接 Git 仓库：

| 设置项 | 值 |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 20 或以上 |

没有客户端路由，不需要 SPA 回退规则；`public/_headers` 会被原样带进 `dist/`。

### 方式二：Workers 静态资源（命令行）

```bash
npm run deploy
```

等价于 `npm run build && npx wrangler deploy`，配置在 `wrangler.jsonc`
（`assets.directory = "./dist"`，`not_found_handling = "single-page-application"`）。
首次运行会要求 `npx wrangler login`。

## 项目结构

```
src/
  App.tsx              面板骨架：hero、列表/地球舞台、底栏、键盘、拖拽排序
  components/
    CityRow.tsx        一行城市：时间、日期/问候、日照条、移除
    DaylightStrip.tsx  24 小时日照条与月相图标
    Globe.tsx          canvas 地球：投影、晨昏线、标签、拖拽与惯性
    HeroGlobe.tsx      标题中间那颗跟着选中城市转的小地球
    CitySearch.tsx     "Add a city" 搜索
    ThemePicker.tsx    23 套主题的色板选择器
  lib/
    themes.ts          从 colors.toml 生成的调色板
    solar.ts           太阳位置、晨昏线、月相、正射投影、标签避让
    time.ts            Intl 时区运算、城市表、时区目录
    greetings.ts       Elsewhen 的分时问候
    store.ts           设置持久化、每秒时钟、媒体查询
    useTheme.ts        把主题写成 CSS 变量
  data/
    cities.json        74 座城市（Omarchy 原表）
    world.json         68 条海岸线（Omarchy 原表）
```

## 与 Elsewhen 的差异

- QML 没有 `Intl`，Elsewhen 靠外部 `date` 探针取时区偏移；这里改用
  `Intl.DateTimeFormat` 直接算，因此可以纯静态部署。
- Elsewhen 是 bar widget，只在面板打开时存在；这里是独立页面，
  多了主题切换、拖动排序、移动端布局和 12/24 小时切换。
- 去掉了天气（`units` 设置）与 IPC，只保留世界时钟本身。

## 许可

界面与配色复刻自 Omarchy，原项目为 MIT 许可，© David Heinemeier Hansson；
Elsewhen 面板作者 Jason Fried。本仓库同样以 MIT 发布，详见 [LICENSE](LICENSE)。
