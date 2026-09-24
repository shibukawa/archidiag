// Chrome built-in AI Translator (on-device). Used for name suggestions when the browser has it; hidden otherwise.
interface TranslatorInstance { translate: (text: string) => Promise<string> }
interface TranslatorApi {
  availability: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<string>
  create: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<TranslatorInstance>
}

function api(): TranslatorApi | undefined {
  const candidate = (globalThis as { Translator?: TranslatorApi }).Translator
  return candidate && typeof candidate.create === 'function' ? candidate : undefined
}

export function translatorPresent(): boolean {
  return Boolean(api())
}

/** Translates each text from Japanese to English; texts that fail are left out. */
export async function translateToEnglish(texts: string[]): Promise<Map<string, string>> {
  const translator = api()
  const out = new Map<string, string>()
  if (!translator || !texts.length) return out
  const options = { sourceLanguage: 'ja', targetLanguage: 'en' }
  try {
    if ((await translator.availability(options)) === 'unavailable') return out
    const instance = await translator.create(options)
    for (const text of texts) {
      try { out.set(text, await instance.translate(text)) } catch { /* keep the others */ }
    }
  } catch {
    return out
  }
  return out
}
