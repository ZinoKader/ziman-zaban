import { z } from 'zod'
import { LEVELS, PARTS_OF_SPEECH } from './types'

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'ids are kebab-case ascii')
const nonEmpty = z.string().trim().min(1)

export const localizedSchema = z.object({ en: nonEmpty, sv: nonEmpty }).strict()

export const glossSchema = localizedSchema
  .extend({
    enAlt: z.array(nonEmpty).optional(),
    svAlt: z.array(nonEmpty).optional(),
  })
  .strict()

export const formSchema = z
  .object({
    script: nonEmpty,
    latin: nonEmpty,
    ipa: z.string().optional(),
    register: z.enum(['neutral', 'formal', 'colloquial']).optional(),
    dialect: z.string().optional(),
    note: localizedSchema.optional(),
  })
  .strict()

export const sourceClaimSchema = z
  .object({
    source: z.enum([
      'wiktionary',
      'tatoeba',
      'thackston-sorani-grammar',
      'kim-kurdish-grammar',
      'asosoft',
      'native-speaker',
      'author',
    ]),
    ref: z.string().optional(),
  })
  .strict()

const sources = z.array(sourceClaimSchema).min(1, 'every entry must say where it was checked')

export const languageEntrySchema = z
  .object({
    primary: formSchema,
    variants: z.array(formSchema).optional(),
    plural: formSchema.optional(),
    presentStem: formSchema.optional(),
    pastStem: formSchema.optional(),
    notes: localizedSchema.optional(),
    audio: z
      .array(z.object({ url: z.string().url(), credit: nonEmpty, license: nonEmpty }).strict())
      .optional(),
    sources,
  })
  .strict()

export const conceptSchema = z
  .object({
    id,
    unit: id,
    pos: z.enum(PARTS_OF_SPEECH),
    level: z.enum(LEVELS),
    gloss: glossSchema,
    senseNote: localizedSchema.optional(),
    emoji: z.string().optional(),
    ckb: languageEntrySchema.optional(),
    fa: languageEntrySchema.optional(),
    cognate: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict()
  .refine((c) => c.ckb || c.fa, 'a concept needs at least one target language')

export const tokenSchema = z
  .object({
    text: nonEmpty,
    latin: nonEmpty,
    gloss: localizedSchema,
    concept: id.optional(),
    morph: z.string().optional(),
  })
  .strict()

const textLatin = z.object({ text: nonEmpty, latin: nonEmpty }).strict()

export const sentenceFormSchema = z
  .object({
    text: nonEmpty,
    latin: nonEmpty,
    tokens: z.array(tokenSchema).min(1),
    colloquial: textLatin.optional(),
    alternatives: z.array(textLatin).optional(),
    distractors: z.array(tokenSchema).optional(),
    grammar: z.array(id).optional(),
    sources,
  })
  .strict()

export const sentenceSchema = z
  .object({
    id,
    unit: id,
    level: z.enum(LEVELS),
    translation: glossSchema,
    ckb: sentenceFormSchema.optional(),
    fa: sentenceFormSchema.optional(),
  })
  .strict()
  .refine((s) => s.ckb || s.fa, 'a sentence needs at least one target language')

export const qaAnswerSchema = z
  .object({
    text: nonEmpty,
    latin: nonEmpty,
    translation: localizedSchema,
    tokens: z.array(tokenSchema).optional(),
  })
  .strict()

export const qaFormSchema = z
  .object({
    question: z
      .object({
        text: nonEmpty,
        latin: nonEmpty,
        tokens: z.array(tokenSchema).optional(),
        colloquial: textLatin.optional(),
        alternatives: z.array(textLatin).optional(),
      })
      .strict(),
    answers: z.array(qaAnswerSchema).min(1),
    slots: z
      .record(
        z.string(),
        z.array(z.object({ text: nonEmpty, latin: nonEmpty, translation: localizedSchema }).strict()).min(1),
      )
      .optional(),
    sources,
  })
  .strict()

export const qaItemSchema = z
  .object({
    id,
    unit: id,
    level: z.enum(LEVELS),
    question: localizedSchema,
    personal: z.boolean().optional(),
    ckb: qaFormSchema.optional(),
    fa: qaFormSchema.optional(),
  })
  .strict()
  .refine((q) => q.ckb || q.fa, 'a Q&A item needs at least one target language')

export const grammarPointSchema = z
  .object({
    id,
    unit: id,
    lang: z.enum(['ckb', 'fa']),
    level: z.enum(LEVELS),
    title: localizedSchema,
    explanation: localizedSchema,
    examples: z
      .array(
        z
          .object({
            text: nonEmpty,
            latin: nonEmpty,
            translation: localizedSchema,
            tokens: z.array(tokenSchema).optional(),
          })
          .strict(),
      )
      .min(1),
    sources,
  })
  .strict()

export const unitSchema = z
  .object({
    id,
    order: z.number().int(),
    title: localizedSchema,
    description: localizedSchema,
    canDo: localizedSchema,
    emoji: nonEmpty,
  })
  .strict()

/** Each content JSON file has one of these shapes, decided by its folder. */
export const lexiconFileSchema = z.object({ concepts: z.array(conceptSchema) }).strict()
export const sentenceFileSchema = z.object({ sentences: z.array(sentenceSchema) }).strict()
export const qaFileSchema = z.object({ items: z.array(qaItemSchema) }).strict()
export const grammarFileSchema = z.object({ points: z.array(grammarPointSchema) }).strict()
