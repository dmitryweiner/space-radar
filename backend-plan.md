# План: кэширующий прокси для Space Radar

## Зачем

Три проблемы текущей client-only схемы:

1. **Rate limits.** Launch Library 2 — 15 запросов/час; CelesTrak банит 403-й
   за групповые TLE; NeoWs/DONKI на `api.nasa.gov` имеют квоты на ключ.
   Лимиты сейчас размазаны по IP пользователей, но каждый пользователь
   упирается в них сам.
2. **Гео-блокировки.** `api.nasa.gov` и `celestrak.org` недоступны из ряда
   стран — у части пользователей карточки просто не работают.
3. **Ключи в клиенте.** `NASA_API_KEY` и `FIRMS_MAP_KEY` лежат в публичном
   репозитории и в бандле (`src/api/nasaApiKey.ts`, `src/api/firmsMapKey.ts`).
   Это разрешено правилами сервисов, но чужой скрипт может выжечь квоту
   (у FIRMS лимит именно на ключ, а не на IP).

Ключевое наблюдение: **все данные глобальные, ни одного персонализированного
запроса** — APOD, Kp-индекс, запуски, пожары, TLE одинаковы для всех. Значит,
общий серверный кэш схлопывает N пользователей × M запросов в ~1 запрос к
апстриму за TTL.

Важная ловушка: прокси **без** кэша сделает rate limits хуже — соберёт всех
пользователей на один IP/ключ. Кэш — не оптимизация, а суть решения.

## Что строим

**Не бэкенд, а тонкий кэширующий прокси** — Cloudflare Worker (~200 строк),
без базы, без состояния кроме кэша. GitHub Pages остаётся как есть.

Принципы:

- **Воркер не знает про форматы данных.** Весь парсинг остаётся в `src/api`
  (клиент). Воркер — тупой кэш поверх allowlist'а апстримов; при изменении
  карточек его не надо передеплоивать.
- **Allowlist сервисов и путей** — иначе мы построили открытый прокси для
  всего интернета.
- **Stale-while-revalidate + serve-stale-on-error**: протухший кэш отдаётся
  сразу (обновление в фоне), а при 5xx апстрима — последний удачный ответ.
  Бонус: маскирует реальные outages NeoWs (Heroku error) и DONKI (503).

### Маршрутизация

Один роут `/{service}/{...path}?{query}`. Таблица `service → origin` +
per-service TTL; ключи подставляются на сервере:

| service       | upstream                                        | TTL    | ключ |
|---------------|--------------------------------------------------|--------|------|
| `swpc`        | `services.swpc.noaa.gov`                         | 5 мин  | —    |
| `swpc` (пути `json/solar-cycle/*`) | —                           | 24 ч   | —    |
| `celestrak`   | `celestrak.org/NORAD/elements/gp.php`            | 3 ч    | —    |
| `nasa`        | `api.nasa.gov` (APOD, NeoWs, DONKI)              | 1 ч    | `?api_key=` добавляет воркер |
| `firms`       | `firms.modaps.eosdis.nasa.gov/api/area/csv`      | 30 мин | MAP_KEY — сегмент пути, вставляет воркер: `/firms/{source}/{area}/{days}` → `/api/area/csv/{KEY}/{source}/{area}/{days}` |
| `eonet`       | `eonet.gsfc.nasa.gov/api/v3`                     | 30 мин | —    |
| `epic`        | `epic.gsfc.nasa.gov/api`                         | 1 ч    | —    |
| `ll2`         | `ll.thespacedevs.com/2.2.0`                      | 1 ч (жёсткий лимит 15/ч!) | — |
| `usgs`        | `earthquake.usgs.gov/earthquakes/feed/v1.0`      | 10 мин | —    |
| `nasa-images` | `images-api.nasa.gov`                            | 24 ч   | —    |

Ключ кэша = полный путь + query string (у EONET и nasa-images ответы зависят
от параметров).

### Кэш: KV, а не Cache API

Хранилище — **Workers KV** (`{ storedAt, status, contentType, body }` на ключ),
а не `caches.default`:

- Cache API — no-op на `*.workers.dev`; KV работает одинаково на workers.dev
  и на кастомном домене, т.е. деплой не требует своего домена.
- Free tier KV: 100k чтений/день, 1k записей/день. Записи у нас редкие —
  ~1 на эндпоинт за TTL, укладываемся с запасом.
- Лимит значения 25 МБ — хватает даже для больших TLE-групп CelesTrak.

Поверх KV — module-scope `Map` как микро-кэш внутри изолята (бесплатное
снижение KV-чтений на горячих эндпоинтах).

### CORS и защита

