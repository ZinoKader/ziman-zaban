# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

English and Swedish speakers learning Sorani Kurdish or Persian (Farsi), often with a family or partner connection to the language. They practise in short sessions, mostly on a phone, and come back daily for reviews. Some study both languages.

## Product Purpose

Ziman·Zabân takes a learner from understanding a word to holding a simple conversation in Sorani or Persian. Success is words that stick: learners return for spaced reviews, and words move from Recognition to Recall, then into sentences and answers to spoken questions.

## Positioning

- Sorani and Persian are taught side by side. Shared words are shown in both languages, so a learner can study one or both and see where they meet.
- One path with four steps (Recognition, Recall, Sentence building, Q&A), each opening as the one before it is learned.
- Spaced repetition with FSRS at a 90% retention target, with immediate feedback on every answer.
- Native recordings: almost every Persian sentence, question and answer is recorded by Essi. Sorani still uses a computer voice.
- Word lists are checked against reference sources, and the evidence for each word is shown in the app.

## Operating Context

- Short daily sessions of about five minutes, started from the home page.
- Every exercise has a question phase and a feedback phase with audio, romanization, word-by-word gloss and grammar links.
- Words, grammar, alphabet, progress statistics, medals, "What's new" and "Method & sources" are reference pages next to the path.
- Picture recognition sits beside the path, using Wikimedia Commons photos of dishes, the haft-sin table, the pantry, the market and a café.

## Capabilities and Constraints

- React, Vite, TypeScript, Tailwind CSS v4 and shadcn/ui; motion for animation. Deployed to GitHub Pages; progress in Supabase.
- Interface in English and Swedish. Content in Sorani and Persian, written in Arabic script (right to left) with Latin romanization that can be hidden.
- Arabic-script text needs a face that renders Sorani letters (ڵ ڕ ۆ ێ ە) and Persian correctly. Vazirmatn does this today.
- Light and dark themes.
- Guests use the app without signing up.
- Undecided: none of the current name mark (ز), fonts, palette or module colours are fixed. The user confirmed they may change.

## Brand Commitments

- The name Ziman·Zabân (both words mean "language"). Kept for now, not declared binding.
- Copy follows `.cursor/skills/writing/SKILL.md`: plain, specific, no LLM language, in both English and Swedish.

## Evidence on Hand

- Over 550 words per language across 20 units, sentences, questions with model answers, grammar notes (`src/content/data/`).
- Human recordings by Essi and generated audio (`public/audio/`, manifest at `public/audio/manifest.json`).
- 63 Commons photos with credits (`public/pictures/`, credits on `/about`).
- Research citations behind each method choice on `/about`.
- No testimonials, user counts or press exist; do not invent them.

## Product Principles

- Practice first: the home page always offers the next session in one tap.
- Every answer teaches: feedback is immediate and shows the right form, sound and meaning.
- Both languages are equal citizens, with neither treated as a variant of the other.
- Show the real state honestly: what is learned, what is fading, what is due.

## Accessibility & Inclusion

- WCAG AA contrast in both themes. Right and wrong answers are never shown by colour alone.
- Reduced motion keeps fades and drops movement.
- Correct right-to-left handling and readable line height for Arabic script.
