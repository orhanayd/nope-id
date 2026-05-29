# nope-id

> 🌐 **Başka dilde oku:** [English](README.md) · [Türkçe](README.tr.md) · [Русский](README.ru.md)

JavaScript için minik, güvenli, URL-dostu benzersiz string ID üreteci.

**Daha hızlı, daha güvenli ve ekstra özelliklerle gelen bir nanoid alternatifi!**

<!-- bench:headline:start -->
- **Daha Hızlı** - nanoid'den 2x ila 9x daha hızlı (CSPRNG, tam URL-safe alfabe); 5 temel benchmark'ın hepsini kazanıyor ([benchmark'lara bak](#performans))
<!-- bench:headline:end -->
- **Güvenlik Sertleştirilmiş** - Azaltılmış zamanlama sızıntı doğrulayıcıları, modulo bias eliminasyonu, prototype pollution koruması ([güvenlik](#güvenlik))
- **İyi Test Edilmiş** - Güvenlik ve entropi testleri dahil 342 test ([test etme](#test-etme))
- **Kriptografik Olarak Güvenli** - `webcrypto.getRandomValues()` (CSPRNG) kullanır
- **Sıfır Bağımlılık** - Dış bağımlılık yok
- **URL-safe** - `A-Za-z0-9_-` karakterlerini kullanır
- **Dual Module** - Hem ESM (`import`) hem CommonJS (`require`) ile çalışır
- **TypeScript** - Tam tür tanımları dahil
- **Çakışmaya Dayanıklı** - Kesin monotonik sortable ID'ler, kaynak-etiketli dağıtık ID'ler
- **Birçok ID Formatı** - UUID v4 & **v7**, **ULID** (spec uyumlu + monotonik factory), **Snowflake**, **MongoDB ObjectId**
- **Ekstra Özellikler** - Prefix'li ID'ler, sortable ID'ler, **Sqids** (geri çevrilebilir kodlama), **typed ID'ler**, format doğrulayıcılar ve daha fazlası!

## Kurulum

```bash
npm install nope-id
```

## Hızlı Başlangıç

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

## API Referansı

### Çekirdek Fonksiyonlar

#### `nopeid(size = 21)`

Güvenli, URL-safe benzersiz bir ID üretir.

```javascript
// ES Modules
import { nopeid } from 'nope-id'

nopeid()    // "V1StGXR8_Z5jdHi6B-myT" (21 karakter)
nopeid(10)  // "IRFa-VaY2b" (10 karakter)
nopeid(32)  // "V1StGXR8_Z5jdHi6B-myTV1StGXR8_Z5" (32 karakter)
nopeid(0)   // "" (sıfır/negatif için boş string)

// CommonJS
const { nopeid } = require('nope-id')
const id = nopeid() // "V1StGXR8_Z5jdHi6B-myT"
```

#### `customAlphabet(alphabet, defaultSize = 21)`

Kendi alfabenizle özel bir ID üreteci oluşturur.

```javascript
// ES Modules
import { customAlphabet } from 'nope-id'

// Hex ID'ler
const hexId = customAlphabet('0123456789abcdef', 16)
hexId()   // "4f90d13a42f17f80"
hexId(8)  // "a3b2c1d4"

// Sadece rakamlar
const numericId = customAlphabet('0123456789', 8)
numericId() // "48293751"

// Özel karakterler
const customId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)
customId() // "BKWXYZ"

// Binary ID'ler
const binaryId = customAlphabet('01', 16)
binaryId() // "1010110011001010"

// CommonJS
const { customAlphabet } = require('nope-id')
const hexGen = customAlphabet('0123456789abcdef', 16)
const id = hexGen() // "4f90d13a42f17f80"
```

#### `customRandom(alphabet, defaultSize, getRandom)`

Kendi random fonksiyonunuzla özel ID üreteci oluşturur.

```javascript
// ES Modules
import { customRandom } from 'nope-id'

// Özel random kaynağı kullan
const customGen = customRandom(
  'abcdef',
  10,
  (size) => new Uint8Array(size).fill(1)  // Test için deterministik
)
customGen() // Deterministik çıktı

// CommonJS
const { customRandom } = require('nope-id')
```

#### `random(bytes)`

Kriptografik olarak güvenli rastgele byte'lar üretir.

```javascript
// ES Modules
import { random } from 'nope-id'

const bytes = random(16)  // Uint8Array(16) random byte ile
const bytes2 = random(32) // Uint8Array(32) random byte ile

// CommonJS
const { random } = require('nope-id')
const bytes = random(16)
```

---

### ID Üretim Fonksiyonları

#### `prefixedId(prefix, size = 21, separator = '_')`

Prefix'li bir ID üretir, veritabanı kayıtları için idealdir!

```javascript
// ES Modules
import { prefixedId } from 'nope-id'

prefixedId('user')           // "user_V1StGXR8_Z5jdHi6B-myT"
prefixedId('order', 10)      // "order_IRFa-VaY2b"
prefixedId('prod', 8, '-')   // "prod-Z5jdHi6B"
prefixedId('cust', 12, ':')  // "cust:a1b2c3d4e5f6"

// Gerçek dünya örnekleri
const userId = prefixedId('usr')       // "usr_V1StGXR8_Z5jdHi6B-myT"
const orderId = prefixedId('ord')      // "ord_IRFa-VaY2bKwxyz..."
const productId = prefixedId('prod')   // "prod_Z5jdHi6B-myT..."
const transactionId = prefixedId('txn') // "txn_8_Z5jdHi6B..."

// CommonJS
const { prefixedId } = require('nope-id')
const id = prefixedId('user') // "user_V1StGXR8_Z5jdHi6B-myT"
```

#### `sortableId(size = 22)`

Monotonik garantili ULID-benzeri sortable ID üretir. Lexicographic sıralama için Crockford Base32 kullanır.

**Özellikler:**
- 10 karakter timestamp + 12 karakter random = 22 karakter varsayılan
- Kronolojik olarak sıralanabilir (lexicographic sıra)
- Aynı milisaniyedeki ID'ler kesin olarak monotonik artar
- `decodeTime()` ile timestamp çözülebilir
- 22'den büyük boyutlar ekstra Crockford Base32 random karakterlerle uzatılır; 22'den küçük boyutlar timestamp prefix'ine kadar kısaltılır (monotonik garantiyi korumak için size ≥ 22 kullanın)

```javascript
// ES Modules
import { sortableId, decodeTime } from 'nope-id'

const id1 = sortableId() // "01HGW2BBK0QZRMTX12345A"
// biraz bekle...
const id2 = sortableId() // "01HGW2BBK1ABCDEFGHIJKL"

// Kronolojik olarak sıralanabilir
console.log(id1 < id2) // true

// Aynı milisaniye - monotonik artar
const ids = []
for (let i = 0; i < 5; i++) {
  ids.push(sortableId())
}
// Hepsi benzersiz ve kesin olarak artıyor
// ids[0] < ids[1] < ids[2] < ids[3] < ids[4]

// Özel boyut
sortableId(30) // 30 karakter sortable ID

// Timestamp'i çöz
const id = sortableId()
const date = decodeTime(id)
console.log(date) // ID üretildiğinde oluşan Date objesi

// CommonJS
const { sortableId, decodeTime } = require('nope-id')
const id = sortableId()
const timestamp = decodeTime(id)
```

#### `decodeTime(sortableIdStr)`

Bir sortable ID'den timestamp'i çıkarır.

```javascript
// ES Modules
import { sortableId, decodeTime } from 'nope-id'

const id = sortableId()
const date = decodeTime(id)

console.log(date)            // 2024-01-15T10:30:00.000Z
console.log(date.getTime())  // 1705314600000

// Hata yönetimi
try {
  decodeTime('invalid')  // hata fırlatır
} catch (e) {
  console.log('Geçersiz sortable ID')
}

// CommonJS
const { sortableId, decodeTime } = require('nope-id')
```

#### `generateMany(count, size = 21)`

Tek seferde birden çok benzersiz ID üretir.

```javascript
// ES Modules
import { generateMany } from 'nope-id'

const ids = generateMany(5)
// ["V1StGXR8_Z5jdHi6B-myT", "IRFa-VaY2bKwxyz...", ...]

const shortIds = generateMany(100, 8)
// 8 karakterlik 100 kısa ID

generateMany(0)   // [] (boş array)
generateMany(-5)  // [] (boş array)

// Toplu insert örneği
const userIds = generateMany(1000, 21)
await db.users.insertMany(
  userIds.map(id => ({ id, createdAt: new Date() }))
)

// CommonJS
const { generateMany } = require('nope-id')
const ids = generateMany(100)
```

#### `uuid()`

UUID v4 uyumlu bir string üretir.

```javascript
// ES Modules
import { uuid } from 'nope-id'

uuid() // "110ec58a-a0f2-4ac4-8393-c866d813b8d1"
uuid() // "f47ac10b-58cc-4372-a567-0e02b2c3d479"

// UUID bekleyen veritabanlarında kullanım
const user = {
  id: uuid(),
  name: 'John'
}

// CommonJS
const { uuid } = require('nope-id')
const id = uuid()
```

#### `slugId(size = 12)`

Slug-dostu ID üretir (sadece küçük harf + rakam). URL'ler için mükemmel!

```javascript
// ES Modules
import { slugId } from 'nope-id'

slugId()   // "a8b3c9d2e1f4"
slugId(8)  // "x7y2z9w4"
slugId(16) // "a1b2c3d4e5f6g7h8"

// URL-dostu kullanım
const articleSlug = `my-article-${slugId()}`
// "my-article-a8b3c9d2e1f4"

// CommonJS
const { slugId } = require('nope-id')
const slug = slugId()
```

#### `shortId(size = 8)`

Karışık görünümlü karakterler içermeyen (0/O, 1/l/I yok) kısa ID üretir. Kullanıcıya yönelik kodlar için mükemmel!

```javascript
// ES Modules
import { shortId } from 'nope-id'

shortId()   // "aBc7XyZ9"
shortId(6)  // "Kp3Wn8"
shortId(10) // "aBc7XyZ9Kp"

// Şunlar için ideal:
// - Doğrulama kodları
// - Kısa URL'ler
// - Kullanıcının okuyabileceği referanslar
// - Bilet numaraları

const verificationCode = shortId(6) // "Kp3Wn8"
const ticketNumber = shortId(8)     // "aBc7XyZ9"

// CommonJS
const { shortId } = require('nope-id')
const code = shortId(6)
```

#### `nopeidAsync(size = 21)`

Engelleyici olmayan işlemler için async versiyon.

```javascript
// ES Modules
import { nopeidAsync } from 'nope-id'

const id = await nopeidAsync()     // "V1StGXR8_Z5jdHi6B-myT"
const id2 = await nopeidAsync(32)  // 32 karakter async ID

// Paralel üretim
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

### Dağıtık Sistem Fonksiyonları

#### `getFingerprint()`

Mevcut process/cihaz için benzersiz bir fingerprint döndürür. Bir kez üretilir ve cache'lenir.

```javascript
// ES Modules
import { getFingerprint } from 'nope-id'

const fp = getFingerprint() // "aB3x" (4 karakter)
const fp2 = getFingerprint() // "aB3x" (aynı değer, cache'lenmiş)

// Dağıtık sistemlerde origin'i tanımlamak için kullanışlı
console.log(`Process tarafından üretilen ID: ${getFingerprint()}`)

// CommonJS
const { getFingerprint } = require('nope-id')
const fingerprint = getFingerprint()
```

#### `distributedId(size = 25)`

Process fingerprint önekli bir ID üretir. Çok-süreçli / çok-node'lu sistemlerde ID kaynağını izlemek için kullanışlıdır. Çakışma direnci rastgele kuyruktan gelir — `size` ona yer bırakmalı (en az 16; daha küçük değerler hata fırlatır).

**Format:** `fingerprint_randomPart`

```javascript
// ES Modules
import { distributedId, getFingerprint } from 'nope-id'

distributedId()   // "aB3x_V1StGXR8_Z5jdHi6B" (25 karakter)
distributedId(30) // "aB3x_V1StGXR8_Z5jdHi6B-myT1" (30 karakter)
distributedId(8)  // hata fırlatır — size en az 16 olmalı

// Çok-süreçli / çok-node'lu sistemlerde her kaynağın ID'leri kendi fingerprint'ini taşır
// Node 1: "aB3x_V1StGXR8_Z5jdHi6B"
// Node 2: "kL9m_IRFa-VaY2bKwxyz12"
// Node 3: "pQ7r_Z5jdHi6B-myTV1St8"

// Bir ID'yi hangi kaynak ürettiğini belirle
const id = distributedId()
const nodeFingerprint = id.split('_')[0]
console.log(`Üreten node: ${nodeFingerprint}`)

// CommonJS
const { distributedId } = require('nope-id')
const id = distributedId()
```

---

### Yardımcı Fonksiyonlar

#### `isValid(id, alphabet = urlAlphabet)`

Bir string'in verilen alfabe için geçerli bir ID olup olmadığını doğrular.

```javascript
// ES Modules
import { isValid, urlAlphabet, alphabets } from 'nope-id'

isValid('V1StGXR8_Z5jdHi6B-myT')  // true
isValid('')                        // false
isValid(null)                      // false
isValid('abc@#$')                  // false (geçersiz karakter)

// Özel alfabe ile doğrula
isValid('abc123', 'abc123')        // true
isValid('ABC', 'abc')              // false
isValid('12345678', alphabets.numbers) // true

// CommonJS
const { isValid } = require('nope-id')
const valid = isValid('V1StGXR8_Z5jdHi6B-myT')
```

#### `collisionProbability(idLength, alphabetSize = 64)`

Verilen parametreler için çakışma olasılığını hesaplar.

```javascript
// ES Modules
import { collisionProbability } from 'nope-id'

const info = collisionProbability(21)
console.log(info)
// {
//   totalPossible: 9007199254740991,   // MAX_SAFE_INTEGER'a sınırlandırılmış (tam değer için totalPossibleBigInt kullan)
//   totalPossibleBigInt: 85070591730234615865843651857942052864n, // 64^21 ≈ 8.5e37
//   probabilityForBillion: 5.877471748233966e-21, // Math.expm1 ile doğru hesaplanır
//   safeCount: 1.086e+19,              // bu kadar ID üretildikten sonra ~%50 çakışma
//   yearsFor1Percent: 4.133e+7         // 1 ID/ms hızında %1 çakışmaya kaç yıl
// }

// Farklı uzunlukları karşılaştır
collisionProbability(8)   // Çok daha yüksek çakışma riski
collisionProbability(32)  // Çok düşük çakışma riski

// Özel alfabe boyutu
collisionProbability(21, 62)  // Sadece alphanumeric
collisionProbability(21, 16)  // Sadece hex

// CommonJS
const { collisionProbability } = require('nope-id')
const info = collisionProbability(21)
```

---

### Hazır Alfabeler

```javascript
// ES Modules
import { alphabets, customAlphabet } from 'nope-id'

// Mevcut alfabeler
alphabets.alphanumeric    // "0-9A-Za-z" (62 karakter)
alphabets.lowercase       // "a-z" (26 karakter)
alphabets.uppercase       // "A-Z" (26 karakter)
alphabets.numbers         // "0-9" (10 karakter)
alphabets.hexLower        // "0-9a-f" (16 karakter)
alphabets.hexUpper        // "0-9A-F" (16 karakter)
alphabets.nolookalikes    // Karıştırılan karakterler yok (49 karakter)
alphabets.nolookalikesSafe // Ekstra güvenli versiyon (34 karakter)
alphabets.binary          // "01" (2 karakter)
alphabets.octal           // "0-7" (8 karakter)
alphabets.base32          // RFC 4648 Base32 (32 karakter)
alphabets.base32Lower     // Küçük harf Base32 (32 karakter)
alphabets.base58          // Bitcoin Base58 (58 karakter)
alphabets.filename        // Dosya-adı-güvenli (64 karakter)

// customAlphabet ile kullanım
const hexGen = customAlphabet(alphabets.hexLower, 32)
hexGen() // "a1b2c3d4e5f67890abcdef1234567890"

const base58Gen = customAlphabet(alphabets.base58, 22)
base58Gen() // Bitcoin tarzı ID

const safeGen = customAlphabet(alphabets.nolookalikesSafe, 8)
safeGen() // Çok okunabilir kod

// CommonJS
const { alphabets, customAlphabet } = require('nope-id')
const gen = customAlphabet(alphabets.hexLower, 16)
```

---

## Ek ID Formatları & Yardımcılar

Bu güvenli-sadece üreteçler ve yardımcılar tree-shakeable named export olarak sunulur ve `nopeid()`'in **hot path'ine hiç dokunmaz**; sadece kullanacağınızı import edin.

### `uuidv7()`

Zaman-sıralı UUID (RFC 9562), veritabanı-indeksi dostu ve oluşturma zamanına göre sıralanabilir. İlk 48 bit Unix-ms timestamp'i kodlar.

```javascript
import { uuidv7, isValidUUID } from 'nope-id'

uuidv7()                  // "0192f3c1-8e2a-7b3c-9d4e-5f60718293a4"
isValidUUID(uuidv7(), 7)  // true
```

### `ulid(seedTime?)` & `monotonicFactory()`

Spec-uyumlu 26-karakter ULID (Crockford Base32: 10 timestamp + 16 random). `ulid()` her çağrıda taze randomness kullanır; `monotonicFactory()` aynı milisaniye içinde kesin olarak artan ID'leri garanti eden, **izole** state'e sahip bir üreteç döndürür (global `sortableId()` state'ine dokunmaz).

```javascript
import { ulid, monotonicFactory, decodeTime } from 'nope-id'

ulid()              // "01ARZ3NDEKTSV4RRFFQ69G5FAV"
decodeTime(ulid())  // Date

const next = monotonicFactory()
next() < next()     // true (aynı ms, kesin olarak artar)
```

### `snowflakeFactory(options)`, `snowflake()` & `decodeSnowflake(id)`

Twitter-tarzı 64-bit dağıtık ID'ler **string** olarak döndürülür (BigInt-güvenli). Layout: 41-bit timestamp · 10-bit node id · 12-bit sequence. Her factory kendi sequence state'ine sahiptir (node başına koordinasyonsuz).

```javascript
import { snowflakeFactory, decodeSnowflake, snowflake } from 'nope-id'

const next = snowflakeFactory({ nodeId: 1 })  // opsiyonel: { epoch }
const id = next()                              // "1838219834728448001"
decodeSnowflake(id)  // { timestamp: Date, nodeId: 1, sequence: 0 }

snowflake()  // varsayılan tek-node üreteç (node id fingerprint'ten türetilir)
```

### `objectId()` & `decodeObjectIdTime(id)`

MongoDB ObjectId-uyumlu 24-karakter hex (4-byte timestamp + 5-byte process başına değer + 3-byte counter).

```javascript
import { objectId, decodeObjectIdTime } from 'nope-id'

objectId()                      // "65f1c3e2a1b2c3d4e5f60718"
decodeObjectIdTime(objectId())  // Date
```

### `sqidsFactory(options)`: geri çevrilebilir integer kodlama

Negatif olmayan integer dizilerini kısa, URL-safe, **geri çevrilebilir** string'lere kodlar, örneğin sıralı veritabanı ID'lerini URL'lerde gizlemek için. Bu obfuscation'dır, **şifreleme değil**.

```javascript
import { sqidsFactory } from 'nope-id'

const sqids = sqidsFactory()        // { alphabet?, minLength?, blocklist? }
const id = sqids.encode([1, 2, 3])  // "86Rf07"
sqids.decode(id)                    // [1, 2, 3]
```

> Varsayılan **hiçbir** küfür blocklist'i içermez (boyutu küçük tutmak için). İhtiyacınız varsa kendi `blocklist`'inizi geçirin.

### `defineId(prefix, options?)`: typed prefix'li ID'ler

Stripe-tarzı typed ID'ler bir üreteç, type guard ve parser ile gelir. TypeScript'te üretilen ID `` `${prefix}_${string}` `` olarak typed'tır.

```typescript
import { defineId } from 'nope-id'

const UserId = defineId('user')   // { size?, separator?, alphabet? }
const id = UserId.generate()      // tip: `user_${string}`
UserId.is(id)                     // true (type guard tipi daraltır)
UserId.parse('user_abc')          // { prefix: 'user', id: 'abc' }  (veya null)
```

### `isValidUUID(id, version?)` & `isValidULID(id)`

UUID ve ULID string'leri için format doğrulayıcıları.

```javascript
import { isValidUUID, isValidULID } from 'nope-id'

isValidUUID('110ec58a-a0f2-4ac4-8393-c866d813b8d1')  // true
isValidUUID(uuidv7(), 7)                              // true (versiyon sabitlenmiş)
isValidULID('01ARZ3NDEKTSV4RRFFQ69G5FAV')             // true
```

> Bu formatlar kriptografik randomness kullanır ve **sadece güvenli versiyonda** vardır; `nope-id/non-secure`'da yer almazlar.

---

## Sıralanabilir, monotonik ID'ler

### `orderedId()`

Sabit formatlı, kesin monotonik, leksikografik olarak sıralanabilir 21 karakterlik Base58 ID. Düzen: 8 zaman damgası + 5 sayaç + 8 rastgele.

[sparkid](https://www.npmjs.com/package/sparkid) ile aynı yapıda, fakat bir karakter daha fazla rastgele entropi (~47 bit, sparkid'in ~41'ine karşı), daha güçlü garantiler (saat geri gidince clamp, sayaç taşmasında busy-wait yerine sentetik zaman ilerletme) ve Node LTS üzerinde ölçüm gürültüsü içinde karşılaştırılabilir throughput sunar.

```javascript
import { orderedId } from 'nope-id'

orderedId()                                // "1okw67hF111114mDXU1ez"

// Kesin monotonluk NTP düzeltmeleri, container resume vb. durumlarda korunur.
// Date.now() geri gittiğinde orderedId daha büyük olan cache'lenmiş prefix'i yeniden
// kullanır ve sayacı ilerletmeye devam eder; sonraki ID yine kesinlikle daha büyüktür.
orderedId() < orderedId() // true

// Zaman, sayaç ve rastgele kuyruğu geri ayrıştır
orderedId.parse('1okw67hF111114mDXU1ez')
// { timestamp: Date, counter: 1, random: '4mDXU1ez' }

// 21 baytlık ASCII gösterimi (latin1 karakter kodları; paketlenmiş binary DEĞİL)
orderedId.asciiBytes() // Uint8Array(21)

// Toplu üretim: saati batch başına bir kez (ve her 4096 ID'de bir) okur, bu yüzden
// orderedId()'yi döngüde çağırmaktan ID başına daha hızlıdır. Her zaman kesinlikle artar.
orderedId.many(1000) // 1000 sıralanabilir ID'lik string[]
```

**`orderedId()`'yi `sortableId()` yerine ne zaman seçmeli:**
- Kesin monotoniktir (`b > a`), sadece azalmayan değil.
- Sayaç taşması, busy-wait döngüsü yerine sentetik bir zaman ilerletmesi yapar.
- Saat geri gitmesi clamp'lenir; daha önce döndürdüğünden daha küçük bir zaman damgasını asla üretmez.
- Çıktı her zaman 21 karakterdir; boyut parametresi yok, truncation tuzağı yok.

`sortableId()` artık legacy'dir. Yeni kodda `orderedId()`'yi tercih edin.

**`orderedId.many(count)` ile toplu üretim**

`orderedId.many(count)`, `count` adet kesin monotonik ID'den oluşan bir dizi döndürür. Saati batch'in başında bir kez, sonra yalnızca her 4096 ID'de bir okur; böylece ID başına `Date.now()` maliyeti, hiçbir arka plan timer'ı olmadan ve per-call `orderedId()` yoluna hiç dokunmadan batch geneline yayılır. Sıralama her zaman kesindir (sayaç, aynı milisaniyedeki ID'leri ayırır); gömülü zaman damgası en fazla ~4096 ID üretme süresi kadar gerçek zamanın gerisinde kalabilir (pratikte milisaniyenin altında). Node LTS üzerinde bu, `orderedId()`'yi döngüde çağırmanın kabaca 1.7 katı throughput'tur. `count <= 0` `[]` döndürür; `count > 1_000_000` hata fırlatır.

```javascript
const ids = orderedId.many(10000) // 10.000 sıralanabilir ID, her 4096'da bir saat okuması
ids[0] < ids[1] // true (kesinlikle artar)
```

> orderedId tasarımı gereği sıralanabilirdir; prefix'i oluşturulma zamanını açığa çıkarır. **Bunu bir bearer secret olarak kullanmayın.** Secret'lar için `secureToken()` kullanın.

---

## Güvenli token'lar (bearer secret'lar)

`nopeid()`, throughput için uzun ömürlü, cache'lenmiş bir havuz string'inin substring'lerini döndürür. Bu cache public ID'ler için sorun değildir; ama bearer secret'lar (API key'leri, session token'ları, parola sıfırlama token'ları) için, bir bellek dökümünün henüz talep edilmemiş token'ları açığa çıkarabileceği anlamına gelir. `secureToken` ailesi bu risk sınıfını ortadan kaldırır: her çağrı kendi buffer'ını ayırır, CSPRNG'den doldurur, alfabeye eşler ve geri dönmeden önce ham baytları sıfırlar.

> Döndürülen JavaScript string'inin kendisi sıfırlanamaz; V8 string'leri değişmezdir ve GC heap'inde yaşar. Tehdit modeliniz bellekten temizlenebilir secret'lar gerektiriyorsa, baytları `Buffer`/`Uint8Array` olarak tutun ve asla `.toString()` yapmayın.

### `secureToken(size = 48)`

```javascript
import { secureToken } from 'nope-id'

secureToken()       // 48 karakterlik URL-safe token (varsayılan)
secureToken(64)     // 64 karakterlik token
secureToken(32)     // 32 minimumdur; daha küçüğü hata fırlatır
```

- URL-safe 64 karakterlik alfabe (`A-Za-z0-9_-`)
- Bias'sız (`byte & 63`)
- Gelecek-token cache'i yok; ham baytlar string'e çevrildikten sonra sıfırlanır
- **Token'ları hash'lenmiş saklayın** (örn. SHA-256), asla ham token'ı değil

### `apiKey(prefix = 'nope_live', size = 40)`

```javascript
import { apiKey } from 'nope-id'

apiKey()                       // "nope_live_<40 karakter>"
apiKey('sk_live', 40)          // "sk_live_<40 karakter>"
apiKey('myapp_test', 32)       // "myapp_test_<32 karakter>"
```

`secureToken` üzerine ince bir sarmalayıcı: prefix'i doğrular (boş değil, boşluk yok) ve `_` ile birleştirir. İsimlendirme kuralı (Stripe tarzı `sk_live_`, GitHub tarzı `ghp_` vb.) size kalmış.

### `defineToken(prefix, options?)`: tipli güvenli token'lar

Stripe tarzı: bir `generate` / `is` / `parse` üçlüsü; fakat gövde `secureToken`'dan gelir ve alfabe, kararlılık için URL-safe 64 karaktere sabitlenmiştir.

```javascript
import { defineToken } from 'nope-id'

const SessionToken = defineToken('sess', { size: 48 })

const t = SessionToken.generate()    // "sess_<48 karakter>"
SessionToken.is(t)                   // true
SessionToken.parse(t)                // { prefix: 'sess', token: '<48 karakter>' }
SessionToken.is('sess_short')        // false (uzunluk zorlanır)
```

---

## Doğru ID'yi seçin

| Kullanım durumu | API | Boyut | Neden |
|---|---|---|---|
| Log / request ID | `nopeid(16)` | 16 | En hızlı, havuzlu, public-safe |
| Public URL ID | `nopeid(21)` | 21 | 126 bit, public ID'ler için gelecek-token sorunu yok |
| DB object ID | `nopeid(21)` veya `orderedId()` | 21 | Rastgele veya sıralanabilir |
| Sıralanabilir DB primary key | `orderedId()` | 21 | Leksikografik sıralanabilir, kesin monotonik, B-tree dostu |
| Davet / doğrulama kodu | `shortId(12)` | 12 | Benzer karakterler yok, kullanıcı yazabilir |
| API anahtarı | `apiKey('myapp_live', 40)` | önek + 40 | Önekli, havuzsuz, 240+ bit |
| Oturum token'ı | `secureToken(48)` | 48 | Havuzsuz, geçici |
| Parola sıfırlama token'ı | `secureToken(48)` | 48 | Tek kullanımlık; saklamadan önce hash'leyin |
| E-posta doğrulama | `secureToken(40)` | 40 | TTL + tek kullanımlık |
| Ödeme / yüksek değer | `secureToken(64)` | 64 | Maksimum entropi bütçesi |

Net kural:
- **Havuzlu, hızlı, public-safe** → `nopeid()` ailesi
- **Havuzsuz, geçici, sunucu secret'ı** → `secureToken()` ailesi
- **Zaman-sıralı, monotonik, DB-dostu** → `orderedId()`

---

## Güvenli Olmayan Versiyon

Kritik olmayan kullanımlar için (UI element ID'leri, geçici anahtarlar vb.), daha hızlı non-secure versiyonu kullanabilirsiniz:

```javascript
// ES Modules
import { nopeid, sortableId, prefixedId } from 'nope-id/non-secure'

nopeid()      // Math.random() kullanır - hızlı ama kriptografik olarak güvenli değil
sortableId()  // Hâlâ monotonik garanti var
prefixedId('user') // Aynı şekilde çalışır

// CommonJS
const { nopeid, sortableId } = require('nope-id/non-secure')
const id = nopeid()
```

**Uyarı:** Token'lar, parolalar veya session ID'leri gibi güvenlik-hassas amaçlar için KULLANMAYIN!

**Non-secure versiyon kullanım durumları:**
- UI element ID'leri (React key'leri vb.)
- Geçici dosya adları
- Log korelasyon ID'leri
- Test fixture'ları
- Kriptografik güvenliğin gerekli olmadığı her durum

---

## Gerçek Dünya Örnekleri

### Veritabanı Primary Key'leri

```javascript
// ES Modules
import { prefixedId, orderedId } from 'nope-id'

// Prefix'li ID'lerle user tablosu
const user = {
  id: prefixedId('usr'),  // "usr_V1StGXR8_Z5jdHi6B-myT"
  email: 'john@example.com'
}

// Kesin monotonik, sortable ID'lerle order'lar (oluşturma zamanına göre otomatik sıralı)
const order = {
  id: orderedId(),  // "1okw67hF111114mDXU1ez"
  userId: user.id,
  total: 99.99
}

// CommonJS
const { prefixedId, orderedId } = require('nope-id')
```

### API Token Üretimi

```javascript
// ES Modules
import { apiKey, secureToken, defineToken } from 'nope-id'

// Önekli API anahtarı (havuzsuz, geçici, önek doğrulanır)
const key = apiKey('sk_live', 40)        // "sk_live_<40 karakter>"

// Refresh / oturum / parola sıfırlama token'ları
const refreshToken = secureToken(48)     // 48 karakter URL-safe, CSPRNG, sıfırlanır

// generate / is / parse üçlüsü olan tipli token
const SessionToken = defineToken('sess', { size: 48 })
const sessionToken = SessionToken.generate()

// CommonJS
const { apiKey, secureToken, defineToken } = require('nope-id')
```

> `secureToken` ailesi `nopeid()` string havuzunu bypass eder — her çağrı kendi CSPRNG dolumudur, bu yüzden bir bellek dump'ı henüz üretilmemiş token'ları açığa çıkaramaz. Bearer secret'lar için bunu kullanın. Genel ID'ler için `nopeid()` / `prefixedId()` yeterlidir.

### URL Kısaltıcı

```javascript
// ES Modules
import { slugId, shortId } from 'nope-id'

// Kısa URL'ler
const shortUrl = `https://short.ly/${slugId(8)}`
// "https://short.ly/a8b3c9d2"

// Kullanıcı dostu kodlar
const shareCode = shortId(6)  // "Kp3Wn8" (karıştırılabilir karakter yok)

// CommonJS
const { slugId, shortId } = require('nope-id')
```

### Dağıtık Sistemler

```javascript
// ES Modules
import { distributedId, orderedId, getFingerprint } from 'nope-id'

// Çok-node güvenli ID'ler
const eventId = distributedId()
// "aB3x_V1StGXR8_Z5jdHi6B"

// Node tanımlama ile log
console.log(`[${getFingerprint()}] Event işleniyor ${eventId}`)

// Kesin monotonik, sortable ID'lerle zaman-serisi verisi
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

// Kritik olmayan UI key'leri için daha iyi performans için non-secure versiyonu kullanın
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
  // User kaydet...
  res.json(user)
})

app.post('/orders', (req, res) => {
  const order = {
    id: orderedId(),  // Oluşturma zamanına göre sıralanabilir, kesin monotonik
    ...req.body
  }
  // Order kaydet...
  res.json(order)
})

// UUID bekleyen sistemler için
app.post('/legacy-api', (req, res) => {
  const record = {
    id: uuid(),
    ...req.body
  }
  res.json(record)
})
```

---

## nanoid ile Karşılaştırma

| Özellik | nope-id | nanoid |
|---------|---------|--------|
| Güvenli random | ✅ | ✅ |
| URL-safe | ✅ | ✅ |
| TypeScript | ✅ | ✅ |
| ESM + CommonJS | ✅ | ⚠️ Sadece ESM (v4'te CJS bırakıldı) |
| Prefix'li ID'ler | ✅ | ❌ |
| Sortable ID'ler (ULID-benzeri) | ✅ | ❌ |
| Monotonik garanti | ✅ | ❌ |
| Timestamp çözme | ✅ | ❌ |
| Dağıtık ID'ler | ✅ | ❌ |
| Process fingerprint | ✅ | ❌ |
| UUID v4 | ✅ | ❌ |
| UUID v7 (zaman-sıralı) | ✅ | ❌ |
| ULID (spec-uyumlu) | ✅ | ❌ |
| Monotonik ULID factory | ✅ | ❌ |
| Snowflake ID'ler | ✅ | ❌ |
| MongoDB ObjectId | ✅ | ❌ |
| Sqids (geri çevrilebilir kodlama) | ✅ | ❌ |
| Typed ID'ler (TS template tipleri) | ✅ | ❌ |
| Format doğrulayıcılar (UUID/ULID) | ✅ | ❌ |
| Slug ID'ler | ✅ | ❌ |
| Kısa ID'ler (karışık yok) | ✅ | ❌ |
| Toplu üretim | ✅ | ❌ |
| Doğrulama | ✅ | ❌ |
| Çakışma hesaplayıcı | ✅ | ❌ |
| Hazır alfabeler | ✅ (14) | Sınırlı |

---

## Tarayıcı Desteği

Web Crypto API desteği olan tüm modern tarayıcılarda çalışır.

```html
<script type="module">
  import { nopeid, prefixedId } from 'https://unpkg.com/nope-id/index.browser.js'

  console.log(nopeid())        // "V1StGXR8_Z5jdHi6B-myT"
  console.log(prefixedId('user')) // "user_V1StGXR8_..."
</script>
```

---

## Güvenlik

nope-id güvenliği öncelikli olarak tasarlanmıştır. Temel kriptografik randomness'ın ötesinde birden çok güvenlik sertleştirme önlemi uygulanmıştır.

### Kriptografik Güvenlik

- **Node.js**: `webcrypto.getRandomValues()` (CSPRNG)
- **Tarayıcı**: `crypto.getRandomValues()` (CSPRNG)

### Güvenlik Sertleştirme

| Güvenlik Özelliği | Açıklama |
|-----------------|-------------|
| **Azaltılmış Zamanlama Sızıntısı** | `isValid()` ilk-hatalı-karakter erken dönüşünden kaçınır; en bariz pozisyon-oracle saldırılarını azaltır. (Gerçek sabit-zaman değildir — V8 Set.has zamanlaması homojen garanti edilmez.) |
| **Modulo Bias Eliminasyonu** | Tüm alfabe boyutları için (sadece 2'nin kuvvetleri değil) mükemmel uniform dağılımı sağlamak için rejection sampling kullanır |
| **Prototype Pollution Koruması** | `alphabets` objesi null prototype ile donmuştur, prototype pollution saldırılarına karşı bağışıklıdır |
| **Integer Overflow Koruması** | `collisionProbability()` astronomik büyüklükteki sayılarla doğru hesaplama için BigInt kullanır |
| **DoS Önleme** | `sortableId()` donmuş sistem saatlerinden sonsuz döngüleri önlemek için iterasyon sınırlarına sahiptir |
| **Buffer Güvenliği** | Pool yönetimi `>65536` byte isteklerini chunked dolumla güvenli şekilde işler |

### En İyi Uygulamalar

- Token'lar, session ID'leri, API anahtarları için güvenli versiyonu (varsayılan) kullanın
- Çakışma direnci ile zaman-bazlı sıralama için `sortableId()` kullanın
- Çok-node dağıtımlarda `distributedId()` kullanın
- `nope-id/non-secure`'u sadece güvenlik-kritik olmayan amaçlar için kullanın

---

## Test Etme

nope-id, güvenlik-spesifik testler dahil **342 test** ile 8 test suite'inde kapsamlı test kapsamına sahiptir.

### Testleri Çalıştırma

```bash
# Tüm testleri çalıştır
npm test

# Belirli test suite'leri çalıştır
npm run test:core        # Çekirdek fonksiyonlar (nopeid, customAlphabet, random)
npm run test:features    # Özellikler (prefixedId, sortableId, uuid, vb.)
npm run test:utils       # Yardımcılar (isValid, collisionProbability)
npm run test:non-secure  # Non-secure versiyon testleri
npm run test:idtypes     # Yeni ID tipleri (uuidv7, ulid, snowflake, objectId)
npm run test:encoding    # Sqids, typed ID'ler, format doğrulayıcılar
```

### Test Kapsamı

| Test Suite | Test | Açıklama |
|------------|-------|-------------|
| **Core** | 81 | nopeid, customAlphabet, customRandom, random, alphabets |
| **Features** | 78 | prefixedId, sortableId, uuid, slugId, shortId, distributedId |
| **Utils** | 56 | isValid, collisionProbability, güvenlik testleri |
| **Non-Secure** | 29 | Math.random() bazlı versiyon |
| **ID Types** | 31 | uuidv7, ulid, monotonicFactory, snowflake, objectId |
| **Encoding** | 32 | sqids, defineId, isValidUUID, isValidULID |
| **Toplam** | **307** | Hepsi geçiyor |

### Güvenlik Testleri

Sertleştirme önlemlerimizi doğrulayan özel güvenlik testlerimiz var:

```
📦 isValid() Güvenliği
  ✅ null byte içeren string'leri reddediyor
  ✅ unicode sıfır-genişlik karakterleri içeren string'leri reddediyor
  ✅ erken-dönüşsüz doğrulama (zamanlama sızıntısını azaltır)

📦 Prototype Pollution Önleme
  ✅ alphabets objesi donmuş
  ✅ alphabets null prototype'a sahip
  ✅ alphabets değiştirilemez
  ✅ alphabets Object.prototype özelliklerini miras almıyor

📦 Modulo Bias Önleme (customAlphabet)
  ✅ 2'nin kuvveti olmayan alfabe için uniform dağılım
  ✅ 3-karakter alfabe için uniform dağılım

📦 Integer Overflow Önleme
  ✅ büyük değerler için collisionProbability BigInt döndürüyor
  ✅ MAX_SAFE_INTEGER'ı aşan değerler için BigInt doğru
  ✅ totalPossible MAX_SAFE_INTEGER'a sınırlandırılmış

📦 Güvenlik: Entropy Kalitesi
  ✅ random byte'lar iyi entropy dağılımına sahip
  ✅ üretilen ID'ler iyi karakter dağılımına sahip
  ✅ sıralı ID'lerde öngörülebilir desen yok
  ✅ randomness için chi-square testi
```

### Stres Testleri

```
📦 Stres Testleri
  ✅ hızlı sıralı üretim (10000 ID) - hepsi benzersiz
  ✅ pool tükenme ve yeniden doldurma döngüsü
  ✅ sıralamada değişen boyutlar
  ✅ farklı üreteçler arasında geçiş
```

### Randomness Karşılaştırma Testi (vs nanoid)

nanoid'e karşı özel bir randomness karşılaştırma testimiz var:

```bash
npm run test:randomness
```

| Test | nope-id | nanoid |
|------|---------|--------|
| Chi-Kare Dağılımı | ✅ χ²=44.69 | ✅ χ²=48.96 |
| Benzersizlik (100K ID) | ✅ 0 duplicate | ✅ 0 duplicate |
| Bit Dağılımı | ✅ 50.03/49.97% | ✅ 49.95/50.05% |
| Sıralı Korelasyon | ✅ 0.316 ort | ✅ 0.329 ort |
| Alfabe Kapsamı | ✅ 64/64 (%100) | ✅ 64/64 (%100) |
| Modulo Bias (3-karakter) | ✅ %1.05 sapma | ✅ %1.15 sapma |

---

## Performans

> **Bu sayılar hakkında.** Bu tablolar `main`'e açılan her PR'da paylaşılan bir `ubuntu-latest` runner'ında çalışan bir
> [GitHub Actions workflow'u](.github/workflows/benchmark-on-pr.yml) tarafından otomatik yenilenir. CI runner'ları
> tipik olarak modern geliştirici makinelerinden ve production sunucularından daha yavaştır, dolayısıyla gerçek donanımda
> nope-id genellikle burada gördüğünüzden **daha yüksek** rakamlara ulaşır.
> Kendi makinenizde sayıları görmek için `npm run benchmark` çalıştırın.

<!-- bench:meta:start -->
_Son güncelleme: 2026-05-28, Node v26.x, ubuntu-latest (GitHub Actions)._
<!-- bench:meta:end -->

### nope-id vs nanoid Benchmark

**nope-id, nanoid 5.1.11'e karşı 5 temel benchmark'ın hepsini kazanıyor**, ve üzerine birçok ekstra ID formatı ve güvenlik sertleştirmesi sunuyor.

Benchmark'ı kendiniz çalıştırın:

```bash
npm run benchmark
```

**Sonuçlar (Node.js 20+, nanoid 5.1.11, auto-kalibrasyonlu ~120 ms × en iyi 7 deneme, fairness için global warmup; absolute sayılar makineye göre değişir):**

<!-- bench:comparison-table:start -->
| Test | nanoid 5.1.11 | nope-id | Kazanan |
|------|--------|---------|--------|
| Temel (21 karakter) | ~5.5M op/sn | **~39.5M op/sn** | **nope-id ~7.2x** |
| Küçük (10 karakter) | ~9.9M op/sn | **~44.2M op/sn** | **nope-id ~4.5x** |
| Büyük (64 karakter) | ~2.0M op/sn | **~18.8M op/sn** | **nope-id ~9.3x** |
| Özel Alfabe | ~5.7M op/sn | **~12.4M op/sn** | **nope-id ~2.2x** |
| Toplu (100 ID) | ~56K op/sn | **~435K op/sn** | **nope-id ~7.8x** |
<!-- bench:comparison-table:end -->

**Sonuç: nope-id, URL-safe ID'lerde nanoid'e karşı 5/5 kazanıyor**, ve üzerine birçok ekstra özellik ve güvenlik sertleştirmesi sunuyor.

### Hız nereden geliyor (ve nereden gelmiyor)

nope-id, çok yaygın belirli bir iş için en hızlı **JavaScript** kütüphanesidir: **tam 64-karakter alfabe üzerinde kriptografik olarak güvenli, URL-safe bir id** (nanoid'in kategorisi). Bu kategoride her standart boyutta nanoid'i geniş bir farkla geçer (kesin oranlar için yukarıdaki karşılaştırma tablosuna bakın), ve ayrıca özel paketlerden **çok daha hızlı** UUIDv7 ve ULID üretir (aşağıdaki UUID ve ULID tablolarına bakın).

Hız mühendislikten gelir, randomness'tan ödün vermekten değil:

- **Cache'lenmiş pool string'i:** CSPRNG byte pool'u refill'de yerinde alfabe karakter kodlarına çevrilir, sonra flat tek-byte string'e **bir kez** decode edilir (`idPool.toString('latin1')`) ve `idPoolStr` olarak cache'lenir. Her `nopeid()` çağrısı tek bir `idPoolStr.substring(start, end)` döndürür, ≥ 13 boyutlar için V8 SlicedString (O(1), zero-copy), altında küçük inline copy, böylece `Buffer.toString`'in çağrı başına ~50 ns sabit overhead'i ödenmiyor. Aynı trick `customAlphabet`, `uuid()` ve arkadaşlarına da güç veriyor.
- **16-bit batch refill:** Yerinde çeviri, herhangi iki random byte'ı doğrudan iki alfabe koduna eşleyen precomputed 64 KiB `Uint16Array` tablosu üzerinden pool'u 16-bit chunk'larla dolaşır, refill iterasyon sayısını yarıya indirir (endian-agnostic by construction).
- **Havuzlanmış CSPRNG:** Bir `crypto.getRandomValues()` dolumu, varsayılan boyutta ID başına bir syscall yerine binlerce ID'yi kapsar. `uuid()` daha ileri gider: 4096 v4 UUID'i (her slot için version + RFC 4122 variant bit'leri zaten yamanmış halde) tek bir 144 KiB string'e pre-format eder, böylece her çağrı sadece bir `substring(start, start+36)`.
- **Bitmask, modulo yok:** 64-karakter alfabe üzerinde alfabe indeksi `byte & 63`'ten gelir, hot path'te rejection sampling veya modulo bias yok.
- **Diğer her şey için precomputed tablolar:** `uuid()`/`uuidv7()`/`objectId()` için byte-to-hex, `ulid()`/`monotonicFactory()` için Crockford char kodları, artı per-call path'inin asla allocate etmemesi için yeniden kullanılan modül-seviye scratch buffer'ları (`UUID_BUF`, `SORT_BUF`, `ULID_BUF`).
- **Allocation'sız `customAlphabet`:** Paylaşılan byte havuzunu doğrudan okur, rejection-sampled byte'ları hot path'i yine `substring(start, end)` olan pre-decoded char-code pool'una eşler; bu aynı zamanda `slugId()` ve `shortId()`'i hızlandırır.

nope-id'nin yenmeye çalış**madığı** şeyler:

- **Küçük-alfabe üreteçleri** `uid` gibi (16-karakter hex). 21-karakter `uid` ~84 bittir; nope-id'in 21 karakteri ~126 bittir, dolayısıyla eşit entropi için nope-id zaten ileridedir, ama kısa hex ID'ler için `uid` hâlâ iyi bir seçim.

Yani nope-id'in amacı **karakter başına maksimum randomness'ı korurken** en hızlı olmak, tek bir zero-dependency, dual-module pakette.

### `uuid` paketi ve native `crypto.randomUUID()`'a karşı UUID üretimi

Bir benchmark yalnızca birden fazla araca karşı anlamlıdır (nanoid yazarına [#4](https://github.com/orhanayd/nope-id/issues/4)'teki dürtüsü için teşekkürler). UUID'ler için dürüst resim:

<!-- bench:uuid-table:start -->
| Üretici | op/sn | |
|---|---|---|
| `crypto.randomUUID()` (Node native, v4) | ~21.2M | C++ binding (yalnız düz v4) |
| nope-id `uuid()` (v4) | **~25M** | 🥇 en hızlı saf-JS v4 |
| `@lukeed/uuid` `v4()` | ~6.9M | optimize saf-JS v4 |
| `uuid` package `v4()` | ~5.9M | |
| nope-id `uuidv7()` | ~5.3M | **`uuid` paketinin v7'sinin ~12x'i** |
| `uuid` package `v7()` | ~432K | |
<!-- bench:uuid-table:end -->

**Dürüst yaklaşım:** nope-id'in `uuid()`'i her CSPRNG yenilemesinde 4096 v4 UUID'i önceden formatlıyor, böylece her çağrı sadece bir `substring()`. Sonuç: native `crypto.randomUUID()` ile en az aynı seviyede, güncel CI'da ise önde. İkisi gerçek donanımda yer değiştirebiliyor (CSPRNG entropy yolu paylaşılıyor, runner gürültüsü de cabası), dolayısıyla pratikte hız olarak eşit kabul edin. Eğer tek ihtiyacınız düz bir v4 UUID ise ve bağımlılık istemiyorsanız stdlib işinizi görür. Ama nope-id'i zaten başka bir şey için kullanıyorsanız (UUIDv7, ULID, Snowflake, ObjectId, Sqids, typed ID'ler, nanoid tarzı kısa ID'ler ya da sadece nanoid'den hızlı URL-safe ID'ler), native'e başvurmaya gerek yok; `uuid()` en az onun kadar hızlı, dual-module ve zero-dependency.

### `ulid` paketine karşı ULID (sortable)

ULID'ler UUID'lere çekici bir alternatiftir: **lexicographic olarak sıralanabilir**, kompakt **26 karakter** (UUID'in 36'sına karşı), Crockford base32 (URL-safe, case-insensitive), 128-bit ve UUID-uyumlu, aynı milisaniyeyi doğru işleyen monotonik bir seçenekle. Rastgele UUID v4'ün aksine, zaman prefix'leri veritabanı indekslerinin parçalanmasını önler.

nope-id spec-uyumlu bir `ulid()` plus izole bir `monotonicFactory()` sunar. `ulid` paketi ile aynı 26-karakter formatı, ikisi de crypto-backed:

<!-- bench:ulid-table:start -->
| Üretici | op/sn |
|---|---|
| nope-id `ulid()` | **~2.8M** |
| `ulid` package | ~30K |
| nope-id `monotonicFactory()` | **~8.5M** |
| `ulid` package (monotonic) | ~2.2M |
<!-- bench:ulid-table:end -->

nope-id, düz `ulid()` için çok daha hızlıdır çünkü havuzlanmış bir buffer'dan randomness çeker (her 16 ID için bir doldurma), oysa `ulid` paketi karakter başına randomness alır. Her ikisinden de timestamp'i `decodeTime()` ile çözün. (`ulid` paketi de zero-dependency'dir.)

### Sortable head-to-head: `sparkid` vs nope-id `sortableId()`

İkisi de CSPRNG-tabanlı, zaman-sıralı + monotonik üreteç ve mimari olarak benzer (önceden çevrilmiş random-byte havuzu, lookup tablosu, cached prefix string). Varsayılan ayarları farklı: sparkid 21-karakter Base58, nope-id `sortableId()` 22-karakter Crockford Base32 (22 güçlü monotonik garantiyi sağlam tutacak güvenli minimum). Yani bu strict format-aynı değil, doğal varsayılan ayarlar karşılaştırması.

<!-- bench:sortable-table:start -->
| Üretici | op/sn |
|---|---|
| nope-id `sortableId()` (22-char Crockford) | ~6.4M |
| `sparkid` (21-char Base58) | **~9.8M** |
<!-- bench:sortable-table:end -->

### Hız vs entropi: her kütüphane nerede duruyor

Bir id üreteci için iki şey önemlidir: **hız** ve **entropi**, her id'nin taşıdığı gerçek randomness miktarı (tahmin edilmeye karşı güvenliği). Hepsi iyi kütüphanelerdir; tablo her birinin uzunluğun yapılandırılabilir olduğu 21 karakterde ölçülen trade-off'unu gösterir:

<!-- bench:speed-vs-entropy-table:start -->
| Üretici | op/sn | entropi / id | rastgelelik kaynağı |
|---|---|---|---|
| **nope-id `nopeid()`** | **~39.5M** | **~126 bit (64-karakter URL-safe)** | **CSPRNG** |
| `uid/secure` | ~6.3M | ~84 bit (16-karakter hex) | CSPRNG |
| nanoid | ~5.5M | ~126 bit (64-karakter URL-safe) | CSPRNG |
| `sparkid` | ~9.8M | ~76 bit rastgele (Base58, zaman-sıralı) | CSPRNG |
| `rndm` | ~2.8M | ~125 bit, ama öngörülebilir | `Math.random` (güvenli değil) |
| `secure-random-string` | ~394K | ~126 bit (base64, URL-safe değil) | CSPRNG |
| cuid2 `createId()` | ~5.5K | 24-karakter, hash-türevli | CSPRNG + SHA-3 |
<!-- bench:speed-vs-entropy-table:end -->

İki eksen olarak okuyun, **hız** ve **güvenlik**, diğer her kütüphane bunlardan birinde bir şey verir:

- **`uid/secure`** hızlıdır, ama daha küçük bir alfabe ile ödüllendirir: nope-id'in ~126'sına karşı 21-karakter id başına ~84 bit. Eşit güvenlik için `uid`'i uzatmanız gerekir, o noktada nope-id zaten bit başına önde.
- **`rndm`** da hızlıdır, ama `Math.random` üzerine kuruludur, dolayısıyla bit'leri öngörülebilir; kendi README'si onu "kriptografik olarak güvenli değil" olarak adlandırır.
- **`secure-random-string`** nope-id'in entropi'sine eşittir ama kabaca 80x daha yavaştır ve base64 (URL-safe değil) yayar.
- **cuid2** sertleştirilmiş, sharding-güvenli, hash-bazlı bir model için bilerek hız harcar.
- **`sparkid`** CSPRNG-tabanlı, zaman-sıralı, monotonik ve kendi alanında oldukça hızlı; 21 karakterin 8'ini Base58 zaman önekine harcıyor ve id başına ~76 bit tahmin edilemez rastgelelik bırakıyor (ULID seviyesi). **Id başına maksimum rastgelelik** istiyorsanız nope-id'in `nopeid()`'i aynı uzunlukta tam 126 biti korur. Özellikle **sortable + monotonik** istiyorsanız sparkid kendi alanında güçlü (yukarıdaki head-to-head'e bakın); ULID uyumlu 26-karakter Crockford çıktı için nope-id `sortableId()`, `ulid()` ve `monotonicFactory()` sunar.
- **nanoid** nope-id'in entropi'sine tam olarak eşittir (aynı 64-karakter alfabe); nope-id sadece varsayılan 21-karakter boyutta <!-- bench:basic-21-ratio:start -->~7.2x<!-- bench:basic-21-ratio:end --> daha hızlıdır.

nope-id **üçünü birden** sağlayan tek satırdır: karakter başına maksimum entropi (126 bit), gerçek bir CSPRNG ve en üst düzey hız. Tüm tasarım amacı budur, randomness'tan asla harcamadan hızlı olmak. (Düz v4 UUID için, native `crypto.randomUUID()` C++'da 122 bit'te nope-id'in `uuid()`'i ile aşağı yukarı eşit; tek ihtiyacınız bir v4 UUID ise ve bağımlılık istemiyorsanız stdlib yeter.)

### Ekstra Özellikler Performansı

Bu özellikler nope-id'e özeldir (nanoid'de yoktur):

<!-- bench:extras-table:start -->
| Özellik | Performans |
|---------|-------------|
| `sortableId()` | ~6.4M op/sn |
| `prefixedId()` | ~28.4M op/sn |
| `uuid()` | ~24.9M op/sn |
| `slugId()` | ~5.6M op/sn |
| `shortId()` | ~11.3M op/sn |
| `isValid()` | ~6.7M op/sn |
| `uuidv7()` | ~5.3M op/sn |
| `ulid()` | ~2.8M op/sn |
| `monotonicFactory()` | ~8.5M op/sn |
| `snowflake` (factory) | ~4.1M op/sn |
| `objectId()` | ~7.2M op/sn |
| `sqids.encode()` | ~210K op/sn |
<!-- bench:extras-table:end -->

---

## Sorumluluk Reddi

nope-id kriptografik olarak güvenli random number generator'lar (`crypto.getRandomValues`) kullansa ve güvenlik best practice'lerini uygulasa da, **hiçbir yazılım %100 randomness veya mutlak güvenlik garanti edemez**. Randomness kalitesi nihai olarak işletim sisteminin entropy kaynağına bağlıdır.

Aşırı yüksek güvenlik uygulamaları için (örn. kriptografik anahtarlar, uzun-vadeli sırlar), resmi güvenlik denetimleri geçmiş özel kriptografik kütüphaneleri değerlendirin.

nope-id "olduğu gibi" hiçbir garanti olmaksızın sağlanmıştır. Spesifik güvenlik gereksinimlerinizi karşılayıp karşılamadığını her zaman değerlendirin.

---

## Lisans

MIT
