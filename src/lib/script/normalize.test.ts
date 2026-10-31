import {
  canonicalize,
  canonicalizePersian,
  canonicalizeSorani,
  foldForMatch,
  foldLatin,
  isArabicScript,
  ZWNJ,
} from './normalize'

const codepoints = (s: string) => [...s].map((c) => c.codePointAt(0)!.toString(16).padStart(4, '0'))

describe('canonicalizeSorani', () => {
  it('replaces Arabic yeh, kaf and teh marbuta with the Kurdish letters', () => {
    expect(canonicalizeSorani('كچي')).toBe('کچی')
    expect(canonicalizeSorani('تكایة')).toBe('تکایە')
    expect(canonicalizeSorani('ماڵى')).toBe('ماڵی')
  })

  it('turns heh + ZWNJ (the legacy way of writing the vowel e) into ە', () => {
    expect(canonicalizeSorani(`باش${'ه'}${ZWNJ}`)).toBe('باشە')
    expect(canonicalizeSorani(`ئ${'ه'}${ZWNJ}و`)).toBe('ئەو')
    expect(codepoints(canonicalizeSorani(`تكای${'ه'}${ZWNJ}`))).toEqual(codepoints('تکایە'))
  })

  it('maps heh doachashmee and heh with yeh above', () => {
    expect(canonicalizeSorani('ھەبوون')).toBe('هەبوون')
    expect(canonicalizeSorani('ۀ')).toBe('ە')
  })

  it('writes word-initial r as ڕ', () => {
    expect(canonicalizeSorani('رۆژ')).toBe('ڕۆژ')
    expect(canonicalizeSorani('ئەمڕۆ رۆژی باشە')).toBe('ئەمڕۆ ڕۆژی باشە')
    expect(canonicalizeSorani('«رووناک»')).toBe('«ڕووناک»')
    expect(canonicalizeSorani('(ریز)')).toBe('(ڕیز)')
  })

  it('leaves non-initial ر alone', () => {
    expect(canonicalizeSorani('شار')).toBe('شار')
    expect(canonicalizeSorani('برا')).toBe('برا')
    expect(canonicalizeSorani('گەورەتر')).toBe('گەورەتر')
  })

  it('recomposes ێ ۆ ڵ ڕ typed as base letter + combining mark', () => {
    expect(codepoints(canonicalizeSorani('ی\u065A'))).toEqual(['06ce'])
    expect(codepoints(canonicalizeSorani('ي\u065A'))).toEqual(['06ce'])
    expect(codepoints(canonicalizeSorani('و\u065A'))).toEqual(['06c6'])
    expect(codepoints(canonicalizeSorani('ل\u065A'))).toEqual(['06b5'])
    expect(codepoints(canonicalizeSorani('ر\u065A'))).toEqual(['0695'])
    expect(codepoints(canonicalizeSorani('ر\u0655'))).toEqual(['0695'])
    expect(canonicalizeSorani('سل\u065Aاو')).toBe('سڵاو')
    expect(canonicalizeSorani('ک\u06CC\u065A')).toBe('کێ')
    expect(canonicalizeSorani('ت\u0648\u065A')).toBe('تۆ')
    expect(canonicalizeSorani('هاور\u065A\u06CC\u065A')).toBe('هاوڕێ')
  })

  it('only turns word-final ه into ە in legacy mode', () => {
    expect(canonicalizeSorani('باشه')).toBe('باشه')
    expect(canonicalizeSorani('باشه', { legacy: true })).toBe('باشە')
    expect(canonicalizeSorani('ئەمه باشه.', { legacy: true })).toBe('ئەمە باشە.')
    expect(canonicalizeSorani('چۆنه؟', { legacy: true })).toBe('چۆنە؟')
    // Medial ه is a consonant even in legacy text.
    expect(canonicalizeSorani('تەنها', { legacy: true })).toBe('تەنها')
    expect(canonicalizeSorani('شاره‌کان'.replace(ZWNJ, ''), { legacy: true })).toBe('شارهکان')
  })

  it('keeps word-final /h/ in real words like گوناه by default', () => {
    expect(canonicalizeSorani('گوناه')).toBe('گوناه')
    expect(canonicalizeSorani('شاه')).toBe('شاه')
    expect(canonicalizeSorani('ئەم گوناهە')).toBe('ئەم گوناهە')
  })

  it('strips tatweel, harakat, bidi controls and zero-width joiners', () => {
    expect(canonicalizeSorani('سـڵـاو')).toBe('سڵاو')
    expect(canonicalizeSorani('\u200Fمن\u200E')).toBe('من')
    expect(canonicalizeSorani('مَن')).toBe('من')
    expect(canonicalizeSorani('م\u200Dن')).toBe('من')
    expect(canonicalizeSorani('\uFEFFسوپاس')).toBe('سوپاس')
  })

  it('collapses whitespace and writes Persian digits', () => {
    expect(canonicalizeSorani('  زۆر   سوپاس \u00A0')).toBe('زۆر سوپاس')
    expect(canonicalizeSorani('ساڵی 2024')).toBe('ساڵی ۲۰۲۴')
    expect(canonicalizeSorani('٣ کوڕ')).toBe('۳ کوڕ')
  })

  it('is idempotent on canonical content', () => {
    for (const w of ['سڵاو', 'خوات لەگەڵ', 'بەیانیت باش', 'خۆشحاڵم بە ناسینت', 'هاوڕێ', 'ئێوە', 'ڕۆژ']) {
      expect(canonicalizeSorani(w)).toBe(w)
      expect(canonicalizeSorani(canonicalizeSorani(`  ${w} `))).toBe(w)
    }
  })
})

