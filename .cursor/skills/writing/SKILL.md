---
name: writing
description: How to write any prose in this repo without LLM language. Read it before writing or editing a changelog entry, README, docs, commit message, code comment, or user-facing copy in the app (English or Swedish strings). The changelog skill requires it.
---

# Writing

Write like a person explaining a change to a friend who uses the app. Plain words, concrete facts, short sentences. No LLM language: if a sentence sounds like a chatbot wrote it, rewrite it.

The patterns below come from [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), Graphite's [AI Tells](https://graphite.io/research/ai-tells) study of 90,000 model-written articles, and the sourced word lists at [ScriptGrain](https://scriptgrain.com/reference/words-chatgpt-overuses) and [isitslop.io](https://isitslop.io/ai-words-and-phrases/). One of these words on its own proves nothing. A text full of them reads as machine-written, so leave them all out.

## Rules

1. Say what happened, with the specific fact. "Recall now starts with four options" beats "Recall is now more approachable".
2. Use "is", "are" and "has". Not "serves as", "stands as", "boasts", "features", "offers" or "represents" when you mean "is" or "has".
3. Don't tell the reader why something matters. Give the fact and let them decide. No "this matters", "why X matters", "this is important because".
4. Don't contrast with a claim nobody made. No "not just X, but Y", "it's not X, it's Y", "more than an X, it's a Y", "X rather than Y", "not simply X".
5. Don't hedge. No "may help", "can provide", "potentially", "it's worth noting", "it's important to note". If you're not sure it's true, check or leave it out.
6. Don't inflate. No "seamless", "robust", "powerful", "comprehensive", "significantly improved", "game-changing".
7. Don't pad lists to three. Write one item if there is one, two if there are two.
8. Don't end a sentence with an "-ing" phrase that comments on the sentence: "..., making it easier to learn", "..., ensuring a smoother experience". Cut it, or make it its own plain sentence with a fact in it.
9. Don't vary words for the same thing. If it's a "word" in one sentence, it's a "word" in the next, not a "term", "item" and "vocabulary entry".
10. Name things the way the app names them. Use the module names on screen (Recognition, Recall, Sentence building, Q&A) and the button labels as written.
11. No chatbot talk: "Certainly", "Great question", "Here's a breakdown", "I hope this helps", "Let me know", "In summary", "Overall".

## Words to avoid

Use the plain word on the right, or drop the word.

| Avoid | Write instead |
| --- | --- |
| delve, dive into, deep dive | look at, go through |
| leverage, harness, utilize | use |
| enhance, elevate, bolster, boost | improve, or say what changed |
| streamline | make shorter, make faster |
| showcase, highlight, underscore, emphasize (as verbs) | show |
| foster, cultivate, empower | help, let |
| seamless, seamlessly | (drop it) |
| robust, dependable, steady | (say what it handles) |
| crucial, pivotal, vital, key (as adjectives) | important, or drop it |
| comprehensive, holistic, multifaceted | full, complete, or drop it |
| intricate, nuanced | (say what the detail is) |
| meticulous, meticulously, thoughtfully, carefully crafted | (drop it) |
| vibrant, rich, profound, groundbreaking, renowned | (drop it) |
| landscape, realm, tapestry, journey, ecosystem (as metaphors) | (name the actual thing) |
| testament to, stands as, serves as | is |
| align with, resonate with | match, fit |
| additionally, furthermore, moreover (at the start of a sentence) | also, and, or start a new sentence |
| quietly, universally, practical, clearer | (say how, or drop it) |
| unlock, unleash | let you, open |
| navigate (anything that isn't a map) | use, get through |
| ensure | make sure, or drop it |

## Punctuation and format

- No em dashes (—). Use a comma, a colon, a full stop or brackets. En dashes (–) are fine in ranges like 1–4.
- Straight quotes and apostrophes (' and "), not curly ones.
- Sentence case in headings: "How reviews work", not "How Reviews Work".
- No bold inside running text, no emoji in headings or bullets.
- Bullets only when the content is a real list. A single point is a sentence.

## Swedish

The same rules apply to Swedish copy in `src/**/strings.ts` and `src/i18n/`. Watch for the Swedish versions of the same habits: "avgörande", "spelar en central roll", "sömlös", "banbrytande", "dessutom" at the start of every other sentence, "inte bara X utan även Y", "i en värld där". Write the way a Swede would say it out loud: "Nya ord börjar med fyra alternativ", not "Upplevelsen har förbättrats avsevärt".

## Check before you finish

Read the text out loud in your head. If a sentence would sound odd said to a friend, rewrite it. Then run:

```bash
rg -n -i -e '—' -e '\b(delve|leverage|harness|utili[sz]e|enhanc|elevat|bolster|streamlin|showcas|underscor|foster|empower|seamless|robust|dependable|crucial|pivotal|vital|comprehensive|holistic|multifaceted|intricate|nuanced|meticulous|thoughtfully|vibrant|groundbreaking|renowned|landscape|realm|tapestry|testament|align with|resonate|additionally|furthermore|moreover|unlock|unleash|ensur)' -e 'this matters' -e 'not just' -e 'not simply' -e 'rather than' -e "it's important to" -e 'worth noting' <files>
```

Every hit needs a reason to stay. Most should go.
