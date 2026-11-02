---
name: changelog
description: How to add an entry to the changelog (CHANGELOG.md in English and CHANGELOG.sv.md in Swedish), which learners read on the app's "What's new" page. Use whenever you ship a change learners will notice, or when asked to update or write the changelog. Requires the writing skill.
---

# Changelog

The changelog tells learners what changed in the app. It is not a commit log. There are two files with the same entries:

- `CHANGELOG.md` in English
- `CHANGELOG.sv.md` in Swedish

The app shows the one that matches the learner's language on the "What's new" page (`/whats-new`, "Nytt i appen" in Swedish), and a banner on the home page points to it until they've seen the newest entry.

## Before you write

Read the [writing skill](../writing/SKILL.md) first and follow it, including its Swedish section. No LLM language is allowed in either file: no "enhanced", "seamless", "streamlined", "improved experience", no em dashes, no "this matters", no "not just X but Y", and in Swedish no "sömlös", "avgörande" or "inte bara X utan även Y". If a bullet would look at home in a press release, rewrite it.

## What goes in

- Changes a learner can see, hear or feel: new exercises, changed behaviour, fixed bugs they could hit, new content, new voices.
- Leave out refactors, tests, tooling, CI and dependency updates unless they change something for the learner.
- Leave out internal names (file names, function names, libraries, model names, FSRS). Describe what the learner sees.

## Format

- Newest entry at the top, under a `## YYYY-MM-DD` heading for the day it went live. Add to today's heading if it already exists.
- One short bullet per change. Aim for one line, at most two short sentences.
- Start each bullet with where the change is, using the names on screen, then a colon.
  - English: `Recognition:`, `Recall:`, `Sentence building:`, `Q&A:`, `Module pages:`, `Words:`, `Progress:`, `Settings:`, `Audio:`, `App:` for changes that apply everywhere.
  - Swedish: `Igenkänning:`, `Återkallning:`, `Meningsbygge:`, `Frågor & svar:`, `Modulsidor:`, `Ord:`, `Framsteg:`, `Inställningar:`, `Ljud:`, `Appen:`.
- Say what changed, in the present tense: "Recall: new words start as a choice between four options." Not "We've added..." and not "Improved...".
- Use button labels exactly as the app shows them in that language, in double quotes ("Show 4 options" in English, "Visa 4 alternativ" in Swedish). Look them up in `src/**/strings.ts`.
- No sub-bullets, no bold, no emoji, no "Added / Changed / Fixed" sections. A fix is written as the new behaviour: "Q&A: answers only use words you have already met."
- The Swedish bullet says the same thing as the English one, in the same order, written the way a Swede would say it. Don't translate word for word.

## Steps

1. List what shipped since the last entry: `git log --oneline <last-entry-commit>..HEAD`.
2. Keep only what a learner would notice. Merge commits that describe one change into one bullet.
3. Write the English bullets in `CHANGELOG.md`, then the same bullets in Swedish in `CHANGELOG.sv.md`.
4. Run the check command from the writing skill on both files and fix every hit that shouldn't be there.
5. Run `npx vitest run src/features/whats-new`. It fails if the two files have different dates or bullet counts, if a bullet has no area, or if a file contains common LLM words.
6. Commit both files on their own: `git commit -m "Changelog: YYYY-MM-DD"`.

## Example

Good:

```markdown
## 2026-11-02

- Recall: new words start as a choice between four options.
- Q&A: answers only use words you have already met.
```

```markdown
## 2026-11-02

- Återkallning: nya ord börjar som ett val mellan fyra alternativ.
- Frågor & svar: svaren använder bara ord du redan har mött.
```

Bad (LLM language, vague, too long):

```markdown
- Recall has been significantly enhanced to provide a more approachable learning experience — new learners can now seamlessly choose from multiple options, ensuring a smoother journey.
```
