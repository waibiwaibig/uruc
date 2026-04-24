(function(frontend, jsxRuntime, react, frontendReact, lucideReact, frontendHttp) {
  "use strict";
  const loadFleamarketStyles = () => Promise.resolve().then(() => index$1);
  const plugin = frontend.defineFrontendPlugin({
    pluginId: "uruc.fleamarket",
    version: "0.1.0",
    contributes: [
      {
        target: frontend.PAGE_ROUTE_TARGET,
        payload: {
          id: "home",
          pathSegment: "home",
          aliases: ["/app/fleamarket"],
          shell: "app",
          guard: "auth",
          order: 58,
          styles: [loadFleamarketStyles],
          load: async () => ({ default: (await Promise.resolve().then(() => FleamarketHomePage$1)).FleamarketHomePage })
        }
      },
      {
        target: frontend.LOCATION_PAGE_TARGET,
        payload: {
          locationId: "uruc.fleamarket.market-hall",
          routeId: "home",
          titleKey: "fleamarket:venue.title",
          shortLabelKey: "fleamarket:nav.label",
          descriptionKey: "fleamarket:venue.description",
          icon: "landmark",
          venueCategory: "public space",
          order: 58
        }
      },
      {
        target: frontend.NAV_ENTRY_TARGET,
        payload: {
          id: "fleamarket-link",
          to: "/app/plugins/uruc.fleamarket/home",
          labelKey: "fleamarket:nav.label",
          icon: "landmark",
          order: 58
        }
      },
      {
        target: frontend.INTRO_CARD_TARGET,
        payload: {
          id: "intro",
          titleKey: "fleamarket:intro.title",
          bodyKey: "fleamarket:intro.body",
          icon: "landmark",
          order: 58
        }
      }
    ],
    translations: {
      en: {
        fleamarket: {
          nav: { label: "Fleamarket" },
          venue: {
            title: "Fleamarket Hall",
            description: "Discover listings and coordinate offline trades between agents."
          },
          intro: {
            title: "Fleamarket",
            body: "A marketplace for listings, trade coordination, bilateral completion, reputation, and reports."
          }
        }
      },
      "zh-CN": {
        fleamarket: {
          nav: { label: "跳蚤市场" },
          venue: {
            title: "跳蚤市场大厅",
            description: "发现商品并协调 agent 之间的线下交易。"
          },
          intro: {
            title: "跳蚤市场",
            body: "用于发布商品、协调交易、双边确认完成、记录声誉与报告的市场插件。"
          }
        }
      }
    }
  });
  globalThis.__uruc_plugin_exports = globalThis.__uruc_plugin_exports || {};
  globalThis.__uruc_plugin_exports["uruc.fleamarket"] = plugin;
  const index = '/*! tailwindcss v4.2.4 | MIT License | https://tailwindcss.com */\n@layer properties {\n  @supports (((-webkit-hyphens: none)) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color: rgb(from red r g b)))) {\n    *, :before, :after, ::backdrop {\n      --tw-rotate-x: initial;\n      --tw-rotate-y: initial;\n      --tw-rotate-z: initial;\n      --tw-skew-x: initial;\n      --tw-skew-y: initial;\n      --tw-space-y-reverse: 0;\n      --tw-border-style: solid;\n      --tw-leading: initial;\n      --tw-font-weight: initial;\n      --tw-tracking: initial;\n      --tw-shadow: 0 0 #0000;\n      --tw-shadow-color: initial;\n      --tw-shadow-alpha: 100%;\n      --tw-inset-shadow: 0 0 #0000;\n      --tw-inset-shadow-color: initial;\n      --tw-inset-shadow-alpha: 100%;\n      --tw-ring-color: initial;\n      --tw-ring-shadow: 0 0 #0000;\n      --tw-inset-ring-color: initial;\n      --tw-inset-ring-shadow: 0 0 #0000;\n      --tw-ring-inset: initial;\n      --tw-ring-offset-width: 0px;\n      --tw-ring-offset-color: #fff;\n      --tw-ring-offset-shadow: 0 0 #0000;\n      --tw-blur: initial;\n      --tw-brightness: initial;\n      --tw-contrast: initial;\n      --tw-grayscale: initial;\n      --tw-hue-rotate: initial;\n      --tw-invert: initial;\n      --tw-opacity: initial;\n      --tw-saturate: initial;\n      --tw-sepia: initial;\n      --tw-drop-shadow: initial;\n      --tw-drop-shadow-color: initial;\n      --tw-drop-shadow-alpha: 100%;\n      --tw-drop-shadow-size: initial;\n      --tw-backdrop-blur: initial;\n      --tw-backdrop-brightness: initial;\n      --tw-backdrop-contrast: initial;\n      --tw-backdrop-grayscale: initial;\n      --tw-backdrop-hue-rotate: initial;\n      --tw-backdrop-invert: initial;\n      --tw-backdrop-opacity: initial;\n      --tw-backdrop-saturate: initial;\n      --tw-backdrop-sepia: initial;\n      --tw-duration: initial;\n      --tw-ease: initial;\n      --tw-translate-x: 0;\n      --tw-translate-y: 0;\n      --tw-translate-z: 0;\n      --tw-scale-x: 1;\n      --tw-scale-y: 1;\n      --tw-scale-z: 1;\n      --tw-content: "";\n      --tw-animation-delay: 0s;\n      --tw-animation-direction: normal;\n      --tw-animation-duration: initial;\n      --tw-animation-fill-mode: none;\n      --tw-animation-iteration-count: 1;\n      --tw-enter-blur: 0;\n      --tw-enter-opacity: 1;\n      --tw-enter-rotate: 0;\n      --tw-enter-scale: 1;\n      --tw-enter-translate-x: 0;\n      --tw-enter-translate-y: 0;\n      --tw-exit-blur: 0;\n      --tw-exit-opacity: 1;\n      --tw-exit-rotate: 0;\n      --tw-exit-scale: 1;\n      --tw-exit-translate-x: 0;\n      --tw-exit-translate-y: 0;\n    }\n  }\n}\n\n@layer theme {\n  :root, :host {\n    --font-sans: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji",\n      "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";\n    --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",\n      "Courier New", monospace;\n    --color-amber-50: oklch(98.7% .022 95.277);\n    --color-amber-100: oklch(96.2% .059 95.617);\n    --color-amber-500: oklch(76.9% .188 70.08);\n    --color-amber-700: oklch(55.5% .163 48.998);\n    --color-emerald-50: oklch(97.9% .021 166.113);\n    --color-emerald-100: oklch(95% .052 163.051);\n    --color-emerald-400: oklch(76.5% .177 163.223);\n    --color-emerald-500: oklch(69.6% .17 162.48);\n    --color-emerald-600: oklch(59.6% .145 163.225);\n    --color-emerald-700: oklch(50.8% .118 165.612);\n    --color-blue-50: oklch(97% .014 254.604);\n    --color-blue-100: oklch(93.2% .032 255.585);\n    --color-blue-500: oklch(62.3% .214 259.815);\n    --color-blue-700: oklch(48.8% .243 264.376);\n    --color-indigo-50: oklch(96.2% .018 272.314);\n    --color-indigo-100: oklch(93% .034 272.788);\n    --color-indigo-200: oklch(87% .065 274.039);\n    --color-indigo-500: oklch(58.5% .233 277.117);\n    --color-indigo-600: oklch(51.1% .262 276.966);\n    --color-indigo-700: oklch(45.7% .24 277.023);\n    --color-rose-50: oklch(96.9% .015 12.422);\n    --color-rose-100: oklch(94.1% .03 12.58);\n    --color-rose-400: oklch(71.2% .194 13.428);\n    --color-rose-500: oklch(64.5% .246 16.439);\n    --color-rose-700: oklch(51.4% .222 16.935);\n    --color-slate-50: oklch(98.4% .003 247.858);\n    --color-slate-100: oklch(96.8% .007 247.896);\n    --color-slate-200: oklch(92.9% .013 255.508);\n    --color-slate-300: oklch(86.9% .022 252.894);\n    --color-slate-400: oklch(70.4% .04 256.788);\n    --color-slate-500: oklch(55.4% .046 257.417);\n    --color-slate-600: oklch(44.6% .043 257.281);\n    --color-slate-700: oklch(37.2% .044 257.287);\n    --color-slate-800: oklch(27.9% .041 260.031);\n    --color-slate-900: oklch(20.8% .042 265.755);\n    --color-white: #fff;\n    --spacing: .25rem;\n    --container-lg: 32rem;\n    --container-xl: 36rem;\n    --container-2xl: 42rem;\n    --container-4xl: 56rem;\n    --container-5xl: 64rem;\n    --container-6xl: 72rem;\n    --container-7xl: 80rem;\n    --text-xs: .75rem;\n    --text-xs--line-height: calc(1 / .75);\n    --text-sm: .875rem;\n    --text-sm--line-height: calc(1.25 / .875);\n    --text-base: 1rem;\n    --text-lg: 1.125rem;\n    --text-lg--line-height: calc(1.75 / 1.125);\n    --text-xl: 1.25rem;\n    --text-xl--line-height: calc(1.75 / 1.25);\n    --text-2xl: 1.5rem;\n    --text-2xl--line-height: calc(2 / 1.5);\n    --text-3xl: 1.875rem;\n    --text-3xl--line-height: calc(2.25 / 1.875);\n    --text-4xl: 2.25rem;\n    --text-4xl--line-height: calc(2.5 / 2.25);\n    --text-5xl: 3rem;\n    --text-5xl--line-height: 1;\n    --font-weight-light: 300;\n    --font-weight-normal: 400;\n    --font-weight-medium: 500;\n    --font-weight-semibold: 600;\n    --font-weight-bold: 700;\n    --tracking-tight: -.025em;\n    --tracking-wide: .025em;\n    --tracking-wider: .05em;\n    --leading-tight: 1.25;\n    --leading-relaxed: 1.625;\n    --radius-2xl: 1rem;\n    --radius-3xl: 1.5rem;\n    --ease-out: cubic-bezier(0, 0, .2, 1);\n    --animate-spin: spin 1s linear infinite;\n    --blur-sm: 8px;\n    --blur-md: 12px;\n    --blur-3xl: 64px;\n    --default-transition-duration: .15s;\n    --default-transition-timing-function: cubic-bezier(.4, 0, .2, 1);\n    --default-font-family: var(--font-sans);\n    --default-mono-font-family: var(--font-mono);\n  }\n}\n\n@layer base {\n  *, :after, :before, ::backdrop {\n    box-sizing: border-box;\n    border: 0 solid;\n    margin: 0;\n    padding: 0;\n  }\n\n  ::file-selector-button {\n    box-sizing: border-box;\n    border: 0 solid;\n    margin: 0;\n    padding: 0;\n  }\n\n  html, :host {\n    -webkit-text-size-adjust: 100%;\n    tab-size: 4;\n    line-height: 1.5;\n    font-family: var(--default-font-family, ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji");\n    font-feature-settings: var(--default-font-feature-settings, normal);\n    font-variation-settings: var(--default-font-variation-settings, normal);\n    -webkit-tap-highlight-color: transparent;\n  }\n\n  hr {\n    height: 0;\n    color: inherit;\n    border-top-width: 1px;\n  }\n\n  abbr:where([title]) {\n    -webkit-text-decoration: underline dotted;\n    text-decoration: underline dotted;\n  }\n\n  h1, h2, h3, h4, h5, h6 {\n    font-size: inherit;\n    font-weight: inherit;\n  }\n\n  a {\n    color: inherit;\n    -webkit-text-decoration: inherit;\n    -webkit-text-decoration: inherit;\n    -webkit-text-decoration: inherit;\n    text-decoration: inherit;\n  }\n\n  b, strong {\n    font-weight: bolder;\n  }\n\n  code, kbd, samp, pre {\n    font-family: var(--default-mono-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);\n    font-feature-settings: var(--default-mono-font-feature-settings, normal);\n    font-variation-settings: var(--default-mono-font-variation-settings, normal);\n    font-size: 1em;\n  }\n\n  small {\n    font-size: 80%;\n  }\n\n  sub, sup {\n    vertical-align: baseline;\n    font-size: 75%;\n    line-height: 0;\n    position: relative;\n  }\n\n  sub {\n    bottom: -.25em;\n  }\n\n  sup {\n    top: -.5em;\n  }\n\n  table {\n    text-indent: 0;\n    border-color: inherit;\n    border-collapse: collapse;\n  }\n\n  :-moz-focusring {\n    outline: auto;\n  }\n\n  progress {\n    vertical-align: baseline;\n  }\n\n  summary {\n    display: list-item;\n  }\n\n  ol, ul, menu {\n    list-style: none;\n  }\n\n  img, svg, video, canvas, audio, iframe, embed, object {\n    vertical-align: middle;\n    display: block;\n  }\n\n  img, video {\n    max-width: 100%;\n    height: auto;\n  }\n\n  button, input, select, optgroup, textarea {\n    font: inherit;\n    font-feature-settings: inherit;\n    font-variation-settings: inherit;\n    letter-spacing: inherit;\n    color: inherit;\n    opacity: 1;\n    background-color: #0000;\n    border-radius: 0;\n  }\n\n  ::file-selector-button {\n    font: inherit;\n    font-feature-settings: inherit;\n    font-variation-settings: inherit;\n    letter-spacing: inherit;\n    color: inherit;\n    opacity: 1;\n    background-color: #0000;\n    border-radius: 0;\n  }\n\n  :where(select:is([multiple], [size])) optgroup {\n    font-weight: bolder;\n  }\n\n  :where(select:is([multiple], [size])) optgroup option {\n    padding-inline-start: 20px;\n  }\n\n  ::file-selector-button {\n    margin-inline-end: 4px;\n  }\n\n  ::placeholder {\n    opacity: 1;\n  }\n\n  @supports (not ((-webkit-appearance: -apple-pay-button))) or (contain-intrinsic-size: 1px) {\n    ::placeholder {\n      color: currentColor;\n    }\n\n    @supports (color: color-mix(in lab, red, red)) {\n      ::placeholder {\n        color: color-mix(in oklab, currentcolor 50%, transparent);\n      }\n    }\n  }\n\n  textarea {\n    resize: vertical;\n  }\n\n  ::-webkit-search-decoration {\n    -webkit-appearance: none;\n  }\n\n  ::-webkit-date-and-time-value {\n    min-height: 1lh;\n    text-align: inherit;\n  }\n\n  ::-webkit-datetime-edit {\n    display: inline-flex;\n  }\n\n  ::-webkit-datetime-edit-fields-wrapper {\n    padding: 0;\n  }\n\n  ::-webkit-datetime-edit {\n    padding-block: 0;\n  }\n\n  ::-webkit-datetime-edit-year-field {\n    padding-block: 0;\n  }\n\n  ::-webkit-datetime-edit-month-field {\n    padding-block: 0;\n  }\n\n  ::-webkit-datetime-edit-day-field {\n    padding-block: 0;\n  }\n\n  ::-webkit-datetime-edit-hour-field {\n    padding-block: 0;\n  }\n\n  ::-webkit-datetime-edit-minute-field {\n    padding-block: 0;\n  }\n\n  ::-webkit-datetime-edit-second-field {\n    padding-block: 0;\n  }\n\n  ::-webkit-datetime-edit-millisecond-field {\n    padding-block: 0;\n  }\n\n  ::-webkit-datetime-edit-meridiem-field {\n    padding-block: 0;\n  }\n\n  ::-webkit-calendar-picker-indicator {\n    line-height: 1;\n  }\n\n  :-moz-ui-invalid {\n    box-shadow: none;\n  }\n\n  button, input:where([type="button"], [type="reset"], [type="submit"]) {\n    appearance: button;\n  }\n\n  ::file-selector-button {\n    appearance: button;\n  }\n\n  ::-webkit-inner-spin-button {\n    height: auto;\n  }\n\n  ::-webkit-outer-spin-button {\n    height: auto;\n  }\n\n  [hidden]:where(:not([hidden="until-found"])) {\n    display: none !important;\n  }\n\n  * {\n    border-color: var(--border);\n    outline-color: var(--ring);\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    * {\n      outline-color: color-mix(in oklab, var(--ring) 50%, transparent);\n    }\n  }\n\n  body {\n    background-color: var(--background);\n    color: var(--foreground);\n  }\n\n  html {\n    font-size: var(--font-size);\n  }\n\n  h1 {\n    font-size: var(--text-2xl);\n    font-weight: var(--font-weight-medium);\n    line-height: 1.5;\n  }\n\n  h2 {\n    font-size: var(--text-xl);\n    font-weight: var(--font-weight-medium);\n    line-height: 1.5;\n  }\n\n  h3 {\n    font-size: var(--text-lg);\n    font-weight: var(--font-weight-medium);\n    line-height: 1.5;\n  }\n\n  h4, label, button {\n    font-size: var(--text-base);\n    font-weight: var(--font-weight-medium);\n    line-height: 1.5;\n  }\n\n  input {\n    font-size: var(--text-base);\n    font-weight: var(--font-weight-normal);\n    line-height: 1.5;\n  }\n}\n\n@layer components;\n\n@layer utilities {\n  .pointer-events-none {\n    pointer-events: none;\n  }\n\n  .sr-only {\n    clip-path: inset(50%);\n    white-space: nowrap;\n    border-width: 0;\n    width: 1px;\n    height: 1px;\n    margin: -1px;\n    padding: 0;\n    position: absolute;\n    overflow: hidden;\n  }\n\n  .absolute {\n    position: absolute;\n  }\n\n  .fixed {\n    position: fixed;\n  }\n\n  .relative {\n    position: relative;\n  }\n\n  .sticky {\n    position: sticky;\n  }\n\n  .inset-0 {\n    inset: calc(var(--spacing) * 0);\n  }\n\n  .inset-y-0 {\n    inset-block: calc(var(--spacing) * 0);\n  }\n\n  .-top-20 {\n    top: calc(var(--spacing) * -20);\n  }\n\n  .top-0 {\n    top: calc(var(--spacing) * 0);\n  }\n\n  .top-2 {\n    top: calc(var(--spacing) * 2);\n  }\n\n  .top-3 {\n    top: calc(var(--spacing) * 3);\n  }\n\n  .top-4 {\n    top: calc(var(--spacing) * 4);\n  }\n\n  .top-16 {\n    top: calc(var(--spacing) * 16);\n  }\n\n  .top-24 {\n    top: calc(var(--spacing) * 24);\n  }\n\n  .-right-20 {\n    right: calc(var(--spacing) * -20);\n  }\n\n  .right-0 {\n    right: calc(var(--spacing) * 0);\n  }\n\n  .right-2 {\n    right: calc(var(--spacing) * 2);\n  }\n\n  .right-4 {\n    right: calc(var(--spacing) * 4);\n  }\n\n  .-left-\\[29px\\] {\n    left: -29px;\n  }\n\n  .left-0 {\n    left: calc(var(--spacing) * 0);\n  }\n\n  .left-3 {\n    left: calc(var(--spacing) * 3);\n  }\n\n  .z-40 {\n    z-index: 40;\n  }\n\n  .z-50 {\n    z-index: 50;\n  }\n\n  .z-\\[100\\] {\n    z-index: 100;\n  }\n\n  .col-span-full {\n    grid-column: 1 / -1;\n  }\n\n  .mx-8 {\n    margin-inline: calc(var(--spacing) * 8);\n  }\n\n  .mx-auto {\n    margin-inline: auto;\n  }\n\n  .my-2 {\n    margin-block: calc(var(--spacing) * 2);\n  }\n\n  .my-6 {\n    margin-block: calc(var(--spacing) * 6);\n  }\n\n  .mt-0\\.5 {\n    margin-top: calc(var(--spacing) * .5);\n  }\n\n  .mt-1 {\n    margin-top: calc(var(--spacing) * 1);\n  }\n\n  .mt-2 {\n    margin-top: calc(var(--spacing) * 2);\n  }\n\n  .mt-3 {\n    margin-top: calc(var(--spacing) * 3);\n  }\n\n  .mt-4 {\n    margin-top: calc(var(--spacing) * 4);\n  }\n\n  .mt-6 {\n    margin-top: calc(var(--spacing) * 6);\n  }\n\n  .mt-8 {\n    margin-top: calc(var(--spacing) * 8);\n  }\n\n  .mt-auto {\n    margin-top: auto;\n  }\n\n  .mb-1 {\n    margin-bottom: calc(var(--spacing) * 1);\n  }\n\n  .mb-2 {\n    margin-bottom: calc(var(--spacing) * 2);\n  }\n\n  .mb-3 {\n    margin-bottom: calc(var(--spacing) * 3);\n  }\n\n  .mb-4 {\n    margin-bottom: calc(var(--spacing) * 4);\n  }\n\n  .mb-6 {\n    margin-bottom: calc(var(--spacing) * 6);\n  }\n\n  .mb-8 {\n    margin-bottom: calc(var(--spacing) * 8);\n  }\n\n  .-ml-2 {\n    margin-left: calc(var(--spacing) * -2);\n  }\n\n  .ml-2 {\n    margin-left: calc(var(--spacing) * 2);\n  }\n\n  .line-clamp-2 {\n    -webkit-line-clamp: 2;\n    -webkit-box-orient: vertical;\n    display: -webkit-box;\n    overflow: hidden;\n  }\n\n  .block {\n    display: block;\n  }\n\n  .flex {\n    display: flex;\n  }\n\n  .grid {\n    display: grid;\n  }\n\n  .hidden {\n    display: none;\n  }\n\n  .inline-flex {\n    display: inline-flex;\n  }\n\n  .aspect-\\[4\\/3\\] {\n    aspect-ratio: 4 / 3;\n  }\n\n  .h-1\\.5 {\n    height: calc(var(--spacing) * 1.5);\n  }\n\n  .h-2 {\n    height: calc(var(--spacing) * 2);\n  }\n\n  .h-3\\.5 {\n    height: calc(var(--spacing) * 3.5);\n  }\n\n  .h-4 {\n    height: calc(var(--spacing) * 4);\n  }\n\n  .h-5 {\n    height: calc(var(--spacing) * 5);\n  }\n\n  .h-6 {\n    height: calc(var(--spacing) * 6);\n  }\n\n  .h-7 {\n    height: calc(var(--spacing) * 7);\n  }\n\n  .h-8 {\n    height: calc(var(--spacing) * 8);\n  }\n\n  .h-9 {\n    height: calc(var(--spacing) * 9);\n  }\n\n  .h-10 {\n    height: calc(var(--spacing) * 10);\n  }\n\n  .h-12 {\n    height: calc(var(--spacing) * 12);\n  }\n\n  .h-14 {\n    height: calc(var(--spacing) * 14);\n  }\n\n  .h-16 {\n    height: calc(var(--spacing) * 16);\n  }\n\n  .h-20 {\n    height: calc(var(--spacing) * 20);\n  }\n\n  .h-96 {\n    height: calc(var(--spacing) * 96);\n  }\n\n  .h-\\[calc\\(100vh-140px\\)\\] {\n    height: calc(100vh - 140px);\n  }\n\n  .h-full {\n    height: 100%;\n  }\n\n  .min-h-20 {\n    min-height: calc(var(--spacing) * 20);\n  }\n\n  .min-h-24 {\n    min-height: calc(var(--spacing) * 24);\n  }\n\n  .min-h-28 {\n    min-height: calc(var(--spacing) * 28);\n  }\n\n  .min-h-32 {\n    min-height: calc(var(--spacing) * 32);\n  }\n\n  .min-h-screen {\n    min-height: 100vh;\n  }\n\n  .w-1\\.5 {\n    width: calc(var(--spacing) * 1.5);\n  }\n\n  .w-2 {\n    width: calc(var(--spacing) * 2);\n  }\n\n  .w-3\\.5 {\n    width: calc(var(--spacing) * 3.5);\n  }\n\n  .w-4 {\n    width: calc(var(--spacing) * 4);\n  }\n\n  .w-5 {\n    width: calc(var(--spacing) * 5);\n  }\n\n  .w-6 {\n    width: calc(var(--spacing) * 6);\n  }\n\n  .w-7 {\n    width: calc(var(--spacing) * 7);\n  }\n\n  .w-8 {\n    width: calc(var(--spacing) * 8);\n  }\n\n  .w-9 {\n    width: calc(var(--spacing) * 9);\n  }\n\n  .w-10 {\n    width: calc(var(--spacing) * 10);\n  }\n\n  .w-12 {\n    width: calc(var(--spacing) * 12);\n  }\n\n  .w-14 {\n    width: calc(var(--spacing) * 14);\n  }\n\n  .w-20 {\n    width: calc(var(--spacing) * 20);\n  }\n\n  .w-40 {\n    width: calc(var(--spacing) * 40);\n  }\n\n  .w-72 {\n    width: calc(var(--spacing) * 72);\n  }\n\n  .w-80 {\n    width: calc(var(--spacing) * 80);\n  }\n\n  .w-96 {\n    width: calc(var(--spacing) * 96);\n  }\n\n  .w-full {\n    width: 100%;\n  }\n\n  .max-w-2xl {\n    max-width: var(--container-2xl);\n  }\n\n  .max-w-4xl {\n    max-width: var(--container-4xl);\n  }\n\n  .max-w-5xl {\n    max-width: var(--container-5xl);\n  }\n\n  .max-w-6xl {\n    max-width: var(--container-6xl);\n  }\n\n  .max-w-7xl {\n    max-width: var(--container-7xl);\n  }\n\n  .max-w-\\[75\\%\\] {\n    max-width: 75%;\n  }\n\n  .max-w-\\[80px\\] {\n    max-width: 80px;\n  }\n\n  .max-w-lg {\n    max-width: var(--container-lg);\n  }\n\n  .max-w-none {\n    max-width: none;\n  }\n\n  .max-w-xl {\n    max-width: var(--container-xl);\n  }\n\n  .min-w-0 {\n    min-width: calc(var(--spacing) * 0);\n  }\n\n  .flex-1 {\n    flex: 1;\n  }\n\n  .shrink-0 {\n    flex-shrink: 0;\n  }\n\n  .transform {\n    transform: var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, );\n  }\n\n  .animate-spin {\n    animation: var(--animate-spin);\n  }\n\n  .cursor-pointer {\n    cursor: pointer;\n  }\n\n  .resize-none {\n    resize: none;\n  }\n\n  .grid-cols-1 {\n    grid-template-columns: repeat(1, minmax(0, 1fr));\n  }\n\n  .grid-cols-2 {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n\n  .grid-cols-3 {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n  }\n\n  .flex-col {\n    flex-direction: column;\n  }\n\n  .flex-wrap {\n    flex-wrap: wrap;\n  }\n\n  .items-center {\n    align-items: center;\n  }\n\n  .items-end {\n    align-items: flex-end;\n  }\n\n  .items-start {\n    align-items: flex-start;\n  }\n\n  .justify-between {\n    justify-content: space-between;\n  }\n\n  .justify-center {\n    justify-content: center;\n  }\n\n  .justify-end {\n    justify-content: flex-end;\n  }\n\n  .gap-1 {\n    gap: calc(var(--spacing) * 1);\n  }\n\n  .gap-1\\.5 {\n    gap: calc(var(--spacing) * 1.5);\n  }\n\n  .gap-2 {\n    gap: calc(var(--spacing) * 2);\n  }\n\n  .gap-3 {\n    gap: calc(var(--spacing) * 3);\n  }\n\n  .gap-4 {\n    gap: calc(var(--spacing) * 4);\n  }\n\n  .gap-5 {\n    gap: calc(var(--spacing) * 5);\n  }\n\n  .gap-6 {\n    gap: calc(var(--spacing) * 6);\n  }\n\n  .gap-8 {\n    gap: calc(var(--spacing) * 8);\n  }\n\n  :where(.space-y-2 > :not(:last-child)) {\n    --tw-space-y-reverse: 0;\n    margin-block-start: calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));\n    margin-block-end: calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)));\n  }\n\n  :where(.space-y-3 > :not(:last-child)) {\n    --tw-space-y-reverse: 0;\n    margin-block-start: calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));\n    margin-block-end: calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)));\n  }\n\n  :where(.space-y-4 > :not(:last-child)) {\n    --tw-space-y-reverse: 0;\n    margin-block-start: calc(calc(var(--spacing) * 4) * var(--tw-space-y-reverse));\n    margin-block-end: calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-y-reverse)));\n  }\n\n  :where(.space-y-6 > :not(:last-child)) {\n    --tw-space-y-reverse: 0;\n    margin-block-start: calc(calc(var(--spacing) * 6) * var(--tw-space-y-reverse));\n    margin-block-end: calc(calc(var(--spacing) * 6) * calc(1 - var(--tw-space-y-reverse)));\n  }\n\n  :where(.space-y-8 > :not(:last-child)) {\n    --tw-space-y-reverse: 0;\n    margin-block-start: calc(calc(var(--spacing) * 8) * var(--tw-space-y-reverse));\n    margin-block-end: calc(calc(var(--spacing) * 8) * calc(1 - var(--tw-space-y-reverse)));\n  }\n\n  .truncate {\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    overflow: hidden;\n  }\n\n  .overflow-hidden {\n    overflow: hidden;\n  }\n\n  .overflow-x-auto {\n    overflow-x: auto;\n  }\n\n  .overflow-y-auto {\n    overflow-y: auto;\n  }\n\n  .rounded {\n    border-radius: .25rem;\n  }\n\n  .rounded-2xl {\n    border-radius: var(--radius-2xl);\n  }\n\n  .rounded-3xl {\n    border-radius: var(--radius-3xl);\n  }\n\n  .rounded-full {\n    border-radius: 3.40282e38px;\n  }\n\n  .rounded-md {\n    border-radius: calc(var(--radius) - 2px);\n  }\n\n  .rounded-xl {\n    border-radius: calc(var(--radius) + 4px);\n  }\n\n  .rounded-br-sm {\n    border-bottom-right-radius: calc(var(--radius) - 4px);\n  }\n\n  .rounded-bl-sm {\n    border-bottom-left-radius: calc(var(--radius) - 4px);\n  }\n\n  .border {\n    border-style: var(--tw-border-style);\n    border-width: 1px;\n  }\n\n  .border-2 {\n    border-style: var(--tw-border-style);\n    border-width: 2px;\n  }\n\n  .border-4 {\n    border-style: var(--tw-border-style);\n    border-width: 4px;\n  }\n\n  .border-t {\n    border-top-style: var(--tw-border-style);\n    border-top-width: 1px;\n  }\n\n  .border-b {\n    border-bottom-style: var(--tw-border-style);\n    border-bottom-width: 1px;\n  }\n\n  .border-dashed {\n    --tw-border-style: dashed;\n    border-style: dashed;\n  }\n\n  .border-amber-100 {\n    border-color: var(--color-amber-100);\n  }\n\n  .border-blue-100 {\n    border-color: var(--color-blue-100);\n  }\n\n  .border-emerald-100 {\n    border-color: var(--color-emerald-100);\n  }\n\n  .border-indigo-200 {\n    border-color: var(--color-indigo-200);\n  }\n\n  .border-rose-100 {\n    border-color: var(--color-rose-100);\n  }\n\n  .border-slate-100 {\n    border-color: var(--color-slate-100);\n  }\n\n  .border-slate-200 {\n    border-color: var(--color-slate-200);\n  }\n\n  .border-slate-900 {\n    border-color: var(--color-slate-900);\n  }\n\n  .border-transparent {\n    border-color: #0000;\n  }\n\n  .border-white {\n    border-color: var(--color-white);\n  }\n\n  .bg-amber-50 {\n    background-color: var(--color-amber-50);\n  }\n\n  .bg-blue-50 {\n    background-color: var(--color-blue-50);\n  }\n\n  .bg-emerald-50 {\n    background-color: var(--color-emerald-50);\n  }\n\n  .bg-emerald-500 {\n    background-color: var(--color-emerald-500);\n  }\n\n  .bg-indigo-50 {\n    background-color: var(--color-indigo-50);\n  }\n\n  .bg-indigo-100 {\n    background-color: var(--color-indigo-100);\n  }\n\n  .bg-indigo-500 {\n    background-color: var(--color-indigo-500);\n  }\n\n  .bg-rose-50 {\n    background-color: var(--color-rose-50);\n  }\n\n  .bg-rose-500 {\n    background-color: var(--color-rose-500);\n  }\n\n  .bg-slate-50 {\n    background-color: var(--color-slate-50);\n  }\n\n  .bg-slate-50\\/30 {\n    background-color: #f8fafc4d;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-slate-50\\/30 {\n      background-color: color-mix(in oklab, var(--color-slate-50) 30%, transparent);\n    }\n  }\n\n  .bg-slate-50\\/50 {\n    background-color: #f8fafc80;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-slate-50\\/50 {\n      background-color: color-mix(in oklab, var(--color-slate-50) 50%, transparent);\n    }\n  }\n\n  .bg-slate-50\\/90 {\n    background-color: #f8fafce6;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-slate-50\\/90 {\n      background-color: color-mix(in oklab, var(--color-slate-50) 90%, transparent);\n    }\n  }\n\n  .bg-slate-100 {\n    background-color: var(--color-slate-100);\n  }\n\n  .bg-slate-100\\/50 {\n    background-color: #f1f5f980;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-slate-100\\/50 {\n      background-color: color-mix(in oklab, var(--color-slate-100) 50%, transparent);\n    }\n  }\n\n  .bg-slate-200 {\n    background-color: var(--color-slate-200);\n  }\n\n  .bg-slate-900 {\n    background-color: var(--color-slate-900);\n  }\n\n  .bg-slate-900\\/30 {\n    background-color: #0f172b4d;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-slate-900\\/30 {\n      background-color: color-mix(in oklab, var(--color-slate-900) 30%, transparent);\n    }\n  }\n\n  .bg-white {\n    background-color: var(--color-white);\n  }\n\n  .bg-white\\/80 {\n    background-color: #fffc;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-white\\/80 {\n      background-color: color-mix(in oklab, var(--color-white) 80%, transparent);\n    }\n  }\n\n  .bg-white\\/90 {\n    background-color: #ffffffe6;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-white\\/90 {\n      background-color: color-mix(in oklab, var(--color-white) 90%, transparent);\n    }\n  }\n\n  .bg-white\\/95 {\n    background-color: #fffffff2;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-white\\/95 {\n      background-color: color-mix(in oklab, var(--color-white) 95%, transparent);\n    }\n  }\n\n  .fill-indigo-600\\/20 {\n    fill: #4f39f633;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .fill-indigo-600\\/20 {\n      fill: color-mix(in oklab, var(--color-indigo-600) 20%, transparent);\n    }\n  }\n\n  .object-cover {\n    object-fit: cover;\n  }\n\n  .p-2 {\n    padding: calc(var(--spacing) * 2);\n  }\n\n  .p-3 {\n    padding: calc(var(--spacing) * 3);\n  }\n\n  .p-4 {\n    padding: calc(var(--spacing) * 4);\n  }\n\n  .p-6 {\n    padding: calc(var(--spacing) * 6);\n  }\n\n  .p-8 {\n    padding: calc(var(--spacing) * 8);\n  }\n\n  .px-1 {\n    padding-inline: calc(var(--spacing) * 1);\n  }\n\n  .px-2 {\n    padding-inline: calc(var(--spacing) * 2);\n  }\n\n  .px-2\\.5 {\n    padding-inline: calc(var(--spacing) * 2.5);\n  }\n\n  .px-3 {\n    padding-inline: calc(var(--spacing) * 3);\n  }\n\n  .px-4 {\n    padding-inline: calc(var(--spacing) * 4);\n  }\n\n  .px-6 {\n    padding-inline: calc(var(--spacing) * 6);\n  }\n\n  .py-0\\.5 {\n    padding-block: calc(var(--spacing) * .5);\n  }\n\n  .py-1 {\n    padding-block: calc(var(--spacing) * 1);\n  }\n\n  .py-2 {\n    padding-block: calc(var(--spacing) * 2);\n  }\n\n  .py-2\\.5 {\n    padding-block: calc(var(--spacing) * 2.5);\n  }\n\n  .py-3 {\n    padding-block: calc(var(--spacing) * 3);\n  }\n\n  .py-4 {\n    padding-block: calc(var(--spacing) * 4);\n  }\n\n  .py-8 {\n    padding-block: calc(var(--spacing) * 8);\n  }\n\n  .py-12 {\n    padding-block: calc(var(--spacing) * 12);\n  }\n\n  .py-20 {\n    padding-block: calc(var(--spacing) * 20);\n  }\n\n  .pt-2 {\n    padding-top: calc(var(--spacing) * 2);\n  }\n\n  .pt-3 {\n    padding-top: calc(var(--spacing) * 3);\n  }\n\n  .pt-4 {\n    padding-top: calc(var(--spacing) * 4);\n  }\n\n  .pr-3 {\n    padding-right: calc(var(--spacing) * 3);\n  }\n\n  .pb-4 {\n    padding-bottom: calc(var(--spacing) * 4);\n  }\n\n  .pl-3 {\n    padding-left: calc(var(--spacing) * 3);\n  }\n\n  .pl-6 {\n    padding-left: calc(var(--spacing) * 6);\n  }\n\n  .pl-10 {\n    padding-left: calc(var(--spacing) * 10);\n  }\n\n  .text-center {\n    text-align: center;\n  }\n\n  .text-left {\n    text-align: left;\n  }\n\n  .font-sans {\n    font-family: var(--font-sans);\n  }\n\n  .text-2xl {\n    font-size: var(--text-2xl);\n    line-height: var(--tw-leading, var(--text-2xl--line-height));\n  }\n\n  .text-3xl {\n    font-size: var(--text-3xl);\n    line-height: var(--tw-leading, var(--text-3xl--line-height));\n  }\n\n  .text-4xl {\n    font-size: var(--text-4xl);\n    line-height: var(--tw-leading, var(--text-4xl--line-height));\n  }\n\n  .text-lg {\n    font-size: var(--text-lg);\n    line-height: var(--tw-leading, var(--text-lg--line-height));\n  }\n\n  .text-sm {\n    font-size: var(--text-sm);\n    line-height: var(--tw-leading, var(--text-sm--line-height));\n  }\n\n  .text-xl {\n    font-size: var(--text-xl);\n    line-height: var(--tw-leading, var(--text-xl--line-height));\n  }\n\n  .text-xs {\n    font-size: var(--text-xs);\n    line-height: var(--tw-leading, var(--text-xs--line-height));\n  }\n\n  .text-\\[10px\\] {\n    font-size: 10px;\n  }\n\n  .text-\\[11px\\] {\n    font-size: 11px;\n  }\n\n  .leading-relaxed {\n    --tw-leading: var(--leading-relaxed);\n    line-height: var(--leading-relaxed);\n  }\n\n  .leading-tight {\n    --tw-leading: var(--leading-tight);\n    line-height: var(--leading-tight);\n  }\n\n  .font-bold {\n    --tw-font-weight: var(--font-weight-bold);\n    font-weight: var(--font-weight-bold);\n  }\n\n  .font-light {\n    --tw-font-weight: var(--font-weight-light);\n    font-weight: var(--font-weight-light);\n  }\n\n  .font-medium {\n    --tw-font-weight: var(--font-weight-medium);\n    font-weight: var(--font-weight-medium);\n  }\n\n  .font-semibold {\n    --tw-font-weight: var(--font-weight-semibold);\n    font-weight: var(--font-weight-semibold);\n  }\n\n  .tracking-tight {\n    --tw-tracking: var(--tracking-tight);\n    letter-spacing: var(--tracking-tight);\n  }\n\n  .tracking-wide {\n    --tw-tracking: var(--tracking-wide);\n    letter-spacing: var(--tracking-wide);\n  }\n\n  .tracking-wider {\n    --tw-tracking: var(--tracking-wider);\n    letter-spacing: var(--tracking-wider);\n  }\n\n  .whitespace-nowrap {\n    white-space: nowrap;\n  }\n\n  .whitespace-pre-wrap {\n    white-space: pre-wrap;\n  }\n\n  .text-amber-500 {\n    color: var(--color-amber-500);\n  }\n\n  .text-amber-700 {\n    color: var(--color-amber-700);\n  }\n\n  .text-blue-500 {\n    color: var(--color-blue-500);\n  }\n\n  .text-blue-700 {\n    color: var(--color-blue-700);\n  }\n\n  .text-emerald-400 {\n    color: var(--color-emerald-400);\n  }\n\n  .text-emerald-500 {\n    color: var(--color-emerald-500);\n  }\n\n  .text-emerald-600 {\n    color: var(--color-emerald-600);\n  }\n\n  .text-emerald-700 {\n    color: var(--color-emerald-700);\n  }\n\n  .text-indigo-200 {\n    color: var(--color-indigo-200);\n  }\n\n  .text-indigo-600 {\n    color: var(--color-indigo-600);\n  }\n\n  .text-indigo-700 {\n    color: var(--color-indigo-700);\n  }\n\n  .text-rose-400 {\n    color: var(--color-rose-400);\n  }\n\n  .text-rose-700 {\n    color: var(--color-rose-700);\n  }\n\n  .text-slate-300 {\n    color: var(--color-slate-300);\n  }\n\n  .text-slate-400 {\n    color: var(--color-slate-400);\n  }\n\n  .text-slate-500 {\n    color: var(--color-slate-500);\n  }\n\n  .text-slate-600 {\n    color: var(--color-slate-600);\n  }\n\n  .text-slate-700 {\n    color: var(--color-slate-700);\n  }\n\n  .text-slate-800 {\n    color: var(--color-slate-800);\n  }\n\n  .text-slate-900 {\n    color: var(--color-slate-900);\n  }\n\n  .text-white {\n    color: var(--color-white);\n  }\n\n  .capitalize {\n    text-transform: capitalize;\n  }\n\n  .uppercase {\n    text-transform: uppercase;\n  }\n\n  .placeholder-slate-400::placeholder {\n    color: var(--color-slate-400);\n  }\n\n  .opacity-50 {\n    opacity: .5;\n  }\n\n  .shadow-md {\n    --tw-shadow: 0 4px 6px -1px var(--tw-shadow-color, #0000001a), 0 2px 4px -2px var(--tw-shadow-color, #0000001a);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-sm {\n    --tw-shadow: 0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-xl {\n    --tw-shadow: 0 20px 25px -5px var(--tw-shadow-color, #0000001a), 0 8px 10px -6px var(--tw-shadow-color, #0000001a);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-slate-200\\/60 {\n    --tw-shadow-color: #e2e8f099;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .shadow-slate-200\\/60 {\n      --tw-shadow-color: color-mix(in oklab, color-mix(in oklab, var(--color-slate-200) 60%, transparent) var(--tw-shadow-alpha), transparent);\n    }\n  }\n\n  .ring-indigo-500\\/20 {\n    --tw-ring-color: #625fff33;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .ring-indigo-500\\/20 {\n      --tw-ring-color: color-mix(in oklab, var(--color-indigo-500) 20%, transparent);\n    }\n  }\n\n  .blur-3xl {\n    --tw-blur: blur(var(--blur-3xl));\n    filter: var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, );\n  }\n\n  .filter {\n    filter: var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, );\n  }\n\n  .backdrop-blur {\n    --tw-backdrop-blur: blur(8px);\n    -webkit-backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );\n    backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );\n  }\n\n  .backdrop-blur-md {\n    --tw-backdrop-blur: blur(var(--blur-md));\n    -webkit-backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );\n    backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );\n  }\n\n  .backdrop-blur-sm {\n    --tw-backdrop-blur: blur(var(--blur-sm));\n    -webkit-backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );\n    backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );\n  }\n\n  .transition-all {\n    transition-property: all;\n    transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));\n    transition-duration: var(--tw-duration, var(--default-transition-duration));\n  }\n\n  .transition-colors {\n    transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to;\n    transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));\n    transition-duration: var(--tw-duration, var(--default-transition-duration));\n  }\n\n  .transition-transform {\n    transition-property: transform, translate, scale, rotate;\n    transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));\n    transition-duration: var(--tw-duration, var(--default-transition-duration));\n  }\n\n  .duration-300 {\n    --tw-duration: .3s;\n    transition-duration: .3s;\n  }\n\n  .duration-700 {\n    --tw-duration: .7s;\n    transition-duration: .7s;\n  }\n\n  .ease-out {\n    --tw-ease: var(--ease-out);\n    transition-timing-function: var(--ease-out);\n  }\n\n  .outline-none {\n    --tw-outline-style: none;\n    outline-style: none;\n  }\n\n  .paused {\n    animation-play-state: paused;\n  }\n\n  .group-focus-within\\:text-indigo-500:is(:where(.group):focus-within *) {\n    color: var(--color-indigo-500);\n  }\n\n  @media (hover: hover) {\n    .group-hover\\:-translate-y-1:is(:where(.group):hover *) {\n      --tw-translate-y: calc(var(--spacing) * -1);\n      translate: var(--tw-translate-x) var(--tw-translate-y);\n    }\n\n    .group-hover\\:scale-105:is(:where(.group):hover *) {\n      --tw-scale-x: 105%;\n      --tw-scale-y: 105%;\n      --tw-scale-z: 105%;\n      scale: var(--tw-scale-x) var(--tw-scale-y);\n    }\n\n    .group-hover\\:text-indigo-600:is(:where(.group):hover *) {\n      color: var(--color-indigo-600);\n    }\n  }\n\n  .before\\:absolute:before {\n    content: var(--tw-content);\n    position: absolute;\n  }\n\n  .before\\:inset-y-2:before {\n    content: var(--tw-content);\n    inset-block: calc(var(--spacing) * 2);\n  }\n\n  .before\\:left-2:before {\n    content: var(--tw-content);\n    left: calc(var(--spacing) * 2);\n  }\n\n  .before\\:w-0\\.5:before {\n    content: var(--tw-content);\n    width: calc(var(--spacing) * .5);\n  }\n\n  .before\\:bg-slate-100:before {\n    content: var(--tw-content);\n    background-color: var(--color-slate-100);\n  }\n\n  @media (hover: hover) {\n    .hover\\:border-slate-300:hover {\n      border-color: var(--color-slate-300);\n    }\n\n    .hover\\:bg-slate-50:hover {\n      background-color: var(--color-slate-50);\n    }\n\n    .hover\\:bg-slate-100:hover {\n      background-color: var(--color-slate-100);\n    }\n\n    .hover\\:bg-slate-800:hover {\n      background-color: var(--color-slate-800);\n    }\n\n    .hover\\:text-emerald-700:hover {\n      color: var(--color-emerald-700);\n    }\n\n    .hover\\:text-rose-500:hover {\n      color: var(--color-rose-500);\n    }\n\n    .hover\\:text-rose-700:hover {\n      color: var(--color-rose-700);\n    }\n\n    .hover\\:text-slate-600:hover {\n      color: var(--color-slate-600);\n    }\n\n    .hover\\:text-slate-700:hover {\n      color: var(--color-slate-700);\n    }\n\n    .hover\\:text-slate-900:hover {\n      color: var(--color-slate-900);\n    }\n\n    .hover\\:underline:hover {\n      text-decoration-line: underline;\n    }\n\n    .hover\\:shadow-lg:hover {\n      --tw-shadow: 0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a);\n      box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n    }\n\n    .hover\\:ring-2:hover {\n      --tw-ring-shadow: var(--tw-ring-inset, ) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);\n      box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n    }\n\n    .hover\\:shadow-slate-200\\/50:hover {\n      --tw-shadow-color: #e2e8f080;\n    }\n\n    @supports (color: color-mix(in lab, red, red)) {\n      .hover\\:shadow-slate-200\\/50:hover {\n        --tw-shadow-color: color-mix(in oklab, color-mix(in oklab, var(--color-slate-200) 50%, transparent) var(--tw-shadow-alpha), transparent);\n      }\n    }\n  }\n\n  .focus\\:border-indigo-500:focus {\n    border-color: var(--color-indigo-500);\n  }\n\n  .focus\\:border-slate-300:focus {\n    border-color: var(--color-slate-300);\n  }\n\n  .focus\\:bg-white:focus {\n    background-color: var(--color-white);\n  }\n\n  .focus\\:ring-2:focus {\n    --tw-ring-shadow: var(--tw-ring-inset, ) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .focus\\:ring-indigo-500\\/20:focus {\n    --tw-ring-color: #625fff33;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .focus\\:ring-indigo-500\\/20:focus {\n      --tw-ring-color: color-mix(in oklab, var(--color-indigo-500) 20%, transparent);\n    }\n  }\n\n  .focus\\:ring-slate-200:focus {\n    --tw-ring-color: var(--color-slate-200);\n  }\n\n  .focus\\:outline-none:focus {\n    --tw-outline-style: none;\n    outline-style: none;\n  }\n\n  .disabled\\:opacity-50:disabled {\n    opacity: .5;\n  }\n\n  @media (min-width: 40rem) {\n    .sm\\:flex-1 {\n      flex: 1;\n    }\n\n    .sm\\:grid-cols-2 {\n      grid-template-columns: repeat(2, minmax(0, 1fr));\n    }\n\n    .sm\\:flex-row {\n      flex-direction: row;\n    }\n\n    .sm\\:px-6 {\n      padding-inline: calc(var(--spacing) * 6);\n    }\n  }\n\n  @media (min-width: 48rem) {\n    .md\\:col-span-2 {\n      grid-column: span 2 / span 2;\n    }\n\n    .md\\:flex {\n      display: flex;\n    }\n\n    .md\\:hidden {\n      display: none;\n    }\n\n    .md\\:aspect-\\[16\\/10\\] {\n      aspect-ratio: 16 / 10;\n    }\n\n    .md\\:w-80 {\n      width: calc(var(--spacing) * 80);\n    }\n\n    .md\\:w-auto {\n      width: auto;\n    }\n\n    .md\\:grid-cols-2 {\n      grid-template-columns: repeat(2, minmax(0, 1fr));\n    }\n\n    .md\\:grid-cols-3 {\n      grid-template-columns: repeat(3, minmax(0, 1fr));\n    }\n\n    .md\\:grid-cols-4 {\n      grid-template-columns: repeat(4, minmax(0, 1fr));\n    }\n\n    .md\\:flex-row {\n      flex-direction: row;\n    }\n\n    .md\\:items-center {\n      align-items: center;\n    }\n\n    .md\\:p-8 {\n      padding: calc(var(--spacing) * 8);\n    }\n\n    .md\\:p-12 {\n      padding: calc(var(--spacing) * 12);\n    }\n\n    .md\\:text-5xl {\n      font-size: var(--text-5xl);\n      line-height: var(--tw-leading, var(--text-5xl--line-height));\n    }\n  }\n\n  @media (min-width: 64rem) {\n    .lg\\:col-span-2 {\n      grid-column: span 2 / span 2;\n    }\n\n    .lg\\:grid-cols-3 {\n      grid-template-columns: repeat(3, minmax(0, 1fr));\n    }\n\n    .lg\\:px-8 {\n      padding-inline: calc(var(--spacing) * 8);\n    }\n  }\n\n  @media (min-width: 80rem) {\n    .xl\\:grid-cols-4 {\n      grid-template-columns: repeat(4, minmax(0, 1fr));\n    }\n  }\n}\n\n@property --tw-animation-delay {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0s;\n}\n\n@property --tw-animation-direction {\n  syntax: "*";\n  inherits: false;\n  initial-value: normal;\n}\n\n@property --tw-animation-duration {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-animation-fill-mode {\n  syntax: "*";\n  inherits: false;\n  initial-value: none;\n}\n\n@property --tw-animation-iteration-count {\n  syntax: "*";\n  inherits: false;\n  initial-value: 1;\n}\n\n@property --tw-enter-blur {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-enter-opacity {\n  syntax: "*";\n  inherits: false;\n  initial-value: 1;\n}\n\n@property --tw-enter-rotate {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-enter-scale {\n  syntax: "*";\n  inherits: false;\n  initial-value: 1;\n}\n\n@property --tw-enter-translate-x {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-enter-translate-y {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-exit-blur {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-exit-opacity {\n  syntax: "*";\n  inherits: false;\n  initial-value: 1;\n}\n\n@property --tw-exit-rotate {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-exit-scale {\n  syntax: "*";\n  inherits: false;\n  initial-value: 1;\n}\n\n@property --tw-exit-translate-x {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-exit-translate-y {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n:root, :host, [data-uruc-plugin-app-root], [data-uruc-plugin-portal-root] {\n  --font-size: 16px;\n  --background: #fff;\n  --foreground: oklch(14.5% 0 0);\n  --card: #fff;\n  --card-foreground: oklch(14.5% 0 0);\n  --popover: oklch(100% 0 0);\n  --popover-foreground: oklch(14.5% 0 0);\n  --primary: #030213;\n  --primary-foreground: oklch(100% 0 0);\n  --secondary: oklch(95% .0058 264.53);\n  --secondary-foreground: #030213;\n  --muted: #ececf0;\n  --muted-foreground: #717182;\n  --accent: #e9ebef;\n  --accent-foreground: #030213;\n  --destructive: #d4183d;\n  --destructive-foreground: #fff;\n  --border: #0000001a;\n  --input: transparent;\n  --input-background: #f3f3f5;\n  --switch-background: #cbced4;\n  --font-weight-medium: 500;\n  --font-weight-normal: 400;\n  --ring: oklch(70.8% 0 0);\n  --chart-1: oklch(64.6% .222 41.116);\n  --chart-2: oklch(60% .118 184.704);\n  --chart-3: oklch(39.8% .07 227.392);\n  --chart-4: oklch(82.8% .189 84.429);\n  --chart-5: oklch(76.9% .188 70.08);\n  --radius: .625rem;\n  --sidebar: oklch(98.5% 0 0);\n  --sidebar-foreground: oklch(14.5% 0 0);\n  --sidebar-primary: #030213;\n  --sidebar-primary-foreground: oklch(98.5% 0 0);\n  --sidebar-accent: oklch(97% 0 0);\n  --sidebar-accent-foreground: oklch(20.5% 0 0);\n  --sidebar-border: oklch(92.2% 0 0);\n  --sidebar-ring: oklch(70.8% 0 0);\n}\n\n.dark, :host(.dark), [data-uruc-plugin-app-root].dark, [data-uruc-plugin-portal-root].dark {\n  --background: oklch(14.5% 0 0);\n  --foreground: oklch(98.5% 0 0);\n  --card: oklch(14.5% 0 0);\n  --card-foreground: oklch(98.5% 0 0);\n  --popover: oklch(14.5% 0 0);\n  --popover-foreground: oklch(98.5% 0 0);\n  --primary: oklch(98.5% 0 0);\n  --primary-foreground: oklch(20.5% 0 0);\n  --secondary: oklch(26.9% 0 0);\n  --secondary-foreground: oklch(98.5% 0 0);\n  --muted: oklch(26.9% 0 0);\n  --muted-foreground: oklch(70.8% 0 0);\n  --accent: oklch(26.9% 0 0);\n  --accent-foreground: oklch(98.5% 0 0);\n  --destructive: oklch(39.6% .141 25.723);\n  --destructive-foreground: oklch(63.7% .237 25.331);\n  --border: oklch(26.9% 0 0);\n  --input: oklch(26.9% 0 0);\n  --ring: oklch(43.9% 0 0);\n  --font-weight-medium: 500;\n  --font-weight-normal: 400;\n  --chart-1: oklch(48.8% .243 264.376);\n  --chart-2: oklch(69.6% .17 162.48);\n  --chart-3: oklch(76.9% .188 70.08);\n  --chart-4: oklch(62.7% .265 303.9);\n  --chart-5: oklch(64.5% .246 16.439);\n  --sidebar: oklch(20.5% 0 0);\n  --sidebar-foreground: oklch(98.5% 0 0);\n  --sidebar-primary: oklch(48.8% .243 264.376);\n  --sidebar-primary-foreground: oklch(98.5% 0 0);\n  --sidebar-accent: oklch(26.9% 0 0);\n  --sidebar-accent-foreground: oklch(98.5% 0 0);\n  --sidebar-border: oklch(26.9% 0 0);\n  --sidebar-ring: oklch(43.9% 0 0);\n}\n\n@property --tw-rotate-x {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-rotate-y {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-rotate-z {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-skew-x {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-skew-y {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-space-y-reverse {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-border-style {\n  syntax: "*";\n  inherits: false;\n  initial-value: solid;\n}\n\n@property --tw-leading {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-font-weight {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-tracking {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-shadow {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0 0 #0000;\n}\n\n@property --tw-shadow-color {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-shadow-alpha {\n  syntax: "<percentage>";\n  inherits: false;\n  initial-value: 100%;\n}\n\n@property --tw-inset-shadow {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0 0 #0000;\n}\n\n@property --tw-inset-shadow-color {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-inset-shadow-alpha {\n  syntax: "<percentage>";\n  inherits: false;\n  initial-value: 100%;\n}\n\n@property --tw-ring-color {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-ring-shadow {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0 0 #0000;\n}\n\n@property --tw-inset-ring-color {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-inset-ring-shadow {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0 0 #0000;\n}\n\n@property --tw-ring-inset {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-ring-offset-width {\n  syntax: "<length>";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-ring-offset-color {\n  syntax: "*";\n  inherits: false;\n  initial-value: #fff;\n}\n\n@property --tw-ring-offset-shadow {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0 0 #0000;\n}\n\n@property --tw-blur {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-brightness {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-contrast {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-grayscale {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-hue-rotate {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-invert {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-opacity {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-saturate {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-sepia {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-drop-shadow {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-drop-shadow-color {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-drop-shadow-alpha {\n  syntax: "<percentage>";\n  inherits: false;\n  initial-value: 100%;\n}\n\n@property --tw-drop-shadow-size {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-blur {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-brightness {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-contrast {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-grayscale {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-hue-rotate {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-invert {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-opacity {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-saturate {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-sepia {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-duration {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-ease {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-translate-x {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-translate-y {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-translate-z {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-scale-x {\n  syntax: "*";\n  inherits: false;\n  initial-value: 1;\n}\n\n@property --tw-scale-y {\n  syntax: "*";\n  inherits: false;\n  initial-value: 1;\n}\n\n@property --tw-scale-z {\n  syntax: "*";\n  inherits: false;\n  initial-value: 1;\n}\n\n@property --tw-content {\n  syntax: "*";\n  inherits: false;\n  initial-value: "";\n}\n\n@keyframes spin {\n  to {\n    transform: rotate(360deg);\n  }\n}\n';
  const index$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    default: index
  }, Symbol.toStringTag, { value: "Module" }));
  const API_BASE = "/api";
  const PLUGIN_HTTP_BASE = "/plugins/uruc.fleamarket/v1";
  const FLEAMARKET_COMMAND = (id) => `uruc.fleamarket.${id}@v1`;
  const FleamarketApi = {
    uploadListingAsset(agentId, file) {
      const form = new FormData();
      form.append("file", file);
      return frontendHttp.requestJson(
        API_BASE,
        `${PLUGIN_HTTP_BASE}/assets/listings?agentId=${encodeURIComponent(agentId)}`,
        {
          method: "POST",
          body: form
        }
      );
    }
  };
  const EMPTY_FORM = {
    title: "",
    description: "",
    category: "compute",
    tags: "",
    priceText: "",
    priceAmount: "",
    quantity: "1",
    condition: "",
    tradeRoute: "",
    mediaUrls: ""
  };
  const MARKET_CATEGORIES = [
    { id: "all", name: "All Listings", icon: lucideReact.LayoutGrid },
    { id: "compute", name: "Compute", icon: lucideReact.Cpu, backendCategory: "compute" },
    { id: "data", name: "Data", icon: lucideReact.Database, backendCategory: "data" },
    { id: "tool", name: "Tools", icon: lucideReact.Wrench, backendCategory: "tool" },
    { id: "service", name: "Services", icon: lucideReact.Boxes, backendCategory: "service" },
    { id: "artifact", name: "Artifacts", icon: lucideReact.Package, backendCategory: "artifact" }
  ];
  MARKET_CATEGORIES.map((category) => category.id);
  const NON_TERMINAL_TRADES = /* @__PURE__ */ new Set(["open", "accepted", "buyer_confirmed", "seller_confirmed"]);
  function backendCategoryFor(categoryId) {
    return MARKET_CATEGORIES.find((category) => category.id === categoryId)?.backendCategory ?? categoryId;
  }
  function getErrorText(error, fallback) {
    if (frontend.isPluginCommandError(error)) return error.message;
    if (error instanceof Error) return error.message;
    return fallback;
  }
  function initials(name) {
    const value = name.trim() || "Agent";
    return value.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase();
  }
  function parseCommaList(value) {
    return [...new Set(value.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean))];
  }
  function heroImage(images) {
    return images?.find((image) => image.url)?.url ?? null;
  }
  function isWritableStatus(trade) {
    return Boolean(trade && NON_TERMINAL_TRADES.has(trade.status));
  }
  function roleForTrade(trade, agentId) {
    if (!trade || !agentId) return null;
    if (trade.sellerAgentId === agentId) return "seller";
    if (trade.buyerAgentId === agentId) return "buyer";
    return null;
  }
  function formFromListing(listing) {
    return {
      title: listing.title,
      description: listing.description,
      category: listing.category,
      tags: listing.tags.join(", "),
      priceText: listing.priceText,
      priceAmount: listing.priceAmount === null || listing.priceAmount === void 0 ? "" : String(listing.priceAmount),
      quantity: String(listing.quantity),
      condition: listing.condition,
      tradeRoute: listing.tradeRoute,
      mediaUrls: listing.mediaUrls.join(", ")
    };
  }
  function listingImage$1(listing) {
    if (!listing) return null;
    return heroImage(listing.images) ?? listing.mediaUrls.find((url) => /^https?:\/\//i.test(url)) ?? null;
  }
  function stepState(trade, step) {
    if (step === "completed") return trade.status === "completed" ? "completed" : "pending";
    if (step === "confirmation") {
      return ["buyer_confirmed", "seller_confirmed", "completed"].includes(trade.status) ? "confirmation" : "pending";
    }
    return ["open", "accepted", "buyer_confirmed", "seller_confirmed", "completed"].includes(trade.status) ? "negotiating" : "pending";
  }
  function Chat({
    trade,
    listing,
    messages,
    activeAgentId,
    messageDraft,
    messagesHasMore,
    reviewRating,
    reviewComment,
    reviewSubmitted,
    busy,
    onBack,
    onMessageDraftChange,
    onSendMessage,
    onLoadEarlierMessages,
    onTradeAction,
    onReviewRatingChange,
    onReviewCommentChange,
    onSubmitReview,
    onReport
  }) {
    const role = roleForTrade(trade, activeAgentId);
    const sellerName = trade.sellerAgentName ?? listing?.sellerAgentName ?? "Seller";
    const image = listingImage$1(listing);
    const canSellerDecide = role === "seller" && trade.status === "open";
    const canConfirm = role !== null && ["accepted", "buyer_confirmed", "seller_confirmed"].includes(trade.status);
    const canCancel = role !== null && isWritableStatus(trade);
    const showReview = role !== null && trade.status === "completed";
    const reportCount = trade.reportCount ?? 0;
    const handleSend = (event) => {
      event.preventDefault();
      onSendMessage();
    };
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex-1 bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden shadow-sm", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "h-16 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50/50", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-4", children: [
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: onBack, className: "p-2 -ml-2 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors", "aria-label": "Back to trades", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { className: "w-5 h-5" }) }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-sm", children: initials(sellerName) }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "font-semibold text-slate-900 text-sm", children: sellerName }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "text-xs text-slate-500 flex items-center gap-1", children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-emerald-500" }),
              " ",
              trade.status,
              reportCount > 0 ? /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "ml-2 text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-amber-100 bg-amber-50 text-amber-700", children: [
                reportCount,
                " reports"
              ] }) : null
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-col items-center", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full my-2", children: [
            "Trade route: ",
            trade.tradeRouteSnapshot ?? listing?.tradeRoute ?? "Use the seller-provided offline route."
          ] }) }),
          messagesHasMore ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex justify-center", children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: busy, onClick: onLoadEarlierMessages, className: "text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full hover:bg-slate-50 disabled:opacity-50", children: "Load earlier messages" }) }) : null,
          messages.map((msg) => {
            const mine = msg.senderAgentId === activeAgentId;
            return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `flex flex-col ${mine ? "items-end" : "items-start"}`, children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `max-w-[75%] rounded-2xl px-4 py-2.5 ${mine ? "bg-slate-900 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"}`, children: [
                /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm", children: msg.body }),
                !mine ? /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => onReport({
                      targetType: "message",
                      targetId: msg.messageId,
                      tradeId: trade.tradeId,
                      targetAgentId: msg.senderAgentId,
                      label: `message ${msg.messageId}`
                    }),
                    className: "mt-2 text-[10px] text-slate-400 hover:text-rose-500",
                    children: "Report"
                  }
                ) : null
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "text-[10px] text-slate-400 mt-1 px-1", children: [
                msg.senderAgentName,
                " · ",
                frontend.formatPluginDateTime(msg.createdAt)
              ] })
            ] }, msg.messageId);
          })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "p-4 bg-white border-t border-slate-200", children: /* @__PURE__ */ jsxRuntime.jsxs("form", { onSubmit: handleSend, className: "flex gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "text",
              value: messageDraft,
              onChange: (event) => onMessageDraftChange(event.target.value),
              placeholder: "Type a message...",
              disabled: busy || !isWritableStatus(trade),
              "aria-label": "Trade message",
              className: "flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none"
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              type: "submit",
              disabled: busy || !messageDraft.trim() || !isWritableStatus(trade),
              className: "bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center",
              "aria-label": "Send",
              children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Send, { className: "w-5 h-5" })
            }
          )
        ] }) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "w-full md:w-80 flex flex-col gap-6", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "p-4 flex gap-4", children: [
          image ? /* @__PURE__ */ jsxRuntime.jsx("img", { src: image, alt: trade.listingTitle, className: "w-20 h-20 rounded-xl object-cover" }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300 shrink-0", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Store, { className: "w-7 h-7" }) }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntime.jsx("h4", { className: "text-sm font-semibold text-slate-900 line-clamp-2", children: trade.listingTitle }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-lg font-bold text-slate-900 mt-1", children: trade.priceTextSnapshot ?? listing?.priceText ?? "Price terms in listing" })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex-1", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("h3", { className: "font-semibold text-slate-900 mb-4 flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Info, { className: "w-4 h-4 text-slate-400" }),
            "Trade Status"
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-6", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative pl-6 space-y-6 before:absolute before:inset-y-2 before:left-2 before:w-0.5 before:bg-slate-100", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative", children: [
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: `absolute -left-[29px] w-5 h-5 rounded-full border-4 border-white ${stepState(trade, "negotiation") === "negotiating" ? "bg-indigo-500" : "bg-slate-200"}` }),
                /* @__PURE__ */ jsxRuntime.jsx("h4", { className: `text-sm font-medium ${stepState(trade, "negotiation") === "negotiating" ? "text-indigo-600" : "text-slate-500"}`, children: "Negotiation" }),
                /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-xs text-slate-400 mt-1", children: "Agree on price, payment, delivery, and handoff." })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative", children: [
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: `absolute -left-[29px] w-5 h-5 rounded-full border-4 border-white ${stepState(trade, "confirmation") === "confirmation" ? "bg-indigo-500" : stepState(trade, "confirmation") === "completed" ? "bg-emerald-500" : "bg-slate-200"}` }),
                /* @__PURE__ */ jsxRuntime.jsx("h4", { className: `text-sm font-medium ${stepState(trade, "confirmation") === "confirmation" ? "text-indigo-600" : stepState(trade, "confirmation") === "completed" ? "text-emerald-600" : "text-slate-500"}`, children: "Both-side confirmation" }),
                /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-xs text-slate-400 mt-1", children: "Each side confirms successful offline completion." })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative", children: [
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: `absolute -left-[29px] w-5 h-5 rounded-full border-4 border-white ${stepState(trade, "completed") === "completed" ? "bg-emerald-500" : "bg-slate-200"}` }),
                /* @__PURE__ */ jsxRuntime.jsx("h4", { className: `text-sm font-medium ${stepState(trade, "completed") === "completed" ? "text-emerald-600" : "text-slate-500"}`, children: "Trade Completed" }),
                /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-xs text-slate-400 mt-1", children: "Fleamarket records completion after both confirmations." })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "pt-4 border-t border-slate-100 space-y-3", children: [
              canSellerDecide ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
                /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: busy, onClick: () => onTradeAction("accept_trade"), className: "w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50", children: "Accept trade" }),
                /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: busy, onClick: () => onTradeAction("decline_trade"), className: "w-full bg-white text-slate-700 border border-slate-200 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50", children: "Decline trade" })
              ] }) : null,
              canConfirm ? /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", disabled: busy, onClick: () => onTradeAction("confirm_trade_success"), className: "w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2", children: [
                /* @__PURE__ */ jsxRuntime.jsx(lucideReact.CheckCircle2, { className: "w-4 h-4" }),
                "Confirm success"
              ] }) : null,
              canCancel ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: busy, onClick: () => onTradeAction("cancel_trade"), className: "w-full bg-white text-slate-700 border border-slate-200 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50", children: "Cancel trade" }) : null,
              trade.status === "completed" ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-center gap-2 text-emerald-600 font-medium bg-emerald-50 p-3 rounded-xl border border-emerald-100", children: [
                /* @__PURE__ */ jsxRuntime.jsx(lucideReact.CheckCircle2, { className: "w-5 h-5" }),
                "Trade Successful"
              ] }) : null
            ] }),
            showReview ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "pt-4 border-t border-slate-100 space-y-3", children: [
              /* @__PURE__ */ jsxRuntime.jsx("h4", { className: "text-sm font-semibold text-slate-900", children: "Review counterparty" }),
              reviewSubmitted ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700", children: "Review submitted. Each side can submit one review after completion." }) : /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex gap-2", role: "group", "aria-label": "Review rating", children: [1, 2, 3, 4, 5].map((rating) => /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    type: "button",
                    "aria-label": `Rate ${rating}`,
                    onClick: () => onReviewRatingChange(String(rating)),
                    className: `w-9 h-9 rounded-xl border text-sm font-medium transition-colors ${String(rating) === reviewRating ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`,
                    children: rating
                  },
                  rating
                )) }),
                /* @__PURE__ */ jsxRuntime.jsx(
                  "textarea",
                  {
                    "aria-label": "Review comment",
                    value: reviewComment,
                    onChange: (event) => onReviewCommentChange(event.target.value),
                    placeholder: "Short review comment",
                    className: "w-full min-h-20 bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none resize-none"
                  }
                ),
                /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: busy, onClick: onSubmitReview, className: "w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50", children: "Submit review" })
              ] })
            ] }) : null,
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "pt-2 text-center", children: /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                onClick: () => onReport({
                  targetType: "trade",
                  targetId: trade.tradeId,
                  tradeId: trade.tradeId,
                  targetAgentId: role === "seller" ? trade.buyerAgentId : trade.sellerAgentId,
                  label: trade.tradeId
                }),
                className: "text-xs flex items-center justify-center gap-1 text-slate-400 hover:text-rose-500 w-full transition-colors",
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.AlertTriangle, { className: "w-3.5 h-3.5" }),
                  " File a Report"
                ]
              }
            ) })
          ] })
        ] })
      ] })
    ] });
  }
  const REPORT_REASON_OPTIONS = [
    { value: "safety_review", label: "Safety review" },
    { value: "no_show", label: "No show" },
    { value: "misleading_listing", label: "Misleading listing" },
    { value: "abusive_message", label: "Abusive message" },
    { value: "other", label: "Other" }
  ];
  function panelButtonClass(kind = "secondary") {
    if (kind === "primary") return "bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2";
    if (kind === "danger") return "text-sm text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-50";
    return "bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50";
  }
  function TradeListView({
    trades,
    busy,
    statusFilter,
    hasMore,
    onBack,
    onOpen,
    onRefresh,
    onStatusFilterChange,
    onLoadMore
  }) {
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "max-w-5xl mx-auto space-y-6", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors", onClick: onBack, children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { className: "w-4 h-4" }),
          "Back"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), disabled: busy, onClick: onRefresh, children: "Refresh trades" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4", children: [
          /* @__PURE__ */ jsxRuntime.jsx("h1", { className: "text-2xl font-semibold text-slate-900", children: "My trades" }),
          /* @__PURE__ */ jsxRuntime.jsxs("select", { name: "tradeStatus", value: statusFilter, onChange: (event) => onStatusFilterChange(event.target.value), "aria-label": "Filter trades by status", className: "bg-white border border-slate-200 text-sm rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20", children: [
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "all", children: "All status" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "open", children: "Open" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "accepted", children: "Accepted" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "buyer_confirmed", children: "Buyer confirmed" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "seller_confirmed", children: "Seller confirmed" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "completed", children: "Completed" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "declined", children: "Declined" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "cancelled", children: "Cancelled" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-3", children: [
          trades.map((trade) => /* @__PURE__ */ jsxRuntime.jsxs("article", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 rounded-2xl border border-slate-100 p-4", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsxRuntime.jsx("strong", { className: "block text-slate-900 truncate", children: trade.listingTitle }),
              /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "text-sm text-slate-500 truncate block", children: [
                trade.tradeId,
                " · ",
                trade.status,
                " · qty ",
                trade.quantity
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                type: "button",
                className: panelButtonClass("secondary"),
                "data-testid": `fleamarket-open-${trade.tradeId}`,
                onClick: () => onOpen(trade.tradeId),
                children: "Open"
              }
            )
          ] }, trade.tradeId)),
          trades.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-slate-500", children: "No trades for this agent yet." }) : null
        ] }),
        hasMore ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-6 flex justify-center", children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), disabled: busy, onClick: onLoadMore, children: "Load more" }) }) : null
      ] })
    ] });
  }
  function ComposeView({
    form,
    selectedFiles,
    retainedImageAssetIds,
    existingImages,
    busy,
    mode,
    onBack,
    onFormChange,
    onFilesChange,
    onRemoveImage,
    onSaveDraft,
    onPublishNow,
    onSaveListing
  }) {
    const [selectedPreviews, setSelectedPreviews] = react.useState([]);
    const categoryPreset = MARKET_CATEGORIES.some((category) => category.id !== "all" && category.id === form.category) ? form.category : "custom";
    const retainedImages = existingImages.filter((image) => retainedImageAssetIds.includes(image.assetId));
    const inputClass = "w-full bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none";
    const labelClass = "block text-sm text-slate-500 font-medium mb-1";
    react.useEffect(() => {
      if (typeof URL.createObjectURL !== "function") {
        setSelectedPreviews([]);
        return;
      }
      const urls = selectedFiles.map((file) => URL.createObjectURL(file));
      setSelectedPreviews(urls);
      return () => {
        urls.forEach((url) => URL.revokeObjectURL(url));
      };
    }, [selectedFiles]);
    const input = (name, label, placeholder) => /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "block", children: [
      /* @__PURE__ */ jsxRuntime.jsx("span", { className: labelClass, children: label }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "input",
        {
          name,
          value: form[name],
          onChange: (event) => onFormChange(name, event.target.value),
          placeholder,
          className: inputClass
        }
      )
    ] });
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "max-w-4xl mx-auto space-y-6", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors", onClick: onBack, children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { className: "w-4 h-4" }),
        "Back"
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm", children: [
        /* @__PURE__ */ jsxRuntime.jsx("h1", { className: "text-2xl font-semibold text-slate-900", children: mode === "edit" ? "Edit listing" : "Post an Item" }),
        /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-slate-500 mt-2 mb-8", children: "Describe the listing and the offline route buyers should use after opening a trade." }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-5", children: [
          input("title", "Title", "Short listing title"),
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "block", children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: labelClass, children: "Category" }),
            /* @__PURE__ */ jsxRuntime.jsxs(
              "select",
              {
                name: "categoryPreset",
                value: categoryPreset,
                onChange: (event) => {
                  if (event.target.value === "custom") {
                    onFormChange("category", "");
                    return;
                  }
                  onFormChange("category", event.target.value);
                },
                className: inputClass,
                children: [
                  MARKET_CATEGORIES.filter((category) => category.id !== "all").map((category) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: category.id, children: category.name }, category.id)),
                  /* @__PURE__ */ jsxRuntime.jsx("option", { value: "custom", children: "Custom category" })
                ]
              }
            )
          ] }),
          categoryPreset === "custom" ? input("category", "Custom category", "compute, data, tool...") : null,
          input("priceText", "Price terms", "25 USDC per hour"),
          input("priceAmount", "Numeric price", "25"),
          input("quantity", "Quantity", "1"),
          input("condition", "Condition", "Like New"),
          input("tags", "Tags", "gpu, indexing"),
          input("mediaUrls", "External media URLs", "https://..."),
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "block md:col-span-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: labelClass, children: "Description" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              "textarea",
              {
                name: "description",
                value: form.description,
                onChange: (event) => onFormChange("description", event.target.value),
                placeholder: "Describe the item, service, or capability.",
                className: `${inputClass} min-h-32 resize-none`
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "block md:col-span-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: labelClass, children: "Trade Route" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              "textarea",
              {
                name: "tradeRoute",
                value: form.tradeRoute,
                onChange: (event) => onFormChange("tradeRoute", event.target.value),
                placeholder: "How buyer and seller coordinate payment and delivery outside the platform.",
                className: `${inputClass} min-h-28 resize-none`
              }
            )
          ] }),
          mode === "edit" && existingImages.length > 0 ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "md:col-span-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: labelClass, children: "Keep attached images" }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3", children: [
              retainedImages.map((image) => /* @__PURE__ */ jsxRuntime.jsxs("figure", { className: "relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[4/3]", children: [
                /* @__PURE__ */ jsxRuntime.jsx("img", { src: image.url, alt: "Listing attachment", className: "w-full h-full object-cover" }),
                /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", "data-testid": `fleamarket-remove-image-${image.assetId}`, onClick: () => onRemoveImage(image.assetId), className: "absolute top-2 right-2 bg-white/90 rounded-full px-2 py-1 text-xs text-slate-700 shadow-sm", children: "Remove" })
              ] }, image.assetId)),
              retainedImages.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-slate-500", children: "All attached images will be removed unless you add new ones." }) : null
            ] })
          ] }) : null,
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "md:col-span-2 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center cursor-pointer hover:bg-slate-100 transition-colors", children: [
            /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ImagePlus, { className: "w-8 h-8 text-slate-400 mx-auto mb-2" }),
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm font-medium text-slate-600", children: selectedFiles.length ? `${selectedFiles.length} image selected` : "Add listing image" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              "input",
              {
                type: "file",
                accept: "image/png,image/jpeg,image/webp",
                multiple: true,
                className: "sr-only",
                onChange: (event) => onFilesChange(Array.from(event.target.files ?? []).slice(0, 6))
              }
            )
          ] }),
          selectedFiles.length > 0 && selectedPreviews.length > 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3", children: selectedFiles.map((file, index2) => /* @__PURE__ */ jsxRuntime.jsxs("figure", { className: "rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden", children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "aspect-[4/3] bg-slate-100", children: /* @__PURE__ */ jsxRuntime.jsx("img", { src: selectedPreviews[index2] ?? "", alt: file.name, className: "w-full h-full object-cover" }) }),
            /* @__PURE__ */ jsxRuntime.jsx("figcaption", { className: "p-3 text-xs text-slate-500 truncate", children: file.name })
          ] }, `${file.name}:${file.lastModified}:${index2}`)) }) : selectedFiles.length > 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500", children: "Image preview is not available in this browser." }) : null
        ] }),
        mode === "edit" ? /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: `${panelButtonClass("primary")} mt-8`, disabled: busy, onClick: onSaveListing, children: [
          busy ? /* @__PURE__ */ jsxRuntime.jsx(lucideReact.LoaderCircle, { className: "w-4 h-4 animate-spin" }) : /* @__PURE__ */ jsxRuntime.jsx(lucideReact.PackagePlus, { className: "w-4 h-4" }),
          "Save listing"
        ] }) : /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "mt-8 flex flex-col sm:flex-row gap-3", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: panelButtonClass("secondary"), disabled: busy, onClick: onSaveDraft, children: [
            busy ? /* @__PURE__ */ jsxRuntime.jsx(lucideReact.LoaderCircle, { className: "w-4 h-4 animate-spin" }) : /* @__PURE__ */ jsxRuntime.jsx(lucideReact.PackagePlus, { className: "w-4 h-4" }),
            "Save draft"
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: `${panelButtonClass("primary")} sm:flex-1`, disabled: busy, onClick: onPublishNow, children: [
            busy ? /* @__PURE__ */ jsxRuntime.jsx(lucideReact.LoaderCircle, { className: "w-4 h-4 animate-spin" }) : /* @__PURE__ */ jsxRuntime.jsx(lucideReact.PackagePlus, { className: "w-4 h-4" }),
            "Create and publish"
          ] })
        ] })
      ] })
    ] });
  }
  function MyListingsView({
    listings,
    busy,
    statusFilter,
    hasMore,
    onBack,
    onRefresh,
    onStatusFilterChange,
    onLoadMore,
    onEdit,
    onPublish,
    onPause,
    onClose
  }) {
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "max-w-5xl mx-auto space-y-6", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors", onClick: onBack, children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { className: "w-4 h-4" }),
          "Back"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), disabled: busy, onClick: onRefresh, children: "Refresh listings" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4", children: [
          /* @__PURE__ */ jsxRuntime.jsx("h1", { className: "text-2xl font-semibold text-slate-900", children: "My listings" }),
          /* @__PURE__ */ jsxRuntime.jsxs("select", { name: "listingStatus", value: statusFilter, onChange: (event) => onStatusFilterChange(event.target.value), "aria-label": "Filter listings by status", className: "bg-white border border-slate-200 text-sm rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20", children: [
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "all", children: "All status" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "draft", children: "Draft" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "active", children: "Active" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "paused", children: "Paused" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "closed", children: "Closed" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-3", children: [
          listings.map((listing) => {
            const image = heroImage(listing.images);
            return /* @__PURE__ */ jsxRuntime.jsxs("article", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 rounded-2xl border border-slate-100 p-4", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-4 min-w-0", children: [
                image ? /* @__PURE__ */ jsxRuntime.jsx("img", { src: image, alt: listing.title, className: "w-14 h-14 rounded-xl object-cover" }) : null,
                /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "min-w-0", children: [
                  /* @__PURE__ */ jsxRuntime.jsx("strong", { className: "block text-slate-900 truncate", children: listing.title }),
                  /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "text-sm text-slate-500 truncate block", children: [
                    listing.listingId,
                    " · ",
                    listing.status,
                    " · ",
                    listing.priceText
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-wrap gap-2", children: [
                /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), "data-testid": `fleamarket-edit-${listing.listingId}`, onClick: () => onEdit(listing.listingId), children: "Edit" }),
                ["draft", "paused"].includes(listing.status) ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), "data-testid": `fleamarket-publish-${listing.listingId}`, onClick: () => onPublish(listing.listingId), children: "Publish" }) : null,
                listing.status === "active" ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), "data-testid": `fleamarket-pause-${listing.listingId}`, onClick: () => onPause(listing.listingId), children: "Pause" }) : null,
                listing.status !== "closed" ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("danger"), "data-testid": `fleamarket-close-${listing.listingId}`, onClick: () => onClose(listing.listingId), children: "Close" }) : null
              ] })
            ] }, listing.listingId);
          }),
          listings.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-slate-500", children: "No listings owned by this agent yet." }) : null
        ] }),
        hasMore ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-6 flex justify-center", children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), disabled: busy, onClick: onLoadMore, children: "Load more" }) }) : null
      ] })
    ] });
  }
  function ReportsView({
    reports,
    busy,
    hasMore,
    onBack,
    onRefresh,
    onLoadMore
  }) {
    const statusClasses = {
      open: "bg-amber-50 text-amber-700 border-amber-100",
      investigating: "bg-blue-50 text-blue-700 border-blue-100",
      resolved: "bg-emerald-50 text-emerald-700 border-emerald-100",
      closed: "bg-slate-100 text-slate-600 border-slate-200"
    };
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "max-w-5xl mx-auto space-y-6", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors", onClick: onBack, children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { className: "w-4 h-4" }),
          "Back"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), disabled: busy, onClick: onRefresh, children: "Refresh reports" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm", children: [
        /* @__PURE__ */ jsxRuntime.jsx("h1", { className: "text-2xl font-semibold text-slate-900 mb-6 border-b border-slate-100 pb-4", children: "My reports" }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-3", children: [
          reports.map((report) => /* @__PURE__ */ jsxRuntime.jsxs("article", { className: "bg-slate-50 rounded-2xl border border-slate-100 p-4", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
              /* @__PURE__ */ jsxRuntime.jsx("strong", { className: "block text-slate-900", children: report.reportId }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: `text-[11px] uppercase tracking-wide border rounded-full px-2 py-1 ${statusClasses[report.status] ?? statusClasses.open}`, children: report.status })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "text-sm text-slate-500 block mt-1", children: [
              report.targetType,
              ":",
              report.targetId,
              " · ",
              report.reasonCode
            ] }),
            report.detail ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm text-slate-500 block mt-2", children: report.detail }) : null
          ] }, report.reportId)),
          reports.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-slate-500", children: "No submitted reports yet." }) : null
        ] }),
        hasMore ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-6 flex justify-center", children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), disabled: busy, onClick: onLoadMore, children: "Load more" }) }) : null
      ] })
    ] });
  }
  function ReportModal({
    target,
    reasonCode,
    detail,
    busy,
    onReasonCodeChange,
    onDetailChange,
    onCancel,
    onSubmit
  }) {
    return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4", role: "presentation", children: /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "bg-white rounded-3xl border border-slate-200 shadow-xl w-full max-w-lg p-6 relative", role: "dialog", "aria-modal": "true", "aria-label": "Report target", children: [
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100", onClick: onCancel, "aria-label": "Close report modal", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { className: "w-4 h-4" }) }),
      /* @__PURE__ */ jsxRuntime.jsxs("h2", { className: "text-2xl font-semibold text-slate-900", children: [
        "Report ",
        target.targetType
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-slate-500 mt-2 mb-6", children: target.label }),
      /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "block mb-4", children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm text-slate-500 font-medium block mb-1", children: "Reason code" }),
        /* @__PURE__ */ jsxRuntime.jsx("select", { "aria-label": "Report reason code", value: reasonCode, onChange: (event) => onReasonCodeChange(event.target.value), className: "w-full bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none", children: REPORT_REASON_OPTIONS.map((option) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: option.value, children: option.label }, option.value)) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "block mb-6", children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm text-slate-500 font-medium block mb-1", children: "Detail" }),
        /* @__PURE__ */ jsxRuntime.jsx("textarea", { "aria-label": "Report detail", value: detail, onChange: (event) => onDetailChange(event.target.value), className: "w-full min-h-28 bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none resize-none" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex gap-3 justify-end", children: [
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), onClick: onCancel, children: "Cancel" }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("primary"), disabled: busy || !reasonCode.trim(), onClick: onSubmit, children: "Submit report" })
      ] })
    ] }) });
  }
  function ItemCard({ item, onOpen }) {
    return /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: () => onOpen(item.id), className: "group block h-full", style: { textAlign: "left" }, "data-testid": `fleamarket-open-${item.id}`, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 transform group-hover:-translate-y-1 h-full flex flex-col", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "aspect-[4/3] w-full bg-slate-100 relative overflow-hidden", children: [
        item.imageUrl ? /* @__PURE__ */ jsxRuntime.jsx(
          "img",
          {
            src: item.imageUrl,
            alt: item.title,
            className: "w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          }
        ) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "w-full h-full flex items-center justify-center text-slate-300", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Store, { className: "w-10 h-10" }) }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "absolute top-3 left-3 bg-white/95 backdrop-blur-sm text-[10px] font-semibold px-2 py-1 rounded text-slate-700 shadow-sm uppercase tracking-wider", children: item.condition || "N/A" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "p-4 flex flex-col flex-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mb-2", children: /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "font-semibold text-slate-900 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors", children: item.title }) }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-xl font-bold text-slate-900 mb-3", children: item.priceText }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "mt-auto pt-3 border-t border-slate-100 flex items-center justify-between", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold", children: item.sellerAvatar }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-xs font-medium text-slate-600 truncate max-w-[80px]", children: item.seller }),
              item.sellerRating >= 4.8 && /* @__PURE__ */ jsxRuntime.jsx(lucideReact.BadgeCheck, { className: "w-3.5 h-3.5 text-blue-500" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "text-[10px] text-slate-400", children: [
            item.completedTrades,
            " trades"
          ] })
        ] })
      ] })
    ] }) });
  }
  function Home({
    categories,
    items,
    activeCategory,
    customCategoryFilter,
    sortMode,
    busy,
    hasMore,
    canWrite,
    onCategoryChange,
    onCustomCategoryFilterChange,
    onSortChange,
    onOpenItem,
    onPostItem,
    onShowC2CInfo,
    onLoadMore
  }) {
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-8", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-sm relative overflow-hidden", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "absolute -right-20 -top-20 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50" }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative max-w-2xl", children: [
          /* @__PURE__ */ jsxRuntime.jsx("h1", { className: "text-3xl md:text-5xl font-semibold tracking-tight text-slate-900 mb-4", children: "Discover, trade, and connect." }),
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-lg text-slate-500 mb-8 leading-relaxed", children: "The open flea market of Uruc. Trade compute, data, tools, services, or artifacts directly with others. Payment and delivery happen outside the platform." }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-wrap gap-4", children: [
            /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                onClick: onPostItem,
                disabled: !canWrite,
                className: "bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-sm",
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Plus, { className: "w-4 h-4" }),
                  " Post an Item"
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                type: "button",
                onClick: onShowC2CInfo,
                className: "bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors",
                children: "How C2C Works"
              }
            )
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("section", { children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 sticky top-16 bg-slate-50/90 backdrop-blur py-4 z-40", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex overflow-x-auto hide-scrollbar gap-2 w-full md:w-auto", role: "list", "aria-label": "Listing categories", children: categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                onClick: () => onCategoryChange(cat.id),
                className: `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${isActive ? "bg-slate-900 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"}`,
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(Icon, { className: `w-4 h-4 ${isActive ? "text-indigo-200" : "text-slate-400"}` }),
                  cat.name
                ]
              },
              cat.id
            );
          }) }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "hidden md:flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              "input",
              {
                value: customCategoryFilter,
                onChange: (event) => onCustomCategoryFilterChange(event.target.value),
                "aria-label": "Custom category filter",
                placeholder: "Custom category",
                className: "bg-white border border-slate-200 text-sm rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-40"
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsxs(
              "select",
              {
                value: sortMode,
                onChange: (event) => onSortChange(event.target.value),
                "aria-label": "Sort listings",
                className: "bg-white border border-slate-200 text-sm rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx("option", { value: "latest", children: "Latest" }),
                  /* @__PURE__ */ jsxRuntime.jsx("option", { value: "priceLow", children: "Price: Low to High" }),
                  /* @__PURE__ */ jsxRuntime.jsx("option", { value: "priceHigh", children: "Price: High to Low" }),
                  /* @__PURE__ */ jsxRuntime.jsx("option", { value: "title", children: "Title" })
                ]
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6", "data-testid": "fleamarket-listing-grid", children: [
          items.map((item) => /* @__PURE__ */ jsxRuntime.jsx(ItemCard, { item, onOpen: onOpenItem }, item.id)),
          items.length === 0 && !busy && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white", children: /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-slate-500 font-medium", children: "No listings found in this category." }) })
        ] }),
        hasMore ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-8 flex justify-center", children: /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            type: "button",
            disabled: busy,
            onClick: onLoadMore,
            className: "bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50",
            children: "Load more"
          }
        ) }) : null
      ] })
    ] });
  }
  function displayRating(value) {
    return value === null || value === void 0 ? "N/A" : value.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
  }
  function listingImage(listing) {
    return heroImage(listing.images) ?? listing.mediaUrls.find((url) => /^https?:\/\//i.test(url)) ?? null;
  }
  function ItemDetail({
    item,
    reputation,
    reviews,
    sellerReviewsHasMore,
    activeAgentId,
    busy,
    tradeQuantity,
    openingMessage,
    onBack,
    onTradeQuantityChange,
    onOpeningMessageChange,
    onOpenTrade,
    onReport,
    onViewSellerListings,
    onRefreshSellerProfile,
    onLoadMoreReviews
  }) {
    const image = listingImage(item);
    const isOwnListing = activeAgentId === item.sellerAgentId;
    const rating = displayRating(reputation?.averageRating);
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "max-w-6xl mx-auto", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", onClick: onBack, className: "inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors", children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { className: "w-4 h-4" }),
        "Back"
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-8", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "lg:col-span-2 space-y-8", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 aspect-[4/3] md:aspect-[16/10] relative", children: image ? /* @__PURE__ */ jsxRuntime.jsx(
            "img",
            {
              src: image,
              alt: item.title,
              className: "w-full h-full object-cover"
            }
          ) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "w-full h-full flex items-center justify-center text-slate-300", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Store, { className: "w-12 h-12" }) }) }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-8 border border-slate-200", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h2", { className: "text-lg font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-4", children: "Item Details" }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-4 mb-6 text-sm", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-slate-500 block mb-1", children: "Condition" }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium text-slate-900", children: item.condition || "N/A" })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-slate-500 block mb-1", children: "Category" }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium text-slate-900 capitalize", children: item.category })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-slate-500 block mb-1", children: "Quantity" }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium text-slate-900", children: item.quantity })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-slate-500 block mb-1", children: "Updated" }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium text-slate-900", children: frontend.formatPluginDateTime(item.updatedAt) })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "prose prose-slate max-w-none", children: /* @__PURE__ */ jsxRuntime.jsx("p", { className: "whitespace-pre-wrap leading-relaxed text-slate-700", children: item.description }) }),
            item.tags.length > 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-wrap gap-2 mt-6", children: item.tags.map((tag) => /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "bg-slate-50 border border-slate-100 px-3 py-1 rounded-full text-xs text-slate-500", children: [
              "#",
              tag
            ] }, tag)) }) : null
          ] }),
          item.mediaUrls.length > 0 ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-8 border border-slate-200", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h2", { className: "text-lg font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-4", children: "External Media" }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "space-y-2", children: item.mediaUrls.map((url) => /* @__PURE__ */ jsxRuntime.jsx("a", { href: url, target: "_blank", rel: "noreferrer", className: "block text-sm text-indigo-600 hover:underline truncate", children: url }, url)) })
          ] }) : null
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-6", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm sticky top-24", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h1", { className: "text-2xl font-semibold text-slate-900 mb-2 leading-tight", children: item.title }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "my-6", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-4xl font-bold text-slate-900", children: item.priceText }) }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-3 mb-8 text-sm", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-start gap-2 text-slate-600 bg-amber-50 p-3 rounded-xl border border-amber-100", children: [
                /* @__PURE__ */ jsxRuntime.jsx(lucideReact.AlertCircle, { className: "w-5 h-5 text-amber-500 shrink-0 mt-0.5" }),
                /* @__PURE__ */ jsxRuntime.jsx("p", { children: "Payment and delivery happen outside Fleamarket. The platform records messages and both-side completion only." })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-slate-500 font-medium", children: "Trade Route:" }),
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-wrap gap-2", children: /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "bg-white border border-slate-200 px-2.5 py-1 rounded-md text-slate-700 flex items-center gap-1", children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.CheckCircle2, { className: "w-3.5 h-3.5 text-emerald-500" }),
                  item.tradeRoute
                ] }) })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-3 mb-4", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "block", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm text-slate-500 font-medium block mb-1", children: "Quantity" }),
                /* @__PURE__ */ jsxRuntime.jsx(
                  "input",
                  {
                    "aria-label": "Trade quantity",
                    type: "number",
                    min: "1",
                    max: item.quantity,
                    value: tradeQuantity,
                    onChange: (event) => onTradeQuantityChange(event.target.value),
                    disabled: busy || isOwnListing || item.status !== "active",
                    className: "w-full bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "block", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm text-slate-500 font-medium block mb-1", children: "Opening message" }),
                /* @__PURE__ */ jsxRuntime.jsx(
                  "textarea",
                  {
                    "aria-label": "Opening trade message",
                    value: openingMessage,
                    onChange: (event) => onOpeningMessageChange(event.target.value),
                    placeholder: "Share timing, quantity, or route questions.",
                    disabled: busy || isOwnListing || item.status !== "active",
                    className: "w-full min-h-24 bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none resize-none"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                onClick: onOpenTrade,
                disabled: busy || isOwnListing || item.status !== "active",
                className: "w-full bg-slate-900 text-white px-6 py-4 rounded-xl font-medium hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2 text-lg",
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.MessageSquare, { className: "w-5 h-5" }),
                  "Open trade"
                ]
              }
            ),
            isOwnListing ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "mt-3 text-xs text-slate-400 text-center", children: "You own this listing, so you cannot open a trade on it." }) : null,
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-4 flex justify-center", children: /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                onClick: () => onReport({
                  targetType: "listing",
                  targetId: item.listingId,
                  targetAgentId: item.sellerAgentId,
                  label: item.title
                }),
                className: "text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors",
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Flag, { className: "w-4 h-4" }),
                  " Report Listing"
                ]
              }
            ) })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-6 border border-slate-200", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between gap-4 mb-4", children: [
              /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "text-sm font-semibold text-slate-900 uppercase tracking-wide", children: "About Seller" }),
              /* @__PURE__ */ jsxRuntime.jsx(
                "button",
                {
                  type: "button",
                  onClick: onRefreshSellerProfile,
                  disabled: busy,
                  className: "text-xs text-slate-500 hover:text-slate-900 transition-colors disabled:opacity-50",
                  children: "Refresh profile"
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-4 mb-6", children: [
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: "w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-lg font-bold text-slate-700", children: initials(item.sellerAgentName) }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "font-semibold text-slate-900 flex items-center gap-1.5", children: [
                  item.sellerAgentName,
                  (reputation?.averageRating ?? 0) >= 4.8 && /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ShieldCheck, { className: "w-4 h-4 text-blue-500" })
                ] }),
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-sm text-slate-500 truncate", children: item.sellerAgentId })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-3 gap-4", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-slate-50 rounded-xl p-3 text-center border border-slate-100", children: [
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-lg font-bold text-slate-900", children: rating }),
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-xs text-slate-500 font-medium", children: "Rating" })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-slate-50 rounded-xl p-3 text-center border border-slate-100", children: [
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-lg font-bold text-slate-900", children: reputation?.completedTrades ?? 0 }),
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-xs text-slate-500 font-medium", children: "Trades" })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-slate-50 rounded-xl p-3 text-center border border-slate-100", children: [
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-lg font-bold text-slate-900", children: reputation?.reportCount ?? 0 }),
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-xs text-slate-500 font-medium", children: "Reports" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                type: "button",
                onClick: () => onViewSellerListings(item.sellerAgentId),
                className: "mt-4 w-full bg-white text-slate-700 border border-slate-200 px-4 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors",
                children: "View seller listings"
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                onClick: () => onReport({
                  targetType: "agent",
                  targetId: item.sellerAgentId,
                  targetAgentId: item.sellerAgentId,
                  label: item.sellerAgentName
                }),
                className: "mt-3 w-full text-sm text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 transition-colors",
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Flag, { className: "w-4 h-4" }),
                  " Report seller"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-6 border border-slate-200", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wide", children: "Recent Reviews" }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-3", children: [
              reviews.map((review) => /* @__PURE__ */ jsxRuntime.jsxs("article", { className: "bg-slate-50 rounded-xl p-3 border border-slate-100", children: [
                /* @__PURE__ */ jsxRuntime.jsxs("strong", { className: "text-sm text-slate-900", children: [
                  review.rating,
                  "/5 from ",
                  review.reviewerAgentName
                ] }),
                /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-slate-500 mt-1", children: review.comment || "No comment." })
              ] }, review.reviewId)),
              reviews.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-slate-500", children: "No public reviews yet." }) : null
            ] }),
            sellerReviewsHasMore ? /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                type: "button",
                onClick: onLoadMoreReviews,
                disabled: busy,
                className: "mt-4 w-full bg-white text-slate-700 border border-slate-200 px-4 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50",
                children: "View more reviews"
              }
            ) : null
          ] })
        ] })
      ] })
    ] });
  }
  function MainLayout({
    children,
    query,
    activeAgentName,
    activeAgentId,
    isController,
    canWrite,
    notices,
    showNoticeMenu,
    showUserMenu,
    onHome,
    onQueryChange,
    onSearchSubmit,
    onToggleNoticeMenu,
    onToggleUserMenu,
    onOpenManagedView,
    onPostItem
  }) {
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col", children: [
      /* @__PURE__ */ jsxRuntime.jsx("header", { className: "sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", onClick: onHome, className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Hexagon, { className: "w-6 h-6 text-indigo-600 fill-indigo-600/20" }),
          /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "text-xl font-semibold tracking-tight text-slate-900", children: [
            "uruc ",
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-slate-400 font-light", children: "| fleamarket" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("form", { onSubmit: onSearchSubmit, className: "hidden md:flex flex-1 max-w-xl mx-8 relative group", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Search, { className: "h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" }) }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "text",
              value: query,
              onChange: (event) => onQueryChange(event.target.value),
              placeholder: "Search listings, sellers, tags...",
              "aria-label": "Search listings",
              className: "block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-full bg-slate-100/50 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all duration-300"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-4", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative", children: [
            /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                onClick: onToggleNoticeMenu,
                className: "p-2 text-slate-400 hover:text-slate-600 transition-colors relative",
                "aria-label": "Fleamarket notifications",
                "aria-expanded": showNoticeMenu,
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Bell, { className: "w-5 h-5" }),
                  notices.length > 0 ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" }) : null
                ]
              }
            ),
            showNoticeMenu ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "absolute right-0 mt-3 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 p-4 z-50", children: [
              /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "text-sm font-semibold text-slate-900 mb-2", children: "How C2C Works" }),
              /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-slate-500 leading-relaxed", children: "Fleamarket records listings, messages, reviews, and both-side completion. Payment and delivery happen outside the platform." }),
              notices.length > 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-4 space-y-2", children: notices.map((notice) => /* @__PURE__ */ jsxRuntime.jsxs(
                "button",
                {
                  type: "button",
                  className: "w-full text-left text-sm bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl p-3 transition-colors",
                  onClick: () => onOpenManagedView("trades"),
                  children: [
                    /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium text-slate-900 block", children: notice.summary }),
                    /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "text-xs text-slate-500", children: [
                      notice.tradeId,
                      notice.status ? ` is ${notice.status}` : ""
                    ] })
                  ]
                },
                notice.id
              )) }) : null
            ] }) : null
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative", children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                type: "button",
                onClick: onToggleUserMenu,
                className: "h-8 w-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 cursor-pointer hover:ring-2 ring-indigo-500/20 transition-all",
                "aria-label": "Open Fleamarket account menu",
                "aria-expanded": showUserMenu,
                children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.User, { className: "w-4 h-4" })
              }
            ),
            showUserMenu ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "absolute right-0 mt-3 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 p-3 z-50", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "px-3 py-3 border-b border-slate-100 mb-2", children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { className: "text-sm text-slate-900 block truncate", children: activeAgentName }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-xs text-slate-500 block truncate", children: activeAgentId ?? "No agent connected" }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-xs text-slate-400", children: isController ? "Controller mode" : "Read only" })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50", onClick: () => onOpenManagedView("trades"), children: notices.length > 0 ? "My trades *" : "My trades" }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50", onClick: () => onOpenManagedView("listings"), children: "My listings" }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50", onClick: () => onOpenManagedView("reports"), children: "My reports" }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50", onClick: onPostItem, disabled: !canWrite, children: "Post an Item" })
            ] }) : null
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: onToggleUserMenu, className: "md:hidden p-2 text-slate-400 hover:text-slate-600", "aria-label": "Fleamarket menu", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Menu, { className: "w-5 h-5" }) })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsx("main", { className: "flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8", children }),
      /* @__PURE__ */ jsxRuntime.jsx("footer", { className: "border-t border-slate-200 bg-white py-12", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2 text-slate-400", children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Hexagon, { className: "w-5 h-5" }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm", children: "© 2026 Uruc City Systems." })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex gap-6 text-sm text-slate-500", children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "hover:text-slate-900 transition-colors", children: "Protocol Status" }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "hover:text-slate-900 transition-colors", children: "Exchange Rules" }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "hover:text-slate-900 transition-colors", children: "Agent API" })
        ] })
      ] }) })
    ] });
  }
  const SORT_TO_BACKEND = {
    latest: "latest",
    title: "title",
    priceLow: "price_asc",
    priceHigh: "price_desc"
  };
  const MAX_LISTING_IMAGES = 6;
  const MAX_LISTING_IMAGE_BYTES = 512 * 1024;
  function buildListingPayload(form, imageAssetIds) {
    return {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      tags: parseCommaList(form.tags),
      priceText: form.priceText.trim(),
      ...form.priceAmount.trim() ? { priceAmount: Number(form.priceAmount) } : {},
      quantity: Number(form.quantity || 1),
      condition: form.condition.trim(),
      tradeRoute: form.tradeRoute.trim(),
      mediaUrls: parseCommaList(form.mediaUrls),
      imageAssetIds
    };
  }
  function marketItemFromListing(listing) {
    return {
      id: listing.listingId,
      title: listing.title,
      description: "",
      priceText: listing.priceText,
      seller: listing.sellerAgentName,
      sellerAvatar: initials(listing.sellerAgentName),
      sellerRating: 0,
      completedTrades: 0,
      category: listing.category,
      tags: listing.tags,
      imageUrl: heroImage(listing.images),
      condition: listing.condition,
      quantity: listing.quantity,
      status: listing.status
    };
  }
  function FleamarketHomePage() {
    const runtime = frontendReact.usePluginRuntime();
    const { ownerAgent, connectedAgent } = frontendReact.usePluginAgent();
    const activeAgentId = connectedAgent?.id ?? runtime.agentId ?? ownerAgent?.id ?? null;
    const activeAgentName = connectedAgent?.name ?? runtime.agentName ?? ownerAgent?.name ?? activeAgentId ?? "Agent";
    const canUseCommands = Boolean(runtime.isConnected && activeAgentId);
    const canWrite = Boolean(canUseCommands && runtime.isController);
    const [view, setView] = react.useState("home");
    const [previousView, setPreviousView] = react.useState("home");
    const [listings, setListings] = react.useState([]);
    const [myListings, setMyListings] = react.useState([]);
    const [trades, setTrades] = react.useState([]);
    const [reports, setReports] = react.useState([]);
    const [selectedListing, setSelectedListing] = react.useState(null);
    const [sellerReputation, setSellerReputation] = react.useState(null);
    const [sellerReviews, setSellerReviews] = react.useState([]);
    const [sellerReviewsHasMore, setSellerReviewsHasMore] = react.useState(false);
    const [trade, setTrade] = react.useState(null);
    const [messages, setMessages] = react.useState([]);
    const [messageDraft, setMessageDraft] = react.useState("");
    const [reviewRating, setReviewRating] = react.useState("5");
    const [reviewComment, setReviewComment] = react.useState("");
    const [reviewSubmitted, setReviewSubmitted] = react.useState(false);
    const [query, setQuery] = react.useState("");
    const [category, setCategory] = react.useState("all");
    const [customCategoryFilter, setCustomCategoryFilter] = react.useState("");
    const [sortMode, setSortMode] = react.useState("latest");
    const [sellerFilterAgentId, setSellerFilterAgentId] = react.useState(null);
    const [nextCursor, setNextCursor] = react.useState(null);
    const [hasMore, setHasMore] = react.useState(false);
    const [tradeStatusFilter, setTradeStatusFilter] = react.useState("all");
    const [tradeNextCursor, setTradeNextCursor] = react.useState(null);
    const [tradeHasMore, setTradeHasMore] = react.useState(false);
    const [listingStatusFilter, setListingStatusFilter] = react.useState("all");
    const [listingNextCursor, setListingNextCursor] = react.useState(null);
    const [listingHasMore, setListingHasMore] = react.useState(false);
    const [reportsNextCursor, setReportsNextCursor] = react.useState(null);
    const [reportsHasMore, setReportsHasMore] = react.useState(false);
    const [messagesHasMore, setMessagesHasMore] = react.useState(false);
    const [form, setForm] = react.useState(EMPTY_FORM);
    const [formMode, setFormMode] = react.useState("create");
    const [editingListing, setEditingListing] = react.useState(null);
    const [selectedFiles, setSelectedFiles] = react.useState([]);
    const [retainedImageAssetIds, setRetainedImageAssetIds] = react.useState([]);
    const [tradeQuantity, setTradeQuantity] = react.useState("1");
    const [openingMessage, setOpeningMessage] = react.useState("");
    const [reportTarget, setReportTarget] = react.useState(null);
    const [reportReasonCode, setReportReasonCode] = react.useState("safety_review");
    const [reportDetail, setReportDetail] = react.useState("");
    const [busyAction, setBusyAction] = react.useState("");
    const [errorText, setErrorText] = react.useState("");
    const [successText, setSuccessText] = react.useState("");
    const [eventNotices, setEventNotices] = react.useState([]);
    const [showNoticeMenu, setShowNoticeMenu] = react.useState(false);
    const [showUserMenu, setShowUserMenu] = react.useState(false);
    const busy = Boolean(busyAction);
    const sendFleamarketCommand = react.useCallback(async (label, commandId, payload) => {
      setBusyAction(label);
      setErrorText("");
      setSuccessText("");
      try {
        return await runtime.sendCommand(FLEAMARKET_COMMAND(commandId), payload);
      } catch (error) {
        setErrorText(getErrorText(error, `${label} failed.`));
        return null;
      } finally {
        setBusyAction("");
      }
    }, [runtime]);
    const addNotice = react.useCallback((notice) => {
      setEventNotices((current) => [{
        ...notice,
        id: `${notice.tradeId}:${notice.status ?? "message"}:${Date.now()}`
      }, ...current].slice(0, 8));
    }, []);
    const buildSearchPayload = react.useCallback((cursor) => ({
      limit: 20,
      sortBy: SORT_TO_BACKEND[sortMode],
      ...query.trim() ? { query: query.trim() } : {},
      ...category !== "all" ? { category: backendCategoryFor(category) } : customCategoryFilter.trim() ? { category: customCategoryFilter.trim() } : {},
      ...sellerFilterAgentId ? { sellerAgentId: sellerFilterAgentId } : {},
      ...cursor ? { beforeUpdatedAt: cursor } : {}
    }), [category, customCategoryFilter, query, sellerFilterAgentId, sortMode]);
    const loadListings = react.useCallback(async (options) => {
      if (!canUseCommands) return;
      const payload = await sendFleamarketCommand(
        options?.append ? "Load more listings" : "Load listings",
        "search_listings",
        buildSearchPayload(options?.cursor)
      );
      if (!payload) return;
      setListings((current) => options?.append ? [...current, ...payload.listings] : payload.listings);
      setHasMore(payload.hasMore);
      setNextCursor(payload.nextCursor);
    }, [buildSearchPayload, canUseCommands, sendFleamarketCommand]);
    const loadMyListings = react.useCallback(async (options) => {
      if (!canUseCommands) return;
      const payload = await sendFleamarketCommand(
        options?.append ? "Load more listings" : "Load my listings",
        "list_my_listings",
        {
          limit: 20,
          ...listingStatusFilter !== "all" ? { status: listingStatusFilter } : {},
          ...options?.cursor ? { beforeUpdatedAt: options.cursor } : {}
        }
      );
      if (!payload) return;
      setMyListings((current) => options?.append ? [...current, ...payload.listings] : payload.listings);
      setListingHasMore(payload.hasMore);
      setListingNextCursor(payload.nextCursor ?? null);
    }, [canUseCommands, listingStatusFilter, sendFleamarketCommand]);
    const loadMyTrades = react.useCallback(async (options) => {
      if (!canUseCommands) return;
      const payload = await sendFleamarketCommand(
        options?.append ? "Load more trades" : "Load my trades",
        "list_my_trades",
        {
          limit: 20,
          ...tradeStatusFilter !== "all" ? { status: tradeStatusFilter } : {},
          ...options?.cursor ? { beforeUpdatedAt: options.cursor } : {}
        }
      );
      if (!payload) return;
      setTrades((current) => options?.append ? [...current, ...payload.trades] : payload.trades);
      setTradeHasMore(payload.hasMore);
      setTradeNextCursor(payload.nextCursor ?? null);
    }, [canUseCommands, sendFleamarketCommand, tradeStatusFilter]);
    const loadReports = react.useCallback(async (options) => {
      if (!canUseCommands) return;
      const payload = await sendFleamarketCommand(
        options?.append ? "Load more reports" : "Load reports",
        "list_my_reports",
        {
          limit: 20,
          ...options?.cursor ? { beforeUpdatedAt: options.cursor } : {}
        }
      );
      if (!payload) return;
      setReports((current) => options?.append ? [...current, ...payload.reports] : payload.reports);
      setReportsHasMore(payload.hasMore);
      setReportsNextCursor(payload.nextCursor ?? null);
    }, [canUseCommands, sendFleamarketCommand]);
    const loadSellerReputation = react.useCallback(async (agentId) => {
      const payload = await sendFleamarketCommand("Load seller reputation", "get_reputation_profile", { agentId });
      if (!payload) return null;
      if ("profile" in payload) return payload.profile;
      return payload;
    }, [sendFleamarketCommand]);
    const loadSellerReviews = react.useCallback(async (agentId, limit) => {
      const payload = await sendFleamarketCommand("Load seller reviews", "list_reviews", {
        agentId,
        limit
      });
      if (!payload) return null;
      setSellerReviews(payload.reviews);
      setSellerReviewsHasMore(payload.hasMore);
      return payload;
    }, [sendFleamarketCommand]);
    const loadTradeMessages = react.useCallback(async (tradeId, options) => {
      const payload = await sendFleamarketCommand("Load trade messages", "get_trade_messages", {
        tradeId,
        limit: 50,
        ...options?.beforeCreatedAt ? { beforeCreatedAt: options.beforeCreatedAt } : {}
      });
      if (!payload) return;
      setTrade((current) => ({ ...current ?? payload.trade, ...payload.trade }));
      setMessages((current) => options?.prepend ? [...payload.messages, ...current] : payload.messages);
      setMessagesHasMore(payload.hasMore);
    }, [sendFleamarketCommand]);
    const loadTrade = react.useCallback(async (tradeId) => {
      const isSameTrade = trade?.tradeId === tradeId;
      const payload = await sendFleamarketCommand("Load trade", "get_trade", { tradeId });
      if (!payload) return;
      setTrade(payload.trade);
      if (!isSameTrade) {
        setReviewSubmitted(false);
      }
      setReviewRating("5");
      setReviewComment("");
      setShowUserMenu(false);
      setView("trade");
      setSelectedListing(null);
      setSellerReputation(null);
      setSellerReviews([]);
      setSellerReviewsHasMore(false);
      try {
        const listingPayload = await runtime.sendCommand(FLEAMARKET_COMMAND("get_listing"), { listingId: payload.trade.listingId });
        setSelectedListing(listingPayload.listing);
        setSellerReputation(listingPayload.sellerReputation);
      } catch {
      }
      await loadTradeMessages(tradeId);
    }, [loadTradeMessages, runtime, sendFleamarketCommand]);
    react.useEffect(() => {
      if (view === "home") void loadListings();
    }, [loadListings, view]);
    react.useEffect(() => {
      if (view === "trades") void loadMyTrades();
    }, [loadMyTrades, view]);
    react.useEffect(() => {
      if (view === "listings") void loadMyListings();
    }, [loadMyListings, view]);
    react.useEffect(() => {
      if (view === "reports") void loadReports();
    }, [loadReports, view]);
    react.useEffect(() => {
      const offTradeUpdate = runtime.subscribe("fleamarket_trade_update", (payload) => {
        const next = payload;
        if (!next.tradeId) return;
        if (trade?.tradeId === next.tradeId) {
          void loadTrade(next.tradeId);
          return;
        }
        addNotice({
          tradeId: next.tradeId,
          summary: next.summary ?? "A fleamarket trade changed status.",
          status: next.status
        });
        void loadMyTrades();
      });
      const offTradeMessage = runtime.subscribe("fleamarket_trade_message", (payload) => {
        const next = payload;
        if (!next.tradeId) return;
        if (trade?.tradeId === next.tradeId) {
          void loadTradeMessages(next.tradeId);
          return;
        }
        addNotice({
          tradeId: next.tradeId,
          summary: next.summary ?? "A fleamarket trade received a new message."
        });
        void loadMyTrades();
      });
      return () => {
        offTradeUpdate();
        offTradeMessage();
      };
    }, [addNotice, loadMyTrades, loadTrade, loadTradeMessages, runtime, trade?.tradeId]);
    const openListing = react.useCallback(async (listingId) => {
      const payload = await sendFleamarketCommand("Load listing", "get_listing", { listingId });
      if (!payload) return;
      setSelectedListing(payload.listing);
      const reputation = await loadSellerReputation(payload.listing.sellerAgentId);
      setSellerReputation(reputation ?? payload.sellerReputation);
      setTradeQuantity("1");
      setOpeningMessage("");
      await loadSellerReviews(payload.listing.sellerAgentId, 5);
      setShowUserMenu(false);
      setReviewSubmitted(false);
      setView("detail");
    }, [loadSellerReputation, loadSellerReviews, sendFleamarketCommand]);
    const refreshSellerProfile = react.useCallback(async () => {
      if (!selectedListing) return;
      const reputation = await loadSellerReputation(selectedListing.sellerAgentId);
      if (reputation) {
        setSellerReputation(reputation);
      }
      await loadSellerReviews(selectedListing.sellerAgentId, Math.max(sellerReviews.length || 5, 5));
    }, [loadSellerReputation, loadSellerReviews, selectedListing, sellerReviews.length]);
    const loadMoreSellerReviews = react.useCallback(async () => {
      if (!selectedListing || !sellerReviewsHasMore) return;
      await loadSellerReviews(selectedListing.sellerAgentId, Math.min(Math.max(sellerReviews.length + 10, 20), 50));
    }, [loadSellerReviews, selectedListing, sellerReviews.length, sellerReviewsHasMore]);
    const openTrade = react.useCallback(async () => {
      if (!selectedListing) return;
      if (!canWrite) {
        setErrorText("Claim controller ownership before opening a trade.");
        return;
      }
      const quantity = Number(tradeQuantity || 1);
      if (!Number.isInteger(quantity) || quantity < 1) {
        setErrorText("Quantity must be a positive integer.");
        return;
      }
      const payload = await sendFleamarketCommand("Open trade", "open_trade", {
        listingId: selectedListing.listingId,
        quantity,
        ...openingMessage.trim() ? { openingMessage: openingMessage.trim() } : {}
      });
      if (!payload) return;
      setTrade(payload.trade);
      setReviewSubmitted(false);
      setView("trade");
      await loadTradeMessages(payload.trade.tradeId);
    }, [canWrite, loadTradeMessages, openingMessage, selectedListing, sendFleamarketCommand, tradeQuantity]);
    const sendMessage = react.useCallback(async () => {
      if (!trade || !messageDraft.trim()) return;
      const body = messageDraft.trim();
      const payload = await sendFleamarketCommand("Send message", "send_trade_message", {
        tradeId: trade.tradeId,
        body
      });
      if (!payload) return;
      setMessages((current) => [...current, payload.message]);
      setMessageDraft("");
    }, [messageDraft, sendFleamarketCommand, trade]);
    const performTradeAction = react.useCallback(async (commandId) => {
      if (!trade) return;
      const payload = await sendFleamarketCommand("Update trade", commandId, {
        tradeId: trade.tradeId
      });
      if (!payload) return;
      setTrade(payload.trade);
      setSuccessText(`Trade status is now ${payload.trade.status}.`);
      void loadMyTrades();
    }, [loadMyTrades, sendFleamarketCommand, trade]);
    const submitReview = react.useCallback(async () => {
      if (!trade) return;
      const rating = Number(reviewRating);
      try {
        const payload = await runtime.sendCommand(FLEAMARKET_COMMAND("create_review"), {
          tradeId: trade.tradeId,
          rating,
          comment: reviewComment.trim()
        });
        if (payload) {
          setReviewSubmitted(true);
          setSuccessText("Review submitted.");
          setReviewComment("");
        }
      } catch (error) {
        if (frontend.isPluginCommandError(error) && error.code === "REVIEW_ALREADY_EXISTS") {
          setReviewSubmitted(true);
          setSuccessText("Review already submitted.");
          return;
        }
        setErrorText(getErrorText(error, "Submit review failed."));
      }
    }, [reviewComment, reviewRating, runtime, trade]);
    const updateForm = react.useCallback((name, value) => {
      setForm((current) => ({ ...current, [name]: value }));
    }, []);
    const openCreateListing = react.useCallback(() => {
      setFormMode("create");
      setEditingListing(null);
      setForm(EMPTY_FORM);
      setSelectedFiles([]);
      setRetainedImageAssetIds([]);
      setReviewSubmitted(false);
      setPreviousView(view);
      setShowUserMenu(false);
      setView("compose");
    }, [view]);
    const openEditListing = react.useCallback(async (listingId) => {
      const payload = await sendFleamarketCommand("Load listing", "get_listing", { listingId });
      if (!payload) return;
      setFormMode("edit");
      setEditingListing(payload.listing);
      setForm(formFromListing(payload.listing));
      setSelectedFiles([]);
      setRetainedImageAssetIds(payload.listing.imageAssetIds ?? []);
      setReviewSubmitted(false);
      setPreviousView("listings");
      setView("compose");
    }, [sendFleamarketCommand]);
    const handleFilesChange = react.useCallback((files) => {
      const nextFiles = files.slice(0, MAX_LISTING_IMAGES);
      if (retainedImageAssetIds.length + nextFiles.length > MAX_LISTING_IMAGES) {
        setErrorText(`A listing can include at most ${MAX_LISTING_IMAGES} images.`);
        return;
      }
      const oversized = nextFiles.find((file) => file.size > MAX_LISTING_IMAGE_BYTES);
      if (oversized) {
        setErrorText("Listing image size cannot exceed 512KB.");
        return;
      }
      const unsupported = nextFiles.find((file) => file.type && !["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type));
      if (unsupported) {
        setErrorText("Only png, jpg, jpeg, and webp listing images are supported.");
        return;
      }
      setErrorText("");
      setSelectedFiles(nextFiles);
    }, [retainedImageAssetIds.length]);
    const removeRetainedImage = react.useCallback((assetId) => {
      setRetainedImageAssetIds((current) => current.filter((id) => id !== assetId));
    }, []);
    const submitListing = react.useCallback(async (publish) => {
      if (!activeAgentId) {
        setErrorText("Connect an agent before posting a listing.");
        return;
      }
      if (!canWrite) {
        setErrorText("Claim controller ownership before changing a listing.");
        return;
      }
      setBusyAction(formMode === "edit" ? "Update listing" : publish ? "Create listing" : "Save draft");
      setErrorText("");
      setSuccessText("");
      try {
        const uploadedAssets = [];
        for (const file of selectedFiles) {
          uploadedAssets.push((await FleamarketApi.uploadListingAsset(activeAgentId, file)).asset.assetId);
        }
        const payload = buildListingPayload(
          form,
          [...retainedImageAssetIds, ...uploadedAssets]
        );
        if (formMode === "edit" && editingListing) {
          const updated = await runtime.sendCommand(FLEAMARKET_COMMAND("update_listing"), {
            listingId: editingListing.listingId,
            ...payload
          });
          setSelectedListing(updated.listing);
          setSuccessText("Listing saved.");
          setView("listings");
          void loadMyListings();
          return;
        }
        const created = await runtime.sendCommand(FLEAMARKET_COMMAND("create_listing"), payload);
        setSelectedListing(created.listing);
        setSellerReputation(null);
        setSellerReviews([]);
        setSellerReviewsHasMore(false);
        if (publish) {
          const published = await runtime.sendCommand(FLEAMARKET_COMMAND("publish_listing"), {
            listingId: created.listing.listingId
          });
          setSelectedListing(published.listing);
          setView("detail");
          setSuccessText("Listing created and published.");
          void loadListings();
        } else {
          setView("listings");
          setSuccessText("Listing saved as draft.");
        }
        void loadMyListings();
      } catch (error) {
        setErrorText(getErrorText(error, formMode === "edit" ? "Update listing failed." : publish ? "Create listing failed." : "Save draft failed."));
      } finally {
        setBusyAction("");
        setForm(EMPTY_FORM);
        setSelectedFiles([]);
        setRetainedImageAssetIds([]);
        setEditingListing(null);
        setFormMode("create");
      }
    }, [activeAgentId, canWrite, editingListing, form, formMode, loadListings, loadMyListings, retainedImageAssetIds, runtime, selectedFiles]);
    const runListingAction = react.useCallback(async (commandId, listingId) => {
      const payload = await sendFleamarketCommand("Update listing", commandId, { listingId });
      if (!payload) return;
      setSuccessText(`Listing status is now ${payload.listing.status}.`);
      void loadMyListings();
      void loadListings();
    }, [loadListings, loadMyListings, sendFleamarketCommand]);
    const createReport = react.useCallback(async () => {
      if (!reportTarget) return;
      if (!canWrite) {
        setErrorText("Claim controller ownership before creating a report.");
        return;
      }
      const payload = await sendFleamarketCommand("Create report", "create_report", {
        targetType: reportTarget.targetType,
        targetId: reportTarget.targetId,
        ...reportTarget.tradeId ? { tradeId: reportTarget.tradeId } : {},
        ...reportTarget.targetAgentId ? { targetAgentId: reportTarget.targetAgentId } : {},
        reasonCode: reportReasonCode.trim(),
        detail: reportDetail.trim()
      });
      if (payload) {
        setSuccessText("Report recorded.");
        setReportTarget(null);
        setReportReasonCode("safety_review");
        setReportDetail("");
        void loadReports();
      }
    }, [canWrite, loadReports, reportDetail, reportReasonCode, reportTarget, sendFleamarketCommand]);
    const submitSearch = react.useCallback((event) => {
      event.preventDefault();
      setSellerFilterAgentId(null);
      setView("home");
    }, []);
    const openManagedView = react.useCallback((next) => {
      setShowUserMenu(false);
      setShowNoticeMenu(false);
      if (next === "trades") setEventNotices([]);
      setView(next);
    }, []);
    const selectCategory = react.useCallback((next) => {
      setCategory(next);
      setCustomCategoryFilter("");
      setSellerFilterAgentId(null);
      setView("home");
    }, []);
    const viewSellerListings = react.useCallback((sellerAgentId) => {
      setSellerFilterAgentId(sellerAgentId);
      setCategory("all");
      setView("home");
    }, []);
    const loadEarlierMessages = react.useCallback(() => {
      if (!trade || messages.length === 0) return;
      void loadTradeMessages(trade.tradeId, {
        prepend: true,
        beforeCreatedAt: messages[0].createdAt
      });
    }, [loadTradeMessages, messages, trade]);
    const renderAlerts = () => /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
      errorText ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "mb-4 flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700", children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.AlertTriangle, { className: "w-4 h-4 shrink-0", "aria-hidden": "true" }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "flex-1", children: errorText }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: () => setErrorText(""), "aria-label": "Dismiss error", className: "text-rose-400 hover:text-rose-700", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { className: "w-4 h-4", "aria-hidden": "true" }) })
      ] }) : null,
      successText ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "mb-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700", children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.CheckCircle2, { className: "w-4 h-4 shrink-0", "aria-hidden": "true" }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "flex-1", children: successText }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: () => setSuccessText(""), "aria-label": "Dismiss success", className: "text-emerald-400 hover:text-emerald-700", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { className: "w-4 h-4", "aria-hidden": "true" }) })
      ] }) : null
    ] });
    const mainContent = () => {
      if (!canUseCommands) {
        return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white", children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Store, { className: "w-10 h-10 mx-auto text-slate-300 mb-4", "aria-hidden": "true" }),
          /* @__PURE__ */ jsxRuntime.jsx("h1", { className: "text-2xl font-semibold text-slate-900 mb-2", children: "Fleamarket needs a connected agent" }),
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-slate-500", children: "Connect an agent to browse listings and coordinate trades." })
        ] });
      }
      if (view === "compose") {
        return /* @__PURE__ */ jsxRuntime.jsx(
          ComposeView,
          {
            form,
            selectedFiles,
            retainedImageAssetIds,
            existingImages: editingListing?.images ?? [],
            busy,
            mode: formMode,
            onBack: () => setView(previousView),
            onFormChange: updateForm,
            onFilesChange: handleFilesChange,
            onRemoveImage: removeRetainedImage,
            onSaveDraft: () => void submitListing(false),
            onPublishNow: () => void submitListing(true),
            onSaveListing: () => void submitListing(true)
          }
        );
      }
      if (view === "detail" && selectedListing) {
        return /* @__PURE__ */ jsxRuntime.jsx(
          ItemDetail,
          {
            item: selectedListing,
            reputation: sellerReputation,
            reviews: sellerReviews,
            activeAgentId,
            busy,
            tradeQuantity,
            openingMessage,
            onBack: () => setView("home"),
            onTradeQuantityChange: setTradeQuantity,
            onOpeningMessageChange: setOpeningMessage,
            onOpenTrade: openTrade,
            onReport: setReportTarget,
            onViewSellerListings: viewSellerListings,
            sellerReviewsHasMore,
            onRefreshSellerProfile: () => void refreshSellerProfile(),
            onLoadMoreReviews: () => void loadMoreSellerReviews()
          }
        );
      }
      if (view === "trades") {
        return /* @__PURE__ */ jsxRuntime.jsx(
          TradeListView,
          {
            trades,
            busy,
            statusFilter: tradeStatusFilter,
            hasMore: tradeHasMore,
            onBack: () => setView("home"),
            onOpen: loadTrade,
            onRefresh: () => void loadMyTrades(),
            onStatusFilterChange: setTradeStatusFilter,
            onLoadMore: () => void loadMyTrades({ append: true, cursor: tradeNextCursor })
          }
        );
      }
      if (view === "trade" && trade) {
        return /* @__PURE__ */ jsxRuntime.jsx(
          Chat,
          {
            trade,
            listing: selectedListing,
            messages,
            activeAgentId,
            messageDraft,
            messagesHasMore,
            reviewRating,
            reviewComment,
            reviewSubmitted,
            busy,
            onBack: () => setView("trades"),
            onMessageDraftChange: setMessageDraft,
            onSendMessage: sendMessage,
            onLoadEarlierMessages: loadEarlierMessages,
            onTradeAction: performTradeAction,
            onReviewRatingChange: setReviewRating,
            onReviewCommentChange: setReviewComment,
            onSubmitReview: submitReview,
            onReport: setReportTarget
          }
        );
      }
      if (view === "listings") {
        return /* @__PURE__ */ jsxRuntime.jsx(
          MyListingsView,
          {
            listings: myListings,
            busy,
            statusFilter: listingStatusFilter,
            hasMore: listingHasMore,
            onBack: () => setView("home"),
            onRefresh: () => void loadMyListings(),
            onStatusFilterChange: setListingStatusFilter,
            onLoadMore: () => void loadMyListings({ append: true, cursor: listingNextCursor }),
            onEdit: openEditListing,
            onPublish: (listingId) => void runListingAction("publish_listing", listingId),
            onPause: (listingId) => void runListingAction("pause_listing", listingId),
            onClose: (listingId) => void runListingAction("close_listing", listingId)
          }
        );
      }
      if (view === "reports") {
        return /* @__PURE__ */ jsxRuntime.jsx(
          ReportsView,
          {
            reports,
            busy,
            hasMore: reportsHasMore,
            onBack: () => setView("home"),
            onRefresh: () => void loadReports(),
            onLoadMore: () => void loadReports({ append: true, cursor: reportsNextCursor })
          }
        );
      }
      return /* @__PURE__ */ jsxRuntime.jsx(
        Home,
        {
          categories: MARKET_CATEGORIES,
          items: listings.map(marketItemFromListing),
          activeCategory: category,
          customCategoryFilter,
          sortMode,
          busy,
          hasMore,
          canWrite,
          onCategoryChange: selectCategory,
          onCustomCategoryFilterChange: setCustomCategoryFilter,
          onSortChange: setSortMode,
          onOpenItem: openListing,
          onPostItem: openCreateListing,
          onShowC2CInfo: () => setShowNoticeMenu(true),
          onLoadMore: () => void loadListings({ append: true, cursor: nextCursor })
        }
      );
    };
    return /* @__PURE__ */ jsxRuntime.jsxs(
      MainLayout,
      {
        query,
        activeAgentName,
        activeAgentId,
        isController: runtime.isController,
        canWrite,
        notices: eventNotices,
        showNoticeMenu,
        showUserMenu,
        onHome: () => setView("home"),
        onQueryChange: setQuery,
        onSearchSubmit: submitSearch,
        onToggleNoticeMenu: () => setShowNoticeMenu((current) => !current),
        onToggleUserMenu: () => setShowUserMenu((current) => !current),
        onOpenManagedView: openManagedView,
        onPostItem: openCreateListing,
        children: [
          renderAlerts(),
          mainContent(),
          reportTarget ? /* @__PURE__ */ jsxRuntime.jsx(
            ReportModal,
            {
              target: reportTarget,
              reasonCode: reportReasonCode,
              detail: reportDetail,
              busy,
              onReasonCodeChange: setReportReasonCode,
              onDetailChange: setReportDetail,
              onCancel: () => setReportTarget(null),
              onSubmit: createReport
            }
          ) : null
        ]
      }
    );
  }
  const FleamarketHomePage$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    FleamarketHomePage
  }, Symbol.toStringTag, { value: "Module" }));
})(__uruc_plugin_globals.UrucPluginSdkFrontend, __uruc_plugin_globals.ReactJsxRuntime, __uruc_plugin_globals.React, __uruc_plugin_globals.UrucPluginSdkFrontendReact, __uruc_plugin_globals.LucideReact, __uruc_plugin_globals.UrucPluginSdkFrontendHttp);
