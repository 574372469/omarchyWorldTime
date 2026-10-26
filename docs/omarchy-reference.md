# Omarchy 参考记录

本文记录这个项目从 Omarchy 抄了什么、抄自哪个文件，以及为什么这么做。
所有路径都相对于参考仓库 <https://github.com/omacom/omarchy>
（阅读时对应提交 `4601078a7d84ece7a3329b9a7ca6fce0a47d254f`，2026-10-26）。

## 1. 定位：世界时钟在 Omarchy 里是哪个模块

Omarchy 4.0 "Quattro" 的 shell 用 Quickshell（QML）重写，不再用 Waybar。
世界时钟是其中一个 **panel plugin**，而不是独立的 bar module：

```
shell/plugins/panels/elsewhen/
  manifest.json      id: omarchy.elsewhen, name: Elsewhen, version 1.1.0
  Panel.qml          面板本体：bar widget 入口，打开后展开
  CityRow.qml        一座城市一行
  CitySearch.qml     搜索添加城市
  DaylightStrip.qml  24 小时日照条
  Globe.qml          地球视图
  GlobeFooter.qml    地球下方的选中城市信息
  GlobeModel.js      正射投影、晨昏线、标签避让
  Sun.js             太阳位置、日出日落、月相
  Model.js           时区偏移探针、12/24 小时、种子城市
  Greetings.js       分时问候语
  HeroTitle.qml      标题 "World 🌍 Clock"
  MiniGlobe.qml      标题里那颗小地球
  MoonDot.qml        月相圆点
  ArcText.qml / Arc.js  地球上的弧形文字
  cities.json        74 座城市 [name, zone, lat, lon, rank]
  world.json         68 条海岸线多边形
```

`manifest.json` 里值得注意的默认值，本应用原样保留：

```json
"defaults": {
  "offsetMode": "home",
  "globeEnabled": true,
  "smoothMotion": true
}
```

即：行右侧显示"离你多远"（`+9h`）而不是 `UTC+9`；点标题里的地球进入地球模式；
地球移动时降级绘制（少画经纬线、隐藏标签）。

## 2. 视觉：主题从哪来

### 调色板

```
themes/<id>/colors.toml
```

23 套主题：`catppuccin`、`catppuccin-latte`、`ethereal`、`everforest`、`flexoki-light`、
`gruvbox`、`hackerman`、`jade-horse`、`kanagawa`、`last-horizon`、`lumon`、`lupine`、
`matte-black`、`miasma`、`nord`、`retro-82`、`ristretto`、`rose-pine`、`solitude`、
`starship`、`tokyo-night`、`vantablack`、`white`。

每个文件是一组平铺的十六进制值，本项目的 `src/lib/themes.ts` 是这些文件的直接映射：

```toml
mode = "dark"                # → Theme.mode（决定 color-scheme 与 meta theme-color）
accent = "#7aa2f7"           # → 卡片边框、焦点、地球上的 home 点
background = "#1a1b26"       # → 面板底色；行底色由它与 foreground 混合而来
dark_background = "#13141c"  # → 页面底色（面板浮在上面）
darker_background = "#0e0e14"
lighter_background = "#24283b"
foreground = "#a9b1d6"       # → 正文
bright_foreground = "#c0caf5"
red / yellow / green / cyan / blue / magenta / ...
```

默认主题 `tokyo-night`，与 Omarchy 默认一致。

### 尺寸与间距

```
default/themed/shell.toml.tpl
```

这是模板，Omarchy 在主题切换时用它生成 `~/.config/omarchy/current/shell.toml`。
本项目取其中两组：

```toml
[font]
base-size = 12
# caption 10 / body-small 11 / body 12 / subtitle 13 / title 14
# heading 16 / display 24 / display-large 28

[spacing]
# xxs 2 / xs 3 / sm 4 / md 6 / lg 8 / xl 10 / xxl 12 / xxxl 14 / huge 18
# row-padding-x 12 / panel-gap 14 / panel-padding 18 / popup-padding 14
```

对应 `src/index.css` 顶部的 `--fs-*` 与 `--sp-*` 变量。字号不做 `clamp()` 缩放，
保持 Omarchy 那种偏小、偏密的排版；移动端只靠间距和列数适配。

### 形状

```
default/hypr/looknfeel.lua
```

