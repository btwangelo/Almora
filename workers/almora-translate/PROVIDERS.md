# ALMORA Translate — motores de IA (protótipo)

A branch mantém dois provedores separados no Worker:

- **Tradução textual:** Cloudflare Workers AI, por padrão `@cf/zai-org/glm-4.7-flash`.
- **Edição/reconstrução de imagem:** Cloudflare Workers AI, por padrão `@cf/black-forest-labs/flux-2-klein-4b`.

O binding `AI` está declarado em `wrangler.toml`. Os modelos podem ser alterados por variáveis de ambiente:

- `TRANSLATION_MODEL`
- `IMAGE_EDIT_MODEL`

## Modelo de imagem escolhido

FLUX.2 Klein 4B é usado como adaptador experimental de edição por referências. Verifique a disponibilidade, os termos e o preço atuais no catálogo oficial da Cloudflare antes de depender dele em produção.

**Limitação importante:** FLUX.2 Klein 4B não recebe uma máscara de inpainting nativa. O Worker envia a página e a máscara preto/branco como duas referências visuais. O modelo gera uma versão editada; depois, o navegador usa a máscara original para compor o resultado somente nas áreas pintadas. Isso protege pixels fora da seleção, mas não garante que a reconstrução dentro da seleção fique fiel ao desenho original. A saída precisa de revisão humana.

As imagens de referência são reduzidas no navegador para no máximo 511 px no lado maior; a dimensão de saída permanece limitada a 1.920 px por lado.

## Cota e custo

A cota e o consumo variam conforme o plano, o modelo e as dimensões efetivas das imagens. Consulte os limites e preços atuais da Cloudflare antes de executar lotes grandes. Nenhum plano pago ou crédito deve ser ativado sem autorização explícita.

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

A interface permite traduzir texto, executar OCR local com Tesseract.js, extrair imagens de ZIP/CBZ e PDF, retomar lotes sem duplicar páginas, revisar o OCR e as traduções salvas, pintar regiões para reconstrução, aplicar manualmente falas e exportar páginas PNG. O fluxo também gera pacotes ZIP criptografados de revisão com imagens originais e textos traduzidos separados.

## O que ainda não está implementado

Ainda não há detecção automática de balões, lettering automático, fila assíncrona/retry, QA visual, CBZ final com lettering ou publicação automática na biblioteca. O ZIP gerado é um pacote de revisão editorial, não uma edição final pronta para publicação. Os arquivos originais continuam preservados.

## Segurança e deploy

O Worker continua usando os segredos Supabase/R2 já previstos. Nunca coloque a chave service-role no frontend ou em variáveis públicas do Wrangler. Configure o binding AI e mantenha segredos apenas como secrets. Não faça deploy nem merge desta branch até testar os dois provedores e confirmar a cota disponível na conta.