describe('canonicalizePersian', () => {
  it('replaces Arabic yeh and kaf with the Persian letters', () => {
    expect(canonicalizePersian('كتاب')).toBe('کتاب')
    expect(canonicalizePersian('خيلي')).toBe('خیلی')
    expect(canonicalizePersian('مرسى')).toBe('مرسی')
    expect(canonicalizePersian('يك')).toBe('یک')
  })

  it('keeps tanwin on alef (لطفاً) but drops other harakat', () => {
    expect(canonicalizePersian('لطفاً')).toBe('لطفاً')
    expect(codepoints(canonicalizePersian('لطفاً'))).toEqual(['0644', '0637', '0641', '0627', '064b'])
    // Tanwin typed before the alef is moved after it.
    expect(canonicalizePersian('لطف\u064Bا')).toBe('لطفاً')
    expect(canonicalizePersian('حتماً')).toBe('حتماً')
    expect(canonicalizePersian('دَرس')).toBe('درس')
    expect(canonicalizePersian('مُتِشَکِّرَم')).toBe('متشکرم')
  })

  it('keeps ZWNJ, joins spaces around it and drops repeated ZWNJ', () => {
    expect(canonicalizePersian('می‌خواهم')).toBe(`می${ZWNJ}خواهم`)
    expect(canonicalizePersian(`می ${ZWNJ} خواهم`)).toBe(`می${ZWNJ}خواهم`)
    expect(canonicalizePersian(`آن${ZWNJ}${ZWNJ}ها`)).toBe(`آن${ZWNJ}ها`)
    // A plain space is not turned into a ZWNJ: that would be a guess.
    expect(canonicalizePersian('می خواهم')).toBe('می خواهم')
  })

  it('removes Kurdish letters that have a Persian equivalent', () => {
    expect(canonicalizePersian('خانە')).toBe('خانه')
    expect(canonicalizePersian('ھست')).toBe('هست')
  })

  it('composes heh + hamza above to ۀ', () => {
    expect(codepoints(canonicalizePersian('خانه\u0654'))).toEqual(['062e', '0627', '0646', '06c0'])
  })

  it('writes Persian digits for ASCII and Arabic-Indic digits', () => {
    expect(canonicalizePersian('12 ٤٥ ۶')).toBe('۱۲ ۴۵ ۶')
  })

  it('is idempotent on canonical content', () => {
    for (const w of ['خداحافظ', 'خواهش می‌کنم', 'آن‌ها', 'لطفاً', 'متأهل', 'سوئدی', 'حال شما چطور است؟']) {
      expect(canonicalizePersian(w)).toBe(w)
    }
  })
})

describe('canonicalize', () => {
  it('dispatches by language', () => {
    expect(canonicalize('خانە', 'fa')).toBe('خانه')
    expect(canonicalize('رۆژ', 'ckb')).toBe('ڕۆژ')
  })
})