```lua
general = {
  gaps_in = 5,
  gaps_out = 10,          -- → 面板外边距 5px（popup 取一半）
  border_size = 2,
  col = {
    active_border = { colors = { "rgba(33ccffee)", "rgba(00ff99ee)" }, angle = 45 },
    inactive_border = "rgba(595959aa)",
  },
},
decoration = { rounding = 0 },
```

所以一切都是直角。卡片边框取主题 `accent` 的 60% 透明版本
（`color-mix(in oklab, var(--accent) 60%, transparent)`），模仿 Hyprland 的活动边框。

`ThemePicker` 里的 "Rounded corners" 开关对应 Omarchy 的
`default/hypr/toggles/corners-rounded.lua`：

```lua
decoration = { rounding = 6, rounding_power = 3 }
```

打开后统一变成 6px，与 Omarchy 该开关的取值一致。

### 动效

```
shell/Commons/Style.qml
```

- 缓动曲线 `cubic-bezier(0.23, 1, 0.32, 1)`（ease-out）
- 面板弹出 180ms，收起 120ms，`scale 0.97 → 1`，同时淡入
- 行底色、悬停切换用 110–130ms

对应 `src/index.css` 的 `--ease-out` 与 `@keyframes card-in`。
`prefers-reduced-motion` 下全部压到 1ms。

### 行的底色

`CityRow.qml` 不用固定色，而是把 `foreground` 按时间段混到 `background` 上：

| 时段 | 混合比例 |
|---|---|
| 白天 | 0.10 |
| 清晨 / 黄昏 | 0.07 |
| 夜间 | 0.035 |
| 选中 | 0.15 |

于是每一行的明暗都在讲那座城市现在是几点。本项目的
`src/components/CityRow.tsx` 里是 `PHASE_FILL`。

日照条本身：轨道 `foreground` 10%，点亮段 28%，"现在"是 `#E5C736` 的金点
（夜间换成月相）。这个金色不来自主题，是 Elsewhen 自己写死的日光色。

## 3. 代码移植

| Elsewhen | 本项目 | 说明 |
|---|---|---|
| `GlobeModel.js` | `src/lib/solar.ts` | 正射投影、晨昏线、可见段裁剪、标签布局与避让、最短转角 |
| `Sun.js` | `src/lib/solar.ts` | 太阳赤纬与均时差、日出日落（地平线 −0.833°）、月相、极昼极夜 |
| `Greetings.js` | `src/lib/greetings.ts` | 分时问候与罗马数字，仅保留 `greeting(zone, hour)` |
| `Model.js` | `src/lib/time.ts` | 时区偏移与 12/24 小时；种子城市逻辑 |
| `cities.json` | `src/data/cities.json` | 原样复制，74 条 |
| `world.json` | `src/data/world.json` | 原样复制，68 条海岸线 |
| `DaylightStrip.qml` | `DaylightStrip.tsx` | 结构照搬，改用 DOM |
| `Globe.qml` | `Globe.tsx` | 结构照搬，改用 canvas 2D |

移植时唯一实质性的改动是时区：QML 没有 `Intl`，Elsewhen 跑一个 `date` 子进程拿每个
时区的偏移，并且每五分钟重跑一次以跟上夏令时。浏览器里
`Intl.DateTimeFormat(zone).formatToParts()` 直接给出当地时间，因此
`src/lib/time.ts` 全部基于它 —— 这也是整个应用能纯静态部署的原因。

日期语言固定为 `en-US`：Omarchy 的 shell 界面是英文，中文环境下
`Intl` 会渲染成"10月26日周一"，与面板其它英文文案（Tomorrow、home、tracked）打架。
12/24 小时制仍然跟随浏览器 `navigator.language`。

## 4. 未移植的部分

- 天气（`units` 设置、F/C）：需要外部 API，与"纯静态"目标冲突。
- IPC 与 bar widget 生命周期：Web 应用没有 bar。
- 弧形文字（`ArcText.qml` / `Arc.js`）：地球标签改用平面避让布局，小尺寸下更清楚。
- 多显示器 / Hyprland 的窗口规则：与浏览器无关。

## 5. 许可

Omarchy 为 MIT 许可：

```
Copyright (c) David Heinemeier Hansson
```

Elsewhen 面板在 `manifest.json` 中标注 `"author": "Jason Fried"`, `"license": "MIT"`。
本项目的 `src/data/cities.json`、`src/data/world.json` 与
`src/lib/themes.ts` 中的调色板数据均来自上述 MIT 源码，
`LICENSE` 中保留了原始版权声明。
