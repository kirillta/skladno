# Accessibility review routing

Use this after recording a finding in the [accessibility release walkthrough](accessibility-release-walkthrough.md). The reviewer records the finding and its evidence. The owner of the affected area fixes it or files the linked issue. The maintainer who accepts an architecture decision owns its ADR.

## Route a decision

Write an ADR only when the fix chooses a lasting boundary or rule that future work must follow, such as a renderer or service responsibility, a persistence or network boundary, or a shared interaction pattern with competing reasonable designs. State the context, decision, consequences, and verification. Do not write an ADR for an isolated label, focus, contrast, or layout fix. Record those in the issue and regression test instead.

## Route terminology

Update the [glossary](../../user/Glossary.md) only when a finding shows that an author-facing domain term is missing, ambiguous, or no longer describes implemented behavior. Add the term when authors need it to understand a product concept. Correct it when the concept remains but its definition is wrong. Retire it when no implemented concept uses it. Do not add visual labels, implementation names, or one-off test language.

## Close the finding

Link the issue, ADR, or glossary change from the walkthrough's `Decisions discovered` or `Domain terms discovered` section. Record `None` only after applying both rules. Keep the walkthrough vendor-neutral; this routing rule applies to every accessibility review.
