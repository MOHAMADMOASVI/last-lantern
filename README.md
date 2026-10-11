# آخرین چراغ — Last Lantern

A wordless 2D platformer about a child, a fading lantern and an empty city.

یک بازی سکویی دوبعدی و بدون کلام دربارهٔ یک کودک، چراغی که رو به خاموشی است و شهری خالی. بازی با JavaScript خالص و Canvas نوشته شده و هیچ وابستگی‌ای در مرورگر ندارد. چهار مرحله دارد.

## اجرا در مرورگر

بازی از ماژول‌های ES استفاده می‌کند، پس باید از طریق یک سرور محلی باز شود (نه با دوبار کلیک روی `index.html`):

```bash
python3 -m http.server 8123
```

سپس `http://localhost:8123` را باز کنید.

## اجرا به‌صورت برنامهٔ دسکتاپ (Electron)

```bash
npm install
npm start
```

ساخت نسخهٔ نصبی:

```bash
npm run dist:mac
npm run dist:win
```

## کنترل‌ها

| کار | کلید |
|---|---|
| حرکت | کلیدهای جهت یا `A` / `D` |
| پرش | `Space`، `↑` یا `W` |
| تأیید | `Enter` یا `Space` |
| توقف | `Esc` یا `P` |
| تمام‌صفحه | `F` |
| قطع صدا | `M` |
| خروج | `Q` |

## ساختار

```
index.html, style.css   صفحهٔ بازی
src/                    کد بازی (فیزیک، نور، مرحله‌ها، صدا، ...)
src/levels/             چهار مرحله
electron/main.js        پوستهٔ دسکتاپ
```

## مجوز

[MIT](LICENSE)
