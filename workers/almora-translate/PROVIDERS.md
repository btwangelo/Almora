# ALMORA Translate — motores de IA (protótipo)

A branch mantém dois provedores separados no Worker:

- **Tradução textual:** Cloudflare Workers AI, por padrão `@cf/zai-org/glm-4.7-flash`.
- **Edição/reconstrução de imagem:** Cloudflare Workers AI, por padrão `@cf/black-forest-labs/flux-2-klein-4b`.

O binding `AI` está declarado em `wrangler.toml`. Os modelos podem ser alterados por variáveis de ambiente:

- `TRANSLATION_MODEL`
- `IMAGE_EDIT_MODEL`

## Modelo de imagem escolhido

FLUX.2 Klein 4B substitui o antigo Stable Diffusion 1.5 Inpainting, que tem descontinuação programada. A versão 4B aceita edição por referências de imagem e custa menos que a versão 9B. O modelo upstream 4B é publicado sob Apache-2.0.

**Limitação importante:** FLUX.2 Klein 4B não recebe uma máscara de inpainting nativa. O Worker envia a página e a máscara preto/branco como duas referências visuais. O modelo gera uma versão editada; depois, o navegador usa a máscara original para compor o resultado somente nas áreas pintadas. Isso protege pixels fora da seleção, mas não garante que a reconstrução dentro da seleção fique fiel ao desenho original. A saída precisa de revisão humana.

As imagens de referência são reduzidas no navegador para no máximo 511 px no lado maior; a dimensão de saída permanece limitada a 1.920 px por lado.

## Cota e custo

Workers AI Free oferece 10.000 Neurons por dia. A tabela atual de preço do FLUX.2 Klein 4B indica 5,37 Neurons por tile de entrada 512×512 e 26,05 Neurons por tile de saída 512×512. O consumo depende do tamanho efetivo das imagens. Ao exceder a cota diária, novas inferências falham até o reset. Não habilite plano pago nem créditos sem autorização explícita.

## Rotas autenticadas

- `POST /api/projects/:id/translate`
  - JSON: `{ "text": "...", "source_language": "en|ko|ja|zh", "context": "...", "glossary": [{ "source": "...", "target": "..." }] }`
  - Limite de 6.000 caracteres.
  - Exige tradutor ou administrador.

- `POST /api/projects/:id/reconstruct`
  - JSON: `{ "image_b64": "data:image/png;base64,...", "mask": [bytes PNG], "width": 800, "height": 1200 }`
  - A máscara é um PNG codificado como array de bytes. Branco indica área a editar; preto indica área a preservar.
  - Dimensões entre 256 e 1.920 px por lado; a imagem de referência e a máscara são reduzidas a no máximo 511 px no lado maior.
  - Retorna PNG. Exige tradutor ou administrador.

A interface permite traduzir texto, pintar as regiões da página e aplicar manualmente falas com posicionamento por toque/clique e exportação PNG.

## O que ainda não está implementado

Este protótipo ainda não faz OCR automático, extração segura de ZIP/CBZ/PDF, detecção de balões, processamento em lote, lettering automático, fila/retry, QA visual, exportação CBZ/ZIP ou publicação editorial. Os arquivos originais continuam preservados; a saída editada é baixada separadamente.

## Segurança e deploy

O Worker continua usando os segredos Supabase/R2 já previstos. Nunca coloque a chave service-role no frontend ou em variáveis públicas do Wrangler. Configure o binding AI e mantenha segredos apenas como secrets. Não faça deploy nem merge desta branch até testar os dois provedores e confirmar a cota disponível na conta.
