# Laboratório isolado — visão para mangás/manhwas

## Objetivo

Comparar detecção visual e leitura de elementos de uma página de quadrinhos sem alterar o ALMORA Translate em produção, o Worker ativo, o banco Supabase, o R2 ou projetos existentes.

## Estado de segurança

- Esta branch é experimental e não é publicada automaticamente.
- Não adicionar rotas ao Worker de produção nesta etapa.
- Não ler nem escrever tabelas do Supabase.
- Não usar o bucket R2 de produção.
- Não executar lotes nem reprocessar páginas do projeto ativo.
- Nenhum modelo será ativado antes de validar licença, preço, limites e qualidade.

## Candidatos

1. **Cloudflare Workers AI — Qwen 3.8 27B** (`@cf/qwen/qwen3.8-27b`): modelo multimodal para interpretar a página e devolver uma estrutura JSON. Não deve ser tratado como detector geométrico especializado sem teste.
2. **Cloudflare Workers AI — Moondream 3.1** (`@cf/moondream/moondream3.1-9B-A2B`): avaliar tarefas `detect`, `point` e `query` para localizar balões e compreender regiões. Testar seus limites com balões irregulares, textos pequenos e SFX.
3. **Detector especializado Manga Bubble YOLO**: avaliar `Kiuyha/Manga-Bubble-YOLO` (Apache-2.0), treinado para regiões de balão/texto. Confirmar formato, classes, licença dos pesos e infraestrutura de inferência antes de integrar.
4. **Alternativa especializada**: `PSImera/manga_bubbles_detect` (MIT), detector de caixas de balões; sua classe única não separa narração, SFX e outros tipos.

## Protocolo de teste

Para cada imagem de teste, manter uma anotação humana de referência com:
- ID estável;
- caixa delimitadora em pixels e coordenadas normalizadas;
- classe: fala, pensamento, narração, SFX, título, texto de apresentação, texto incidental ou desconhecido;
- transcrição literal;
- ordem de leitura;
- observações sobre texto vertical, manuscrito, sobreposto ou parcialmente ilegível.

Executar os modelos separadamente, sem fornecer a anotação de referência ao modelo. Comparar:
- precisão e recall das regiões (IoU >= 0,50);
- taxa de regiões perdidas e duplicadas;
- CER/WER do OCR por região;
- acerto da classificação;
- ordem de leitura;
- fidelidade da tradução por elemento;
- consistência das coordenadas e do JSON.

Não contar como sucesso uma resposta que apenas enumere textos sem coordenadas. Não fundir elementos distintos, inclusive SFX repetidos.

## Formato de saída esperado

```json
{
  "page": { "width": 0, "height": 0 },
  "elements": [
    {
      "id": "e001",
      "type": "speech",
      "bbox": { "x": 0, "y": 0, "width": 0, "height": 0 },
      "reading_order": 1,
      "source_text": "",
      "translated_text": null,
      "ocr_confidence": null,
      "detection_confidence": null,
      "status": "needs_review"
    }
  ]
}
```

## Critério de aprovação

Nenhum candidato será escolhido apenas por benchmark publicado. A decisão depende de desempenho na mesma página, revisão humana, custo medido por página, latência, limite de imagem, licença e privacidade. Traduções permanecem em rascunho até aprovação humana.

## Fontes técnicas iniciais

- Cloudflare Qwen 3.8 27B: https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/
- Cloudflare Moondream 3.1: https://developers.cloudflare.com/workers-ai/models/moondream3.1-9B-A2B/
- Kiuyha Manga-Bubble-YOLO: https://huggingface.co/Kiuyha/Manga-Bubble-YOLO
- PSImera manga_bubbles_detect: https://huggingface.co/PSImera/manga_bubbles_detect

## Próximo passo

Anexar novamente a página de referência ao ambiente de teste. A imagem não deve ser enviada ao Worker ou ao banco de produção. Depois, preparar uma execução isolada por candidato e registrar as saídas brutas e métricas.
