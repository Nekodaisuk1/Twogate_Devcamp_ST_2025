# Twogate_Devcamp_ST_2025

デプロイ先URL:
https://twogate-devcamp-st-2025.onrender.com

## Paragraph-level embeddings

Memos are now split into paragraphs and each paragraph is embedded separately.
When comparing memos, the system looks at the most similar pair of paragraphs
and uses that score. This paragraph-level comparison yields more precise links
for long memos because unrelated sections no longer dilute similarity results.
