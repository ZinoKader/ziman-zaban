---
name: changelog
description: How to add an entry to CHANGELOG.md. Use whenever you ship a change learners will notice, or when asked to update or write the changelog. Requires the writing skill.
---

# Changelog

`CHANGELOG.md` tells learners what changed in the app. It is not a commit log.

## Before you write

Read the [writing skill](../writing/SKILL.md) first and follow it. No LLM language is allowed in the changelog: no "enhanced", "seamless", "streamlined", "improved experience", no em dashes, no "this matters", no "not just X but Y". If a bullet would look at home in a press release, rewrite it.

## What goes in

- Changes a learner can see, hear or feel: new exercises, changed behaviour, fixed bugs they could hit, new content, new voices.
- Leave out refactors, tests, tooling, CI and dependency updates unless they change something for the learner.
- Leave out internal names (file names, function names, libraries, model names, FSRS). Describe what the learner sees.

## Format

- Newest entry at the top, under a `## YYYY-MM-DD` heading for the day it went live. Add to today's heading if it already exists.
- One short bullet per change. Aim for one line, at most two short sentences.
- Start each bullet with where the change is, using the names on screen, then a colon: `Recognition:`, `Recall:`, `Sentence building:`, `Q&A:`, `Module pages:`, `Words:`, `Progress:`, `Settings:`, `Audio:`. Use `App:` for changes that apply everywhere.
- Say what changed, in the present tense: "Recall: new words start as a choice between four options." Not "We've added..." and not "Improved...".
- Use button labels exactly as the app shows them in English, in double quotes.
- No sub-bullets, no bold, no emoji, no "Added / Changed / Fixed" sections. A fix is written as the new behaviour: "Q&A: answers only use words you have already met."

## Steps

1. List what shipped since the last entry: `git log --oneline <last-entry-commit>..HEAD`.
2. Keep only what a learner would notice. Merge commits that describe one change into one bullet.
3. Write the bullets following the format above.
4. Run the check command from the writing skill on `CHANGELOG.md` and fix every hit that shouldn't be there.
5. Commit it on its own: `git commit -m "Changelog: YYYY-MM-DD"`.

## Example

Good:

```markdown
## 2026-11-02

- Recall: new words start as a choice between four options.
- Q&A: answers only use words you have already met.
```

Bad (LLM language, vague, too long):

```markdown
- Recall has been significantly enhanced to provide a more approachable learning experience — new learners can now seamlessly choose from multiple options, ensuring a smoother journey.
```
