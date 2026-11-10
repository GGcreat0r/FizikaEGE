# Формулы по физике — тренажёр ЕГЭ (PWA)

Сайт: https://formuly.egehelp.workers.dev (Cloudflare Workers, обновляется сам после каждого push в `main`).

Название формулы → выбери правильную из 3–5 похожих. 174 формулы по кодификатору ЕГЭ-2027 и сводке А. А. Суслова.

## Структура
- `index.html, sw.js, manifest.json, icon-*.png` — готовый сайт (собирается, руками не править).
- `topics/fizika/content.json` — **исходник**: разделы, формулы (LaTeX), ручные неверные варианты (`manual`), запрещённые (`banned`), исключённые карточки (`exclude`).
- `topics/fizika/review.txt` — все неверные варианты для проверки глазами.
- `tools/` — генератор вариантов, шаблон и сборщик.

## Как поправить
```bash
cd tools && npm i && cd ..
# 1. правишь topics/fizika/content.json
node tools/gen.js topics/fizika/content.json   # неверные варианты + review.txt
node tools/build.js topics/fizika/content.json . # пересобрать сайт в корень
git commit -am "..." && git push                 # Cloudflare обновит сайт
```
`tools/`, `topics/` и служебные файлы на сайт не попадают (`.assetsignore`).

## Установка на телефон
Android (Chrome): ⋮ → «Установить приложение». iPhone (Safari): «Поделиться» → «На экран Домой».
