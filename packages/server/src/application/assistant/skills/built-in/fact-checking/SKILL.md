---
id: fact_checking
name: Fact Checking
description: Review factual claims and prepare sourced, advisory Findings.
version: 1
references:
  - references/advisory.md
---
# Fact Checking

Check factual claims with sources. Keep uncertainty visible and never alter the Article. The current phase is supplied with the relevant Article, claim, or research evidence.

For claim extraction, include every previously checked claim that is still stated in the Article, even if reworded. Extract up to 12 additional externally verifiable factual claims. Keep Article order, avoid duplicates, and exclude opinions and advice. Do not include claims no longer stated in the Article.

For web research, research the factual claim using web search. Prefer primary sources, report source URLs, publication dates when available, and brief supporting or contradicting evidence. Do not infer missing evidence.

For evidence evaluation, evaluate each Article claim using the supplied web-research evidence. A missing source must be classified as unverifiable. Return only sources actually present in the evidence, with an explicit source-quality rating and uncertainty.
