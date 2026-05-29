# nope-id

> 🌐 **Читать на другом языке:** [English](README.md) · [Türkçe](README.tr.md) · [Русский](README.ru.md)

Крошечный, безопасный, URL-совместимый генератор уникальных строковых ID для JavaScript.

**Более быстрая и безопасная альтернатива nanoid с дополнительными возможностями!**

<!-- bench:headline:start -->
- **Быстрее** - в 2–9 раз быстрее nanoid (CSPRNG, полный URL-безопасный алфавит); выигрывает все 5 основных бенчмарков ([см. бенчмарки](#производительность))
<!-- bench:headline:end -->
- **Усиленная безопасность** - Валидаторы с уменьшенной утечкой по времени, устранение modulo bias, защита от prototype pollution ([безопасность](#безопасность))
- **Хорошо протестирован** - 342 тестов, включая тесты безопасности и энтропии ([тестирование](#тестирование))
- **Криптографически безопасный** - Использует `webcrypto.getRandomValues()` (CSPRNG)
- **Без зависимостей** - Никаких внешних зависимостей
- **URL-безопасный** - Использует символы `A-Za-z0-9_-`
- **Двойной модуль** - Работает и с ESM (`import`), и с CommonJS (`require`)
- **TypeScript** - Полные типы включены
- **Устойчив к коллизиям** - Строго монотонные сортируемые ID, ID с меткой источника для распределённых систем
- **Множество форматов ID** - UUID v4 и **v7**, **ULID** (соответствие спецификации + монотонная фабрика), **Snowflake**, **MongoDB ObjectId**
- **Дополнительные возможности** - ID с префиксом, сортируемые ID, **Sqids** (обратимое кодирование), **типизированные ID**, валидаторы форматов и многое другое!

## Установка

```bash
npm install nope-id
```

## Быстрый старт

### ES Modules (import)

```javascript
import { nopeid } from 'nope-id'

const id = nopeid() // "V1StGXR8_Z5jdHi6B-myT"
```

### CommonJS (require)

```javascript
const { nopeid } = require('nope-id')

const id = nopeid() // "V1StGXR8_Z5jdHi6B-myT"
```

### Default Export

```javascript
// ES Modules
import nopeid from 'nope-id'
const id = nopeid() // "V1StGXR8_Z5jdHi6B-myT"

// CommonJS
const nopeid = require('nope-id')
const id = nopeid() // "V1StGXR8_Z5jdHi6B-myT"
```

---

## Справочник API

### Основные функции

#### `nopeid(size = 21)`

Генерирует безопасный, URL-совместимый уникальный ID.

```javascript
// ES Modules
import { nopeid } from 'nope-id'

nopeid()    // "V1StGXR8_Z5jdHi6B-myT" (21 символ)
nopeid(10)  // "IRFa-VaY2b" (10 символов)
nopeid(32)  // "V1StGXR8_Z5jdHi6B-myTV1StGXR8_Z5" (32 символа)
nopeid(0)   // "" (пустая строка для нуля/отрицательного значения)

// CommonJS
const { nopeid } = require('nope-id')
const id = nopeid() // "V1StGXR8_Z5jdHi6B-myT"
```

#### `customAlphabet(alphabet, defaultSize = 21)`

Создаёт собственный генератор ID с заданным алфавитом.

```javascript
// ES Modules
import { customAlphabet } from 'nope-id'

// Hex ID
const hexId = customAlphabet('0123456789abcdef', 16)
hexId()   // "4f90d13a42f17f80"
hexId(8)  // "a3b2c1d4"

// Только цифры
const numericId = customAlphabet('0123456789', 8)
numericId() // "48293751"

// Собственный набор символов
const customId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)
customId() // "BKWXYZ"

// Бинарные ID
const binaryId = customAlphabet('01', 16)
binaryId() // "1010110011001010"

// CommonJS
const { customAlphabet } = require('nope-id')
const hexGen = customAlphabet('0123456789abcdef', 16)
const id = hexGen() // "4f90d13a42f17f80"
```

#### `customRandom(alphabet, defaultSize, getRandom)`

Создаёт генератор ID с собственным источником случайности.

```javascript
// ES Modules
import { customRandom } from 'nope-id'

// Использование собственного источника случайности
const customGen = customRandom(
  'abcdef',
  10,
  (size) => new Uint8Array(size).fill(1)  // Детерминированно для тестов
)
customGen() // Детерминированный вывод

// CommonJS
const { customRandom } = require('nope-id')
```

#### `random(bytes)`

Генерирует криптографически безопасные случайные байты.

```javascript
// ES Modules
import { random } from 'nope-id'

const bytes = random(16)  // Uint8Array(16) со случайными байтами
const bytes2 = random(32) // Uint8Array(32) со случайными байтами

// CommonJS
const { random } = require('nope-id')
const bytes = random(16)
```

---

### Функции генерации ID

#### `prefixedId(prefix, size = 21, separator = '_')`

Генерирует ID с префиксом - идеально для записей в базе данных!

```javascript
// ES Modules
import { prefixedId } from 'nope-id'

prefixedId('user')           // "user_V1StGXR8_Z5jdHi6B-myT"
prefixedId('order', 10)      // "order_IRFa-VaY2b"
prefixedId('prod', 8, '-')   // "prod-Z5jdHi6B"
prefixedId('cust', 12, ':')  // "cust:a1b2c3d4e5f6"

// Примеры из реальной жизни
const userId = prefixedId('usr')       // "usr_V1StGXR8_Z5jdHi6B-myT"
const orderId = prefixedId('ord')      // "ord_IRFa-VaY2bKwxyz..."
const productId = prefixedId('prod')   // "prod_Z5jdHi6B-myT..."
const transactionId = prefixedId('txn') // "txn_8_Z5jdHi6B..."

// CommonJS
const { prefixedId } = require('nope-id')
const id = prefixedId('user') // "user_V1StGXR8_Z5jdHi6B-myT"
```

#### `sortableId(size = 22)`

Генерирует ULID-подобный сортируемый ID с гарантией монотонности. Использует Crockford Base32 для лексикографической сортировки.

**Возможности:**
- 10 символов timestamp + 12 символов random = 22 символа по умолчанию
- Сортируемый хронологически (лексикографический порядок)
- ID в одной миллисекунде гарантированно монотонно возрастают
- Можно декодировать timestamp через `decodeTime()`
- Размеры > 22 дополняются дополнительными случайными символами Crockford Base32; размеры < 22 обрезаются до timestamp-префикса (используйте size ≥ 22, чтобы сохранить гарантию монотонности)

```javascript
// ES Modules
import { sortableId, decodeTime } from 'nope-id'

const id1 = sortableId() // "01HGW2BBK0QZRMTX12345A"
// подождите немного...
const id2 = sortableId() // "01HGW2BBK1ABCDEFGHIJKL"

// Сортируемые хронологически
console.log(id1 < id2) // true

// Та же миллисекунда - монотонно возрастают
const ids = []
for (let i = 0; i < 5; i++) {
  ids.push(sortableId())
}
// Все ID уникальны и строго возрастают
// ids[0] < ids[1] < ids[2] < ids[3] < ids[4]

// Собственный размер
sortableId(30) // 30-символьный сортируемый ID

// Декодировать timestamp
const id = sortableId()
const date = decodeTime(id)
console.log(date) // объект Date, когда был создан ID

// CommonJS
const { sortableId, decodeTime } = require('nope-id')
const id = sortableId()
const timestamp = decodeTime(id)
```

#### `decodeTime(sortableIdStr)`

Извлекает timestamp из сортируемого ID.

```javascript
// ES Modules
import { sortableId, decodeTime } from 'nope-id'

const id = sortableId()
const date = decodeTime(id)

console.log(date)            // 2024-01-15T10:30:00.000Z
console.log(date.getTime())  // 1705314600000

// Обработка ошибок
try {
  decodeTime('invalid')  // выбрасывает Error
} catch (e) {
  console.log('Некорректный sortable ID')
}

// CommonJS
const { sortableId, decodeTime } = require('nope-id')
```

#### `generateMany(count, size = 21)`

Генерирует сразу несколько уникальных ID.

```javascript
// ES Modules
import { generateMany } from 'nope-id'

const ids = generateMany(5)
// ["V1StGXR8_Z5jdHi6B-myT", "IRFa-VaY2bKwxyz...", ...]

const shortIds = generateMany(100, 8)
// 100 коротких ID по 8 символов каждый

generateMany(0)   // [] (пустой массив)
generateMany(-5)  // [] (пустой массив)

// Пример массовой вставки
const userIds = generateMany(1000, 21)
await db.users.insertMany(
  userIds.map(id => ({ id, createdAt: new Date() }))
)

// CommonJS
const { generateMany } = require('nope-id')
const ids = generateMany(100)
```

#### `uuid()`

Генерирует строку, совместимую с UUID v4.

```javascript
// ES Modules
import { uuid } from 'nope-id'

uuid() // "110ec58a-a0f2-4ac4-8393-c866d813b8d1"
uuid() // "f47ac10b-58cc-4372-a567-0e02b2c3d479"

// Использование в базах данных, ожидающих UUID
const user = {
  id: uuid(),
  name: 'John'
}

// CommonJS
const { uuid } = require('nope-id')
const id = uuid()
```

#### `slugId(size = 12)`

Генерирует slug-совместимый ID (только строчные буквы + цифры). Идеально для URL!

```javascript
// ES Modules
import { slugId } from 'nope-id'

slugId()   // "a8b3c9d2e1f4"
slugId(8)  // "x7y2z9w4"
slugId(16) // "a1b2c3d4e5f6g7h8"

// URL-совместимое использование
const articleSlug = `my-article-${slugId()}`
// "my-article-a8b3c9d2e1f4"

// CommonJS
const { slugId } = require('nope-id')
const slug = slugId()
```

#### `shortId(size = 8)`

Генерирует короткий ID без похожих символов (без 0/O, 1/l/I). Идеально для пользовательских кодов!

```javascript
// ES Modules
import { shortId } from 'nope-id'

shortId()   // "aBc7XyZ9"
shortId(6)  // "Kp3Wn8"
shortId(10) // "aBc7XyZ9Kp"

// Идеально подходит для:
// - Кодов подтверждения
// - Коротких URL
// - Пользовательских ссылок
// - Номеров заявок

const verificationCode = shortId(6) // "Kp3Wn8"
const ticketNumber = shortId(8)     // "aBc7XyZ9"

// CommonJS
const { shortId } = require('nope-id')
const code = shortId(6)
```

#### `nopeidAsync(size = 21)`

Асинхронная версия для неблокирующих операций.

```javascript
// ES Modules
import { nopeidAsync } from 'nope-id'

const id = await nopeidAsync()     // "V1StGXR8_Z5jdHi6B-myT"
const id2 = await nopeidAsync(32)  // 32-символьный async ID

// Параллельная генерация
const ids = await Promise.all([
  nopeidAsync(),
  nopeidAsync(),
  nopeidAsync()
])

// CommonJS
const { nopeidAsync } = require('nope-id')
const id = await nopeidAsync()
```

---

### Функции для распределённых систем

#### `getFingerprint()`

Возвращает уникальный fingerprint текущего процесса/устройства. Генерируется один раз и кешируется.

```javascript
// ES Modules
import { getFingerprint } from 'nope-id'

const fp = getFingerprint() // "aB3x" (4 символа)
const fp2 = getFingerprint() // "aB3x" (то же значение, из кеша)

// Полезно в распределённых системах для идентификации источника
console.log(`ID создан процессом: ${getFingerprint()}`)

// CommonJS
const { getFingerprint } = require('nope-id')
const fingerprint = getFingerprint()
```

#### `distributedId(size = 25)`

Генерирует ID с префиксом-fingerprint процесса. Полезен для отслеживания источника ID в многопроцессных / многоузловых системах. Защита от коллизий обеспечивается случайным хвостом, поэтому `size` должен оставлять место для него (минимум 16; меньшие значения вызывают ошибку).

**Формат:** `fingerprint_randomPart`

```javascript
// ES Modules
import { distributedId, getFingerprint } from 'nope-id'

distributedId()   // "aB3x_V1StGXR8_Z5jdHi6B" (25 символов)
distributedId(30) // "aB3x_V1StGXR8_Z5jdHi6B-myT1" (30 символов)
distributedId(8)  // вызывает ошибку — size должен быть не менее 16

// В многопроцессной / многоузловой системе каждый источник имеет свой fingerprint
// Node 1: "aB3x_V1StGXR8_Z5jdHi6B"
// Node 2: "kL9m_IRFa-VaY2bKwxyz12"
// Node 3: "pQ7r_Z5jdHi6B-myTV1St8"

// Определить, какой узел сгенерировал ID
const id = distributedId()
const nodeFingerprint = id.split('_')[0]
console.log(`Сгенерировано узлом: ${nodeFingerprint}`)

// CommonJS
const { distributedId } = require('nope-id')
const id = distributedId()
```

---

### Утилиты

#### `isValid(id, alphabet = urlAlphabet)`

Проверяет, является ли строка корректным ID для заданного алфавита.

```javascript
// ES Modules
import { isValid, urlAlphabet, alphabets } from 'nope-id'

isValid('V1StGXR8_Z5jdHi6B-myT')  // true
isValid('')                        // false
isValid(null)                      // false
isValid('abc@#$')                  // false (некорректные символы)

// Проверить с собственным алфавитом
isValid('abc123', 'abc123')        // true
isValid('ABC', 'abc')              // false
isValid('12345678', alphabets.numbers) // true

// CommonJS
const { isValid } = require('nope-id')
const valid = isValid('V1StGXR8_Z5jdHi6B-myT')
```

#### `collisionProbability(idLength, alphabetSize = 64)`

Вычисляет вероятность коллизий для заданных параметров.

```javascript
// ES Modules
import { collisionProbability } from 'nope-id'

const info = collisionProbability(21)
console.log(info)
// {
//   totalPossible: 9007199254740991,   // ограничено MAX_SAFE_INTEGER (для точного значения используйте totalPossibleBigInt)
//   totalPossibleBigInt: 85070591730234615865843651857942052864n, // 64^21 ≈ 8.5e37
//   probabilityForBillion: 5.877471748233966e-21, // точно вычислено через Math.expm1
//   safeCount: 1.086e+19,              // ~50% коллизия после генерации такого количества ID
//   yearsFor1Percent: 4.133e+7         // лет при 1 ID/мс до 1% коллизий
// }

// Сравнить разные длины
collisionProbability(8)   // Намного выше риск коллизий
collisionProbability(32)  // Очень низкий риск коллизий

// Собственный размер алфавита
collisionProbability(21, 62)  // Только alphanumeric
collisionProbability(21, 16)  // Только hex

// CommonJS
const { collisionProbability } = require('nope-id')
const info = collisionProbability(21)
```

---

### Готовые алфавиты

```javascript
// ES Modules
import { alphabets, customAlphabet } from 'nope-id'

// Доступные алфавиты
alphabets.alphanumeric    // "0-9A-Za-z" (62 символа)
alphabets.lowercase       // "a-z" (26 символов)
alphabets.uppercase       // "A-Z" (26 символов)
alphabets.numbers         // "0-9" (10 символов)
alphabets.hexLower        // "0-9a-f" (16 символов)
alphabets.hexUpper        // "0-9A-F" (16 символов)
alphabets.nolookalikes    // Без похожих символов (49 символов)
alphabets.nolookalikesSafe // Очень безопасная версия (34 символа)
alphabets.binary          // "01" (2 символа)
alphabets.octal           // "0-7" (8 символов)
alphabets.base32          // RFC 4648 Base32 (32 символа)
alphabets.base32Lower     // Base32 в нижнем регистре (32 символа)
alphabets.base58          // Bitcoin Base58 (58 символов)
alphabets.filename        // Безопасные имена файлов (64 символа)

// Использование с customAlphabet
const hexGen = customAlphabet(alphabets.hexLower, 32)
hexGen() // "a1b2c3d4e5f67890abcdef1234567890"

const base58Gen = customAlphabet(alphabets.base58, 22)
base58Gen() // ID в стиле Bitcoin

const safeGen = customAlphabet(alphabets.nolookalikesSafe, 8)
safeGen() // Очень читабельный код

// CommonJS
const { alphabets, customAlphabet } = require('nope-id')
const gen = customAlphabet(alphabets.hexLower, 16)
```

---

## Дополнительные форматы ID и помощники

Эти secure-only генераторы и помощники экспортируются как tree-shakeable именованные экспорты и **никогда не затрагивают hot path** `nopeid()`; импортируйте только то, что используете.

### `uuidv7()`

Time-ordered UUID (RFC 9562), дружественный к индексам БД и сортируемый по времени создания. Первые 48 бит кодируют Unix-ms timestamp.

```javascript
import { uuidv7, isValidUUID } from 'nope-id'

uuidv7()                  // "0192f3c1-8e2a-7b3c-9d4e-5f60718293a4"
isValidUUID(uuidv7(), 7)  // true
```

### `ulid(seedTime?)` и `monotonicFactory()`

Соответствующий спецификации 26-символьный ULID (Crockford Base32: 10 timestamp + 16 random). `ulid()` использует свежую случайность для каждого вызова; `monotonicFactory()` возвращает генератор с **изолированным** состоянием, гарантирующий строго возрастающие ID в пределах одной миллисекунды (не затрагивая глобальное состояние `sortableId()`).

```javascript
import { ulid, monotonicFactory, decodeTime } from 'nope-id'

ulid()              // "01ARZ3NDEKTSV4RRFFQ69G5FAV"
decodeTime(ulid())  // Date

const next = monotonicFactory()
next() < next()     // true (та же мс, строго возрастает)
```

### `snowflakeFactory(options)`, `snowflake()` и `decodeSnowflake(id)`

64-битные распределённые ID в стиле Twitter возвращаются как **строки** (BigInt-безопасно). Структура: 41-бит timestamp · 10-бит node id · 12-бит sequence. Каждая фабрика владеет своим состоянием sequence (без координации между узлами).

```javascript
import { snowflakeFactory, decodeSnowflake, snowflake } from 'nope-id'

const next = snowflakeFactory({ nodeId: 1 })  // опционально: { epoch }
const id = next()                              // "1838219834728448001"
decodeSnowflake(id)  // { timestamp: Date, nodeId: 1, sequence: 0 }

snowflake()  // дефолтный single-node генератор (node id выводится из fingerprint)
```

### `objectId()` и `decodeObjectIdTime(id)`

24-символьный hex, совместимый с MongoDB ObjectId (4 байта timestamp + 5 байт значения на процесс + 3 байта счётчика).

```javascript
import { objectId, decodeObjectIdTime } from 'nope-id'

objectId()                      // "65f1c3e2a1b2c3d4e5f60718"
decodeObjectIdTime(objectId())  // Date
```

### `sqidsFactory(options)`: обратимое кодирование целых чисел

Кодирует массивы неотрицательных целых чисел в короткие, URL-безопасные, **обратимые** строки, например чтобы скрыть последовательные ID БД в URL. Это обфускация, а **не** шифрование.

```javascript
import { sqidsFactory } from 'nope-id'

const sqids = sqidsFactory()        // { alphabet?, minLength?, blocklist? }
const id = sqids.encode([1, 2, 3])  // "86Rf07"
sqids.decode(id)                    // [1, 2, 3]
```

> По умолчанию **нет** blocklist'а ненормативной лексики (для компактности). Передайте свой `blocklist`, если он нужен.

### `defineId(prefix, options?)`: типизированные ID с префиксом

Типизированные ID в стиле Stripe с генератором, type guard и парсером. В TypeScript созданный ID имеет тип `` `${prefix}_${string}` ``.

```typescript
import { defineId } from 'nope-id'

const UserId = defineId('user')   // { size?, separator?, alphabet? }
const id = UserId.generate()      // тип: `user_${string}`
UserId.is(id)                     // true (type guard сужает тип)
UserId.parse('user_abc')          // { prefix: 'user', id: 'abc' }  (или null)
```

### `isValidUUID(id, version?)` и `isValidULID(id)`

Валидаторы формата для строк UUID и ULID.

```javascript
import { isValidUUID, isValidULID } from 'nope-id'

isValidUUID('110ec58a-a0f2-4ac4-8393-c866d813b8d1')  // true
isValidUUID(uuidv7(), 7)                              // true (с фиксированной версией)
isValidULID('01ARZ3NDEKTSV4RRFFQ69G5FAV')             // true
```

> Эти форматы используют криптографическую случайность и доступны **только в secure-версии**; они не являются частью `nope-id/non-secure`.

---

## Сортируемые, монотонные ID

### `orderedId()`

ID фиксированного формата, строго монотонный, лексикографически сортируемый, 21 символ Base58. Структура: 8 timestamp + 5 счётчик + 8 случайных.

Та же форма, что и у [sparkid](https://www.npmjs.com/package/sparkid), но с одним дополнительным символом случайной энтропии (~47 бит против ~41 у sparkid), более строгими гарантиями (clamp при обратном ходе часов, синтетический сдвиг времени при переполнении счётчика вместо busy-wait) и сопоставимой производительностью в пределах разброса измерений на Node LTS.

```javascript
import { orderedId } from 'nope-id'

orderedId()                                // "1okw67hF111114mDXU1ez"

// Строгая монотонность сохраняется при NTP-коррекциях, возобновлении контейнера и т.п.
// Когда Date.now() идёт назад, orderedId переиспользует больший закэшированный префикс
// и продолжает увеличивать счётчик, поэтому следующий ID всё равно строго больше.
orderedId() < orderedId() // true

// Разобрать время, счётчик и случайный хвост обратно
orderedId.parse('1okw67hF111114mDXU1ez')
// { timestamp: Date, counter: 1, random: '4mDXU1ez' }

// 21-байтное ASCII-представление (коды символов latin1; НЕ упакованный бинарь)
orderedId.asciiBytes() // Uint8Array(21)

// Пакетная генерация: читает часы один раз на пакет (и каждые 4096 ID), поэтому
// быстрее в расчёте на один ID, чем вызов orderedId() в цикле. Всегда строго возрастает.
orderedId.many(1000) // string[] из 1000 сортируемых ID
```

**Когда выбирать `orderedId()` вместо `sortableId()`:**
- Он строго монотонен (`b > a`), а не просто неубывающий.
- При переполнении счётчика делается синтетический сдвиг времени вместо цикла busy-wait.
- Обратный ход часов ограничивается (clamp); он никогда не выдаёт timestamp меньше уже возвращённого.
- Вывод всегда 21 символ; нет параметра размера, нет ловушек с усечением.

`sortableId()` теперь legacy. Для нового кода предпочитайте `orderedId()`.

**Пакетная генерация через `orderedId.many(count)`**

`orderedId.many(count)` возвращает массив из `count` строго монотонных ID. Он читает часы один раз в начале пакета и затем только каждые 4096 ID, поэтому стоимость `Date.now()` в расчёте на один ID распределяется по всему пакету без какого-либо фонового таймера и без изменения пути per-call `orderedId()`. Порядок всегда точен (счётчик разделяет ID в пределах одной миллисекунды); встроенный timestamp может отставать от реального времени на время, нужное для генерации до ~4096 ID (на практике меньше миллисекунды). На Node LTS это примерно в 1.7 раза выше throughput, чем вызов `orderedId()` в цикле. `count <= 0` возвращает `[]`; `count > 1_000_000` бросает исключение.

```javascript
const ids = orderedId.many(10000) // 10 000 сортируемых ID, одно чтение часов на 4096
ids[0] < ids[1] // true (строго возрастает)
```

> orderedId сортируем по своей природе; его префикс раскрывает время создания. **Не используйте его как bearer secret.** Для секретов используйте `secureToken()`.

---

## Безопасные токены (bearer secret'ы)

`nopeid()` для производительности возвращает подстроки долгоживущей закэшированной строки-пула. Этот кэш подходит для публичных ID; но для bearer secret'ов (API-ключи, session-токены, токены сброса пароля) он означает, что дамп памяти может раскрыть токены, которые ещё не были запрошены. Семейство `secureToken` устраняет этот класс риска: каждый вызов выделяет собственный буфер, заполняет его из CSPRNG, отображает в алфавит, а затем обнуляет сырые байты перед возвратом.

> Сама возвращаемая строка JavaScript не может быть обнулена; строки V8 неизменяемы и живут в куче GC. Если ваша модель угроз требует очищаемых из памяти секретов, держите байты как `Buffer`/`Uint8Array` и никогда не вызывайте `.toString()`.

### `secureToken(size = 48)`

```javascript
import { secureToken } from 'nope-id'

secureToken()       // 48-символьный URL-safe токен (по умолчанию)
secureToken(64)     // 64-символьный токен
secureToken(32)     // 32 это минимум; меньше бросает исключение
```

- URL-safe алфавит из 64 символов (`A-Za-z0-9_-`)
- Без смещения (`byte & 63`)
- Нет кэша будущих токенов; сырые байты обнуляются после преобразования в строку
- **Храните токены хэшированными** (например SHA-256), никогда не сырой токен

### `apiKey(prefix = 'nope_live', size = 40)`

```javascript
import { apiKey } from 'nope-id'

apiKey()                       // "nope_live_<40 символов>"
apiKey('sk_live', 40)          // "sk_live_<40 символов>"
apiKey('myapp_test', 32)       // "myapp_test_<32 символа>"
```

Тонкая обёртка над `secureToken`: проверяет префикс (непустой, без пробелов) и соединяет через `_`. Соглашение об именовании (в стиле Stripe `sk_live_`, в стиле GitHub `ghp_` и т.п.) на ваше усмотрение.

### `defineToken(prefix, options?)`: типизированные безопасные токены

В стиле Stripe: тройка `generate` / `is` / `parse`, но тело берётся из `secureToken`, а алфавит зафиксирован на URL-safe 64 символа для стабильности.

```javascript
import { defineToken } from 'nope-id'

const SessionToken = defineToken('sess', { size: 48 })

const t = SessionToken.generate()    // "sess_<48 символов>"
SessionToken.is(t)                   // true
SessionToken.parse(t)                // { prefix: 'sess', token: '<48 символов>' }
SessionToken.is('sess_short')        // false (длина проверяется)
```

---

## Выбор правильного ID

| Сценарий | API | Размер | Почему |
|---|---|---|---|
| Log / request ID | `nopeid(16)` | 16 | Самый быстрый, с пулом, безопасен для публичного |
| Публичный URL ID | `nopeid(21)` | 21 | 126 бит, нет проблемы будущих токенов для публичных ID |
| DB object ID | `nopeid(21)` или `orderedId()` | 21 | Случайный или сортируемый |
| Сортируемый первичный ключ БД | `orderedId()` | 21 | Лексикографически сортируемый, строго монотонный, дружелюбен к B-tree |
| Код приглашения / подтверждения | `shortId(12)` | 12 | Без похожих символов, удобно набирать |
| API-ключ | `apiKey('myapp_live', 40)` | префикс + 40 | С префиксом, без пула, 240+ бит |
| Session-токен | `secureToken(48)` | 48 | Без пула, эфемерный |
| Токен сброса пароля | `secureToken(48)` | 48 | Одноразовый; хэшируйте перед хранением |
| Подтверждение email | `secureToken(40)` | 40 | TTL + одноразовый |
| Платёж / высокая ценность | `secureToken(64)` | 64 | Максимальный бюджет энтропии |

Чёткое правило:
- **С пулом, быстро, безопасно для публичного** → семейство `nopeid()`
- **Без пула, эфемерный, серверный секрет** → семейство `secureToken()`
- **Упорядочен по времени, монотонный, дружелюбен к БД** → `orderedId()`

---

## Небезопасная версия

Для некритичных случаев (UI-идентификаторов, временных ключей и т.п.) можно использовать более быструю небезопасную версию:

```javascript
// ES Modules
import { nopeid, sortableId, prefixedId } from 'nope-id/non-secure'

nopeid()      // Использует Math.random() - быстрее, но не криптографически безопасно
sortableId()  // Гарантия монотонности всё ещё в силе
prefixedId('user') // Работает так же

// CommonJS
const { nopeid, sortableId } = require('nope-id/non-secure')
const id = nopeid()
```

**Внимание:** Не используйте для security-критичных целей вроде токенов, паролей или session ID!

**Случаи использования небезопасной версии:**
- UI-идентификаторы (React keys и т.п.)
- Временные имена файлов
- ID для корреляции логов
- Тестовые фикстуры
- Любой случай, где криптографическая безопасность не требуется

---

## Примеры из реальной жизни

### Первичные ключи в БД

```javascript
// ES Modules
import { prefixedId, orderedId } from 'nope-id'

// Таблица пользователей с префиксными ID
const user = {
  id: prefixedId('usr'),  // "usr_V1StGXR8_Z5jdHi6B-myT"
  email: 'john@example.com'
}

// Заказы со строго монотонными сортируемыми ID (автосортировка по времени создания)
const order = {
  id: orderedId(),  // "1okw67hF111114mDXU1ez"
  userId: user.id,
  total: 99.99
}

// CommonJS
const { prefixedId, orderedId } = require('nope-id')
```

### Генерация API-токенов

```javascript
// ES Modules
import { apiKey, secureToken, defineToken } from 'nope-id'

// API-ключ с префиксом (без пула, эфемерный, префикс валидируется)
const key = apiKey('sk_live', 40)        // "sk_live_<40 символов>"

// Refresh / сессионные / токены сброса пароля
const refreshToken = secureToken(48)     // 48-символьный URL-safe, CSPRNG, зануляется

// Типизированный токен с тройкой generate / is / parse
const SessionToken = defineToken('sess', { size: 48 })
const sessionToken = SessionToken.generate()

// CommonJS
const { apiKey, secureToken, defineToken } = require('nope-id')
```

> Семейство `secureToken` обходит строковый пул `nopeid()` — каждый вызов делает свой CSPRNG-fill, поэтому дамп памяти не может раскрыть ещё не выданные токены. Используйте его для любых bearer-секретов. `nopeid()` / `prefixedId()` — только для публичных ID.

### Сокращатель URL

```javascript
// ES Modules
import { slugId, shortId } from 'nope-id'

// Короткие URL
const shortUrl = `https://short.ly/${slugId(8)}`
// "https://short.ly/a8b3c9d2"

// Удобные для пользователя коды
const shareCode = shortId(6)  // "Kp3Wn8" (без путающих символов)

// CommonJS
const { slugId, shortId } = require('nope-id')
```

### Распределённые системы

```javascript
// ES Modules
import { distributedId, orderedId, getFingerprint } from 'nope-id'

// ID, безопасные в multi-node
const eventId = distributedId()
// "aB3x_V1StGXR8_Z5jdHi6B"

// Лог с идентификацией узла
console.log(`[${getFingerprint()}] Обработка события ${eventId}`)

// Временные ряды со строго монотонными сортируемыми ID
const metric = {
  id: orderedId(),
  timestamp: new Date(),
  value: 42
}

// CommonJS
const { distributedId, orderedId, getFingerprint } = require('nope-id')
```

### React / Next.js

```jsx
// ES Modules (React)
import { nopeid, prefixedId } from 'nope-id'

function TodoList({ items }) {
  return (
    <ul>
      {items.map(item => (
        <li key={nopeid()}>{item.text}</li>
      ))}
    </ul>
  )
}

function CreateUser() {
  const [userId] = useState(() => prefixedId('usr'))
  // ...
}

// Для некритичных UI-ключей используйте небезопасную версию ради производительности
import { nopeid } from 'nope-id/non-secure'
```

### Express.js API

```javascript
// CommonJS
const express = require('express')
const { prefixedId, orderedId, uuid } = require('nope-id')

const app = express()

app.post('/users', (req, res) => {
  const user = {
    id: prefixedId('usr'),
    ...req.body
  }
  // Сохранить пользователя...
  res.json(user)
})

app.post('/orders', (req, res) => {
  const order = {
    id: orderedId(),  // Сортируемый по времени создания, строго монотонный
    ...req.body
  }
  // Сохранить заказ...
  res.json(order)
})

// Для систем, ожидающих UUID
app.post('/legacy-api', (req, res) => {
  const record = {
    id: uuid(),
    ...req.body
  }
  res.json(record)
})
```

---

## Сравнение с nanoid

| Возможность | nope-id | nanoid |
|---------|---------|--------|
| Безопасная случайность | ✅ | ✅ |
| URL-безопасный | ✅ | ✅ |
| TypeScript | ✅ | ✅ |
| ESM + CommonJS | ✅ | ⚠️ Только ESM (CJS убрали в v4) |
| ID с префиксом | ✅ | ❌ |
| Сортируемые ID (ULID-подобные) | ✅ | ❌ |
| Гарантия монотонности | ✅ | ❌ |
| Декодирование timestamp | ✅ | ❌ |
| Распределённые ID | ✅ | ❌ |
| Fingerprint процесса | ✅ | ❌ |
| UUID v4 | ✅ | ❌ |
| UUID v7 (time-ordered) | ✅ | ❌ |
| ULID (по спецификации) | ✅ | ❌ |
| Монотонная фабрика ULID | ✅ | ❌ |
| Snowflake ID | ✅ | ❌ |
| MongoDB ObjectId | ✅ | ❌ |
| Sqids (обратимое кодирование) | ✅ | ❌ |
| Типизированные ID (TS template-типы) | ✅ | ❌ |
| Валидаторы форматов (UUID/ULID) | ✅ | ❌ |
| Slug-ID | ✅ | ❌ |
| Короткие ID (без похожих символов) | ✅ | ❌ |
| Пакетная генерация | ✅ | ❌ |
| Валидация | ✅ | ❌ |
| Калькулятор коллизий | ✅ | ❌ |
| Готовые алфавиты | ✅ (14) | Ограниченно |

---

## Поддержка браузеров

Работает во всех современных браузерах с поддержкой Web Crypto API.

```html
<script type="module">
  import { nopeid, prefixedId } from 'https://unpkg.com/nope-id/index.browser.js'

  console.log(nopeid())        // "V1StGXR8_Z5jdHi6B-myT"
  console.log(prefixedId('user')) // "user_V1StGXR8_..."
</script>
```

---

## Безопасность

nope-id спроектирован с приоритетом безопасности. Мы внедрили несколько мер по усилению безопасности, выходящих за рамки базовой криптографической случайности.

### Криптографическая безопасность

- **Node.js**: `webcrypto.getRandomValues()` (CSPRNG)
- **Браузер**: `crypto.getRandomValues()` (CSPRNG)

### Усиление безопасности

| Функция безопасности | Описание |
|-----------------|-------------|
| **Уменьшенная утечка по времени** | `isValid()` не использует ранний возврат на первом плохом символе; ослабляет самые очевидные атаки position-oracle. (Это не строгое константное время — тайминг V8 `Set.has` не гарантированно однороден.) |
| **Устранение modulo bias** | Использует rejection sampling для обеспечения идеально равномерного распределения для алфавитов любых размеров (не только степеней двойки) |
| **Защита от prototype pollution** | Объект `alphabets` заморожен с null prototype, защищён от атак prototype pollution |
| **Защита от integer overflow** | `collisionProbability()` использует BigInt для точных вычислений с астрономически большими числами |
| **Защита от DoS** | `sortableId()` имеет ограничения на итерации, чтобы предотвратить бесконечные циклы при зависших системных часах |
| **Безопасность буферов** | Управление пулом безопасно обрабатывает запросы `>65536` байт через chunked-заполнение |

### Лучшие практики

- Используйте безопасную версию (по умолчанию) для токенов, session ID, API-ключей
- Используйте `sortableId()` для упорядочивания по времени с устойчивостью к коллизиям
- Используйте `distributedId()` в multi-node развёртываниях
- Используйте `nope-id/non-secure` только для не security-критичных задач

---

## Тестирование

nope-id имеет покрытие из **342 тестов** по 8 наборам, включая security-специфичные тесты.

### Запуск тестов

```bash
# Запустить все тесты
npm test

# Запустить отдельные наборы тестов
npm run test:core        # Основные функции (nopeid, customAlphabet, random)
npm run test:features    # Возможности (prefixedId, sortableId, uuid и т.п.)
npm run test:utils       # Утилиты (isValid, collisionProbability)
npm run test:non-secure  # Тесты небезопасной версии
npm run test:idtypes     # Новые типы ID (uuidv7, ulid, snowflake, objectId)
npm run test:encoding    # Sqids, типизированные ID, валидаторы форматов
```

### Покрытие тестов

| Набор тестов | Тесты | Описание |
|------------|-------|-------------|
| **Core** | 81 | nopeid, customAlphabet, customRandom, random, alphabets |
| **Features** | 78 | prefixedId, sortableId, uuid, slugId, shortId, distributedId |
| **Utils** | 56 | isValid, collisionProbability, тесты безопасности |
| **Non-Secure** | 29 | Версия на Math.random() |
| **ID Types** | 31 | uuidv7, ulid, monotonicFactory, snowflake, objectId |
| **Encoding** | 32 | sqids, defineId, isValidUUID, isValidULID |
| **Всего** | **307** | Все проходят |

### Тесты безопасности

У нас есть выделенные тесты безопасности, проверяющие меры по усилению:

```
📦 Безопасность isValid()
  ✅ отклоняет строки с null-байтами
  ✅ отклоняет строки с unicode zero-width символами
  ✅ валидация без раннего возврата (уменьшение timing-утечки)

📦 Защита от Prototype Pollution
  ✅ объект alphabets заморожен
  ✅ alphabets имеет null prototype
  ✅ alphabets нельзя изменить
  ✅ alphabets не наследует свойства Object.prototype

📦 Защита от Modulo Bias (customAlphabet)
  ✅ равномерное распределение для алфавита не степени 2
  ✅ равномерное распределение для 3-символьного алфавита

📦 Защита от Integer Overflow
  ✅ collisionProbability возвращает BigInt для больших значений
  ✅ BigInt точен для значений, превышающих MAX_SAFE_INTEGER
  ✅ totalPossible ограничено MAX_SAFE_INTEGER

📦 Безопасность: качество энтропии
  ✅ случайные байты имеют хорошее распределение энтропии
  ✅ генерируемые ID имеют хорошее распределение символов
  ✅ нет предсказуемых паттернов в последовательных ID
  ✅ chi-square тест на случайность
```

### Стресс-тесты

```
📦 Стресс-тесты
  ✅ быстрая последовательная генерация (10000 ID) - все уникальны
  ✅ цикл исчерпания и перезаполнения пула
  ✅ переменные размеры в последовательности
  ✅ чередование разных генераторов
```

### Сравнительный тест случайности (vs nanoid)

У нас есть выделенный тест сравнения случайности с nanoid:

```bash
npm run test:randomness
```

| Тест | nope-id | nanoid |
|------|---------|--------|
| Хи-квадрат распределение | ✅ χ²=44.69 | ✅ χ²=48.96 |
| Уникальность (100K ID) | ✅ 0 дубликатов | ✅ 0 дубликатов |
| Распределение бит | ✅ 50.03/49.97% | ✅ 49.95/50.05% |
| Последовательная корреляция | ✅ 0.316 ср | ✅ 0.329 ср |
| Покрытие алфавита | ✅ 64/64 (100%) | ✅ 64/64 (100%) |
| Modulo bias (3-символьный) | ✅ 1.05% отклонения | ✅ 1.15% отклонения |

---

## Производительность

> **Об этих числах.** Эти таблицы автоматически обновляются
> [GitHub Actions workflow'ом](.github/workflows/benchmark-on-pr.yml) при каждом PR
> в `main`, на общедоступном раннере `ubuntu-latest`. CI-раннеры обычно медленнее
> современных машин разработчиков и production-серверов, поэтому на реальном железе
> nope-id часто показывает **более высокие** числа, чем вы видите здесь.
> Запустите `npm run benchmark` локально, чтобы увидеть числа на своей машине.

<!-- bench:meta:start -->
_Последнее обновление: 2026-05-29, Node v26.x, ubuntu-latest (GitHub Actions)._
<!-- bench:meta:end -->

### Бенчмарк nope-id vs nanoid

**nope-id выигрывает все 5 основных бенчмарков против nanoid 5.1.11** и предоставляет много дополнительных форматов ID и усиления безопасности сверху.

Запустите бенчмарк сами:

```bash
npm run benchmark
```

**Результаты (Node.js 20+, nanoid 5.1.11, авто-калибровка ~120 мс × лучшее из 7 попыток, с глобальным прогревом для честности; абсолютные числа варьируются от машины к машине):**

<!-- bench:comparison-table:start -->
| Тест | nanoid 5.1.11 | nope-id | Победитель |
|------|--------|---------|--------|
| Базовый (21 символ) | ~5.4M оп/сек | **~37.3M оп/сек** | **nope-id ~7x** |
| Короткий (10 символов) | ~9.9M оп/сек | **~41.9M оп/сек** | **nope-id ~4.2x** |
| Длинный (64 символа) | ~2.0M оп/сек | **~17.6M оп/сек** | **nope-id ~8.9x** |
| Свой алфавит | ~5.4M оп/сек | **~12.2M оп/сек** | **nope-id ~2.3x** |
| Пакетный (100 ID) | ~53K оп/сек | **~413K оп/сек** | **nope-id ~7.8x** |
<!-- bench:comparison-table:end -->

**Результат: nope-id выигрывает 5/5 у nanoid** в URL-безопасных ID, при этом предоставляя множество дополнительных возможностей и усиление безопасности.

### Откуда берётся скорость (и где её нет)

nope-id - самая быстрая **JavaScript** библиотека для очень распространённой задачи: **криптографически безопасный URL-безопасный id на полном 64-символьном алфавите** (ниша nanoid). В этой категории он с большим отрывом обгоняет nanoid на каждом стандартном размере (точные соотношения см. в таблице сравнения выше), а также производит UUIDv7 и ULID **гораздо быстрее**, чем специализированные пакеты (см. таблицы UUID и ULID ниже).

Скорость берётся из инженерии, а не из срезания углов в случайности:

- **Кешированная pool-строка:** пул байт CSPRNG переводится in-place в коды символов алфавита при пополнении, затем **один раз** декодируется в плоскую однобайтовую строку (`idPool.toString('latin1')`), которая кешируется как `idPoolStr`. Каждый вызов `nopeid()` возвращает один `idPoolStr.substring(start, end)`, V8 SlicedString (O(1), zero-copy) для размеров ≥ 13 и крошечная инлайн-копия ниже, вместо того чтобы платить ~50 нс фиксированных накладных `Buffer.toString` на каждый вызов. Тот же трюк используется в `customAlphabet`, `uuid()` и других.
- **16-битное батчевое пополнение:** in-place перевод проходит пул 16-битными чанками через precomputed таблицу `Uint16Array` 64 КиБ, отображающую любые два случайных байта прямо в два кода алфавита, сокращая количество итераций пополнения вдвое (endian-agnostic by construction).
- **Пулированный CSPRNG:** одно заполнение `crypto.getRandomValues()` покрывает тысячи ID при дефолтном размере вместо одного syscall на ID. `uuid()` идёт дальше: предварительно форматирует 4096 v4 UUID (с уже патченными битами версии + RFC 4122 variant) в одну строку 144 КиБ, так что каждый вызов - это просто `substring(start, start+36)`.
- **Bitmask, без modulo:** индекс алфавита берётся из `byte & 63` на 64-символьном алфавите, поэтому на hot path нет rejection sampling или modulo bias.
- **Precomputed таблицы для всего остального:** byte-to-hex для `uuid()`/`uuidv7()`/`objectId()`, char-коды для Crockford в `ulid()`/`monotonicFactory()`, плюс переиспользуемые scratch-буферы уровня модуля (`UUID_BUF`, `SORT_BUF`, `ULID_BUF`), так что путь на каждый вызов никогда не аллоцирует.
- **`customAlphabet` без аллокаций:** читает общий байтовый пул напрямую, отображая rejection-sampled байты в pre-decoded char-code пул, hot path которого тоже `substring(start, end)`; это также ускоряет `slugId()` и `shortId()`.

С чем nope-id **не пытается** соревноваться:

- **Генераторы с маленьким алфавитом** вроде `uid` (16-символьный hex). 21-символьный `uid` это ~84 бит; 21 символ nope-id это ~126 бит, поэтому при равной энтропии nope-id уже впереди по биту, но для коротких hex-ID `uid` - всё ещё хороший выбор.

Так что цель nope-id - быть самым быстрым **при сохранении максимальной случайности на символ**, в одном zero-dependency, dual-module пакете.

### Генерация UUID против пакета `uuid` и нативного `crypto.randomUUID()`

Бенчмарк имеет смысл только против более чем одного инструмента (спасибо автору nanoid за подсказку в [#4](https://github.com/orhanayd/nope-id/issues/4)). Вот честная картина для UUID:

<!-- bench:uuid-table:start -->
| Генератор | оп/сек | |
|---|---|---|
| `crypto.randomUUID()` (Node native, v4) | ~19.9M | C++ binding (только обычный v4) |
| nope-id `uuid()` (v4) | **~22.9M** | 🥇 самый быстрый pure-JS v4 |
| `@lukeed/uuid` `v4()` | ~6.9M | оптимизированный pure-JS v4 |
| `uuid` package `v4()` | ~5.8M | |
| nope-id `uuidv7()` | ~5.3M | **~13x от v7 пакета `uuid`** |
| `uuid` package `v7()` | ~403K | |
<!-- bench:uuid-table:end -->

**Честный подход:** `uuid()` в nope-id предварительно форматирует 4096 v4 UUID на каждое пополнение CSPRNG, поэтому каждый вызов - это просто `substring()`. Результат: как минимум на одном уровне с нативным `crypto.randomUUID()`, а в текущем CI - впереди него. На реальном железе они меняются местами (общий путь энтропии CSPRNG плюс шум раннера), поэтому считайте их практически равными по скорости. Если всё, что вам нужно, это обычный v4 UUID, и вы не хотите зависимости, stdlib справится. Но если вы уже используете nope-id для чего-то ещё (UUIDv7, ULID, Snowflake, ObjectId, Sqids, типизированные ID, короткие ID в стиле nanoid или просто URL-безопасные ID быстрее nanoid), нет смысла тянуться к native; `uuid()` как минимум так же быстр, dual-module и zero-dependency.

### ULID (сортируемый) против пакета `ulid`

ULID - привлекательная альтернатива UUID: **лексикографически сортируемые**, компактные **26 символов** (против 36 у UUID), Crockford base32 (URL-безопасный, case-insensitive), 128-битные и совместимые с UUID, с монотонной опцией, корректно обрабатывающей одну миллисекунду. В отличие от случайного UUID v4, их временной префикс не даёт индексам БД фрагментироваться.

nope-id предоставляет соответствующий спецификации `ulid()` плюс изолированную `monotonicFactory()`. Тот же 26-символьный формат, что и у пакета `ulid`, оба crypto-backed:

<!-- bench:ulid-table:start -->
| Генератор | оп/сек |
|---|---|
| nope-id `ulid()` | **~2.7M** |
| `ulid` package | ~29K |
| nope-id `monotonicFactory()` | **~8.2M** |
| `ulid` package (monotonic) | ~2.1M |
<!-- bench:ulid-table:end -->

nope-id гораздо быстрее для обычного `ulid()`, потому что он берёт случайность из пулированного буфера (одно заполнение на 16 ID), тогда как пакет `ulid` получает случайность на каждый символ. Декодируйте timestamp у любого из них через `decodeTime()`. (Пакет `ulid` тоже zero-dependency.)

### Sortable head-to-head: `sparkid` против nope-id `sortableId()`

Оба - CSPRNG-backed time-sortable + monotonic генераторы с похожей внутренней архитектурой (предтранслированный пул случайных байт, lookup-таблицы, кэшированный prefix). Дефолты разные: sparkid - 21 символ Base58, у nope-id `sortableId()` - 22 символа Crockford Base32 (22 - безопасный минимум, чтобы сохранить сильную монотонность). Так что это сравнение натуральных дефолтов, а не строго одинакового формата.

<!-- bench:sortable-table:start -->
| Генератор | оп/сек |
|---|---|
| nope-id `sortableId()` (22-char Crockford) | ~6.1M |
| `sparkid` (21-char Base58) | **~9.5M** |
<!-- bench:sortable-table:end -->

### Скорость vs энтропия: где находится каждая библиотека

Для генератора ID важны две вещи: **скорость** и **энтропия**, количество реальной случайности, которую несёт каждый id (его безопасность от угадывания). Все они - хорошие библиотеки; таблица показывает trade-off каждой, измеренный на 21 символе, где длина настраиваемая:

<!-- bench:speed-vs-entropy-table:start -->
| Генератор | оп/сек | энтропия / id | источник случайности |
|---|---|---|---|
| **nope-id `nopeid()`** | **~37.3M** | **~126 бит (64-символьный URL-безопасный)** | **CSPRNG** |
| `uid/secure` | ~6.2M | ~84 бит (16-символьный hex) | CSPRNG |
| nanoid | ~5.4M | ~126 бит (64-символьный URL-безопасный) | CSPRNG |
| `sparkid` | ~9.5M | ~76 бит случайных (Base58, сортируемый по времени) | CSPRNG |
| `rndm` | ~2.7M | ~125 бит, но предсказуемые | `Math.random` (не безопасный) |
| `secure-random-string` | ~376K | ~126 бит (base64, не URL-безопасный) | CSPRNG |
| cuid2 `createId()` | ~5.1K | 24 символа, hash-производный | CSPRNG + SHA-3 |
<!-- bench:speed-vs-entropy-table:end -->

Читая по двум осям, **скорость** и **безопасность**, каждая другая библиотека чем-то жертвует:

- **`uid/secure`** быстр, но платит меньшим алфавитом: ~84 бита на 21-символьный id против ~126 у nope-id. Для равной безопасности `uid` пришлось бы удлинить, в этот момент nope-id уже впереди по биту.
- **`rndm`** тоже быстр, но построен на `Math.random`, поэтому его биты предсказуемы; его собственный README называет его "не криптографически безопасным".
- **`secure-random-string`** соответствует энтропии nope-id, но примерно в 80 раз медленнее и выдаёт base64 (не URL-безопасный).
- **cuid2** намеренно тратит скорость на усиленную, sharding-безопасную, hash-based модель.
- **`sparkid`** работает на CSPRNG, сортируется по времени, монотонен и достаточно быстр в своей нише; обменивает 8 из 21 символов на временной префикс Base58, оставляя ~76 бит непредсказуемой случайности на id (на уровне ULID). Если вам нужна **максимальная случайность на id**, `nopeid()` в nope-id сохраняет все 126 бит при той же длине. Если вам конкретно нужно **sortable + monotonic**, sparkid силён в своей нише (см. head-to-head выше); для ULID-совместимого вывода в 26 символов Crockford в nope-id есть `sortableId()`, `ulid()` и `monotonicFactory()`.
- **nanoid** точно соответствует энтропии nope-id (тот же 64-символьный алфавит); nope-id просто в <!-- bench:basic-21-ratio:start -->~7x<!-- bench:basic-21-ratio:end --> раза быстрее на дефолтном 21-символьном размере.

nope-id - единственный ряд, у которого есть **все три сразу**: максимальная энтропия на символ (126 бит), реальный CSPRNG и высочайшая скорость. Это и есть цель всего проекта - быть быстрым, никогда не тратя случайность ради этого. (Для обычного v4 UUID нативный `crypto.randomUUID()` примерно на одном уровне с `uuid()` nope-id на 122 битах в C++; берите stdlib, если вам нужен только v4 UUID и вы не хотите зависимости.)

### Производительность дополнительных возможностей

Эти возможности эксклюзивны для nope-id (у nanoid их нет):

<!-- bench:extras-table:start -->
| Функция | Производительность |
|---------|-------------|
| `sortableId()` | ~6.1M оп/сек |
| `prefixedId()` | ~27.6M оп/сек |
| `uuid()` | ~23.1M оп/сек |
| `slugId()` | ~5.2M оп/сек |
| `shortId()` | ~11M оп/сек |
| `isValid()` | ~7.0M оп/сек |
| `uuidv7()` | ~5.3M оп/сек |
| `ulid()` | ~2.7M оп/сек |
| `monotonicFactory()` | ~8.2M оп/сек |
| `snowflake` (factory) | ~4.1M оп/сек |
| `objectId()` | ~6.6M оп/сек |
| `sqids.encode()` | ~215K оп/сек |
<!-- bench:extras-table:end -->

---

## Отказ от ответственности

Хотя nope-id использует криптографически безопасные генераторы случайных чисел (`crypto.getRandomValues`) и реализует security best practices, **никакое ПО не может гарантировать 100% случайность или абсолютную безопасность**. Качество случайности в конечном счёте зависит от источника энтропии операционной системы.

Для приложений с экстремально высокой безопасностью (например, криптографические ключи, долгосрочные секреты) рассмотрите специализированные криптографические библиотеки, прошедшие формальный аудит безопасности.

nope-id предоставляется "как есть" без каких-либо гарантий. Всегда оценивайте, отвечает ли он вашим конкретным требованиям к безопасности.

---

## Лицензия

MIT