describe('foldForMatch', () => {
  it('ignores punctuation, spaces and ZWNJ', () => {
    expect(foldForMatch('چۆنی؟', 'ckb')).toBe(foldForMatch('چۆنی', 'ckb'))
    expect(foldForMatch('خوات لەگەڵ', 'ckb')).toBe(foldForMatch('خواتلەگەڵ', 'ckb'))
    expect(foldForMatch('می‌خواهم', 'fa')).toBe(foldForMatch('میخواهم', 'fa'))
    expect(foldForMatch('می خواهم', 'fa')).toBe(foldForMatch('میخواهم', 'fa'))
    expect(foldForMatch('«سلام»!', 'fa')).toBe('سلام')
  })

  it('folds hamza/alef variants', () => {
    expect(foldForMatch('متأهل', 'fa')).toBe(foldForMatch('متاهل', 'fa'))
    expect(foldForMatch('سوئدی', 'fa')).toBe(foldForMatch('سویدی', 'fa'))
    expect(foldForMatch('خانهٔ', 'fa')).toBe(foldForMatch('خانه', 'fa'))
    expect(foldForMatch('لطفاً', 'fa')).toBe(foldForMatch('لطفا', 'fa'))
  })

  it('treats ه and ە alike in Sorani only', () => {
    expect(foldForMatch('باشە', 'ckb')).toBe(foldForMatch('باشه', 'ckb'))
    expect(foldForMatch('ئەوە', 'ckb')).toBe(foldForMatch('ئهوه', 'ckb'))
  })

  it('keeps letters that distinguish words', () => {
    expect(foldForMatch('سڵاو', 'ckb')).not.toBe(foldForMatch('سلاو', 'ckb'))
    expect(foldForMatch('کوڕ', 'ckb')).not.toBe(foldForMatch('کور', 'ckb'))
    expect(foldForMatch('کێ', 'ckb')).not.toBe(foldForMatch('کی', 'ckb'))
    expect(foldForMatch('سلام', 'fa')).not.toBe(foldForMatch('کلام', 'fa'))
  })

  it('folds digits to ASCII', () => {
    expect(foldForMatch('۱۲۳', 'fa')).toBe('123')
    expect(foldForMatch('٣', 'ckb')).toBe('3')
  })
})

describe('foldLatin', () => {
  it('folds digraphs and Hawar letters to the same skeleton', () => {
    expect(foldLatin('shomâ')).toBe(foldLatin('şoma'))
    expect(foldLatin('shoma')).toBe(foldLatin('šomā'))
    expect(foldLatin('khâne')).toBe(foldLatin('xane'))
    expect(foldLatin('chetori')).toBe(foldLatin('çetori'))
    expect(foldLatin('zhâleh')).toBe(foldLatin('žaleh'))
    expect(foldLatin('ghazâ')).toBe(foldLatin('ğaza'))
    expect(foldLatin('kuř')).toBe(foldLatin('kurr'))
    expect(foldLatin('sław')).toBe(foldLatin('sllaw'))
  })

  it('ignores long-vowel marks, apostrophes, case, spaces and hyphens', () => {
    expect(foldLatin('salâm')).toBe(foldLatin('salam'))
    expect(foldLatin('salaam')).toBe(foldLatin('salam'))
    expect(foldLatin("su'edi")).toBe(foldLatin('suedi'))
    expect(foldLatin('su’edi')).toBe(foldLatin('suedi'))
    expect(foldLatin('mote\u02BCahhel')).toBe(foldLatin("mote'ahhel"))
    expect(foldLatin('Swîd')).toBe(foldLatin('swid'))
    expect(foldLatin('hâl-e shomâ')).toBe(foldLatin('hale shoma'))
    expect(foldLatin('başim')).toBe('baSim')
  })

  it('keeps distinct consonants apart', () => {
    expect(foldLatin('salâm')).not.toBe(foldLatin('kalâm'))
    expect(foldLatin('kiç')).not.toBe(foldLatin('kis'))
  })
})

describe('isArabicScript', () => {
  it('detects Arabic-script letters, including Kurdish and presentation forms', () => {
    expect(isArabicScript('سڵاو')).toBe(true)
    expect(isArabicScript('ێ')).toBe(true)
    expect(isArabicScript('hello سلام')).toBe(true)
    expect(isArabicScript('\uFEFB')).toBe(true)
    expect(isArabicScript('۱۲۳')).toBe(true)
  })

  it('rejects Latin text', () => {
    expect(isArabicScript('salâm')).toBe(false)
    expect(isArabicScript('xoşḧałim')).toBe(false)
    expect(isArabicScript('')).toBe(false)
    expect(isArabicScript('123')).toBe(false)
  })
})