- Ответы с `Access-Control-Allow-Origin: *` (данные и так публичные) +
  обработка `OPTIONS`.
- Защита от абьюза: allowlist путей + кэш (чужой трафик почти не доходит до
  апстримов). Free tier воркера — 100k запросов/день; если станет мало,
  на кастомном домене можно включить бесплатный Cloudflare Rate Limiting.

### Изменения в клиенте

`src/api` уже готов к переезду: чистый fetch+parse, инжектируемый `fetchFn`.

1. Новый `src/api/proxyBase.ts` — константа `PROXY_BASE` (URL воркера).
2. В каждом модуле заменить upstream-константы на `${PROXY_BASE}/{service}/...`:
   - `apod.ts`, `neows.ts`, `donki.ts` → `/nasa/...` **без** `api_key`;
     удалить импорты `nasaApiKey.ts`;
   - `firms.ts` → `/firms/{source}/{area}/{days}` **без** MAP_KEY; удалить
     импорт `firmsMapKey.ts` (empty-key prompt в карточке больше не нужен);
   - остальные — механическая замена origin'а.
3. Удалить `nasaApiKey.ts` и `firmsMapKey.ts`.
4. Обновить юнит-тесты: они инжектируют `fetchFn` и проверяют URL — меняются
   ожидаемые адреса, логика тестов не меняется.
5. localStorage-кэши клиента (`src/api/cache.ts`, TLE-кэш) **остаются** — они
   дают мгновенную первую отрисовку и офлайн-устойчивость.
6. Картинки (APOD, EPIC-архив, `AURORA_IMAGE_URL`) на первом шаге остаются
   прямыми ссылками. Если гео-доступность картинок окажется важной — вторым
   шагом добавить `epic-img`/`apod-img` сервисы в ту же таблицу.

Локальная разработка: клиент и в dev ходит на задеплоенный воркер (это же
тестирует боевой путь). `wrangler dev` нужен только при работе над самим
воркером.

### Структура в репозитории

```
worker/
  src/index.ts      # fetch-handler: роутинг → KV-кэш → апстрим
  src/routes.ts     # чистая таблица { service → origin, ttl, вставка ключа }
  wrangler.jsonc    # конфиг деплоя
```

`routes.ts` — чистая функция «путь запроса → апстрим-URL + TTL», без I/O:
тестируется vitest'ом в общем `npm run check` (в духе `src/api`).

## Инструкция по деплою

Однократная настройка:

```bash
# 1. Аккаунт Cloudflare (бесплатный тариф) + wrangler
npm i -D wrangler
npx wrangler login          # откроет браузер

# 2. KV-namespace для кэша
npx wrangler kv namespace create CACHE
# → выведет id; вписать его в worker/wrangler.jsonc в kv_namespaces

# 3. Новые ключи (старые засвечены в git-истории — перевыпустить!)
#    NASA:  https://api.nasa.gov  (форма Generate API Key)
#    FIRMS: https://firms.modaps.eosdis.nasa.gov/api/map_key/
npx wrangler secret put NASA_API_KEY    # вставить новый ключ NASA
npx wrangler secret put FIRMS_MAP_KEY   # вставить новый MAP_KEY
```

Деплой (и каждый следующий редеплой воркера):

```bash
npx wrangler deploy
# → выведет URL вида https://space-radar-proxy.<account>.workers.dev
```

Дальше:

```bash
# 4. Вписать этот URL в src/api/proxyBase.ts
# 5. Проверки и обычный деплой фронтенда:
npm run check
npm run smoke
npm run build      # → docs/, коммит + push = деплой на GitHub Pages
```

Проверка руками, что прокси жив:

```bash
curl -s https://space-radar-proxy.<account>.workers.dev/swpc/products/noaa-planetary-k-index.json | head -c 200
curl -s "https://space-radar-proxy.<account>.workers.dev/firms/VIIRS_NOAA20_NRT/world/1" | head -3
```

Полезное при отладке: `npx wrangler tail` — живые логи воркера;
`npx wrangler dev` — локальный запуск на `http://localhost:8787`.

## Порядок работ

1. `worker/` + `routes.ts` с тестами; деплой; `curl`-проверка всех сервисов.
2. Перевод `src/api` на `PROXY_BASE`, чистка ключей, правка тестов.
3. `npm run check` + `npm run smoke` (smoke ловит регрессии всех карточек).
4. Перевыпуск ключей, заливка в secrets, удаление старых из кода.
5. Обновить CLAUDE.md (архитектурная заметка про воркер + команды деплоя).
6. (опционально, потом) прокси картинок; кастомный домен, если упрёмся в
   лимиты workers.dev.
