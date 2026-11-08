# ALMORA Translate — motores de IA (protótipo)

Esta branch adiciona dois adaptadores independentes ao Worker:

- **Tradução textual:** Cloudflare Workers AI, por padrão `@cf/zai-org/glm-4.7-flash`.
- **Reconstrução de imagem:** Cloudflare Workers AI, por padrão `@cf/black-forest-labs/flux-2-klein-4b`.

O binding `AI` está declarado em `wrangler.toml`. Os modelos podem ser trocados por variáveis de ambiente sem alterar a interface:

- `TRANSLATION_MODEL`
- `INPAINT_MODEL`

## Cotas e disponibilidade

Workers AI oferece uma alocação gratuita de **10.000 Neurons por dia** no plano Free. Ao exceder a cota, as inferências falham até a renovação diária; não habilite um plano pago para contornar isso sem autorização explícita.

O modelo `@cf/black-forest-labs/flux-2-klein-4b` está em beta e tem descontinuação anunciada para **removida a previsão de descontinuação do modelo anterior**. Portanto, o adaptador de reconstrução é apenas um teste temporário, não uma dependência de produção. Antes dessa data, deve ser substituído por outro serviço gratuito validado ou por um backend de reconstrução próprio. Não prometa disponibilidade permanente.

## Rotas autenticadas

- `POST /api/projects/:id/translate`
  - JSON: `{ "text": "...", "source_language": "en|ko|ja|zh", "context": "...", "glossary": [{ "source": "...", "target": "..." }] }`
  - Limite de 6.000 caracteres por chamada.
  - Exige tradutor ou administrador.
  - Retorna tradução, modelo e par linguístico.

- `POST /api/projects/:id/reconstruct`
  - JSON: `{ "image_b64": "data:image/png;base64,...", "mask": [0,255,...], "width": 800, "height": 1200 }`
  - A máscara PNG é enviada como segunda imagem de referência; o pincel cria branco nas áreas a reconstruir e preto nas áreas preservadas. O navegador compõe o resultado apenas na região marcada.
  - Dimensões entre 256 e 2.048 px por lado; imagem de até 5 MiB.
  - Retorna PNG. Exige tradutor ou administrador.

A UI permite testar texto colado, pintar diretamente sobre a página as regiões a reconstruir e aplicar manualmente várias falas sobre uma página limpa com posicionamento por toque/clique e exportação PNG.

## O que ainda não está implementado

Este protótipo **não** faz ainda OCR automático, extração segura de ZIP/CBZ/PDF, detecção de balões, processamento em lote, lettering automático, fila/retry, QA visual, exportação CBZ/ZIP ou publicação editorial. Os arquivos originais continuam preservados; a saída de reconstrução é baixada separadamente.

## Segurança e deploy

O Worker continua usando os segredos Supabase/R2 já previstos na configuração. Nunca coloque a chave service-role no frontend ou em variáveis públicas do Wrangler. Configure o binding AI no Cloudflare e mantenha os segredos apenas como secrets. Não faça deploy nem merge desta branch até testar os modelos e confirmar a cota disponível na conta.
