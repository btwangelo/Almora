(() => {
  const SUPABASE_URL = "https://mcdinntggkanmsqubozn.supabase.co";
  const SUPABASE_KEY = "sb_publishable_dbymLTRkJyrohmyCjS6aPA_25sOAS61";
  const API_BASE = window.ALMORA_TRANSLATE_API || "https://almora-translate.kauansousa353.workers.dev";
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = id => document.getElementById(id);
  let session = null;
  let roles = [];

  const labels = {
    pending_upload: "Aguardando arquivos", uploaded: "Arquivos recebidos",
    queued: "Na fila", processing: "Em processamento",
    translator_review: "Revisão do tradutor", editorial_review: "Revisão editorial",
    changes_requested: "Ajustes solicitados", approved: "Aprovado",
    published: "Publicado", failed: "Falhou", cancelled: "Cancelado"
  };
  const roleLabels = {
    owner: "Proprietário", admin: "Administrador", translator: "Tradutor",
    editor_bl: "Editor BL", editor_gl: "Editor GL", reviewer: "Revisor"
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const bytes = n => {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n/1024).toFixed(1) + " KB";
    return (n/1048576).toFixed(1) + " MB";
  };
  const date = value => new Date(value).toLocaleString("pt-BR");

  async function api(path, options = {}) {
    if (API_BASE.includes("YOUR_SUBDOMAIN")) throw new Error("A API do Translate ainda não foi publicada. Falta configurar o endereço do Worker.");
    const res = await fetch(API_BASE.replace(/\/$/,"") + path, {
      ...options,
      headers: {
        "Authorization": "Bearer " + session.access_token,
        ...(options.headers || {})
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Falha na comunicação com o servidor.");
    return data;
  }

  function notice(message, error = false) {
    $("notice").className = error ? "notice error" : "notice";
    $("notice").innerHTML = message;
    $("notice").hidden = false;
  }

  async function refresh() {
    $("projects").innerHTML = '<div class="loading">Carregando projetos…</div>';
    try {
      const data = await api("/api/projects");
      roles = data.roles || [];
      $("rolePill").textContent = roles.map(role => roleLabels[role] || role).join(" · ");
      $("createPanel").hidden = !roles.some(role => ["owner","admin","translator"].includes(role));
      renderProjects(data.projects || []);
    } catch (error) {
      $("projects").innerHTML = '<div class="empty">' + esc(error.message) + '</div>';
    }
  }

  function renderProjects(projects) {
    if (!projects.length) {
      $("projects").innerHTML = '<div class="empty">Nenhum projeto disponível. Crie seu primeiro projeto acima.</div>';
      return;
    }
    window.__almoraProjects = projects;
    $("projects").innerHTML = projects.map(project => {
      const mayUpload = ["owner","admin","translator"].some(role => roles.includes(role)) &&
        (roles.includes("owner") || roles.includes("admin") || project.created_by === session.user.id || project.assigned_translator_id === session.user.id);
      return '<article class="project" data-project="' + esc(project.id) + '" data-source-language="' + esc(project.source_language) + '">' +
        '<div class="project-top"><div><h3>' + esc(project.title) + '</h3><div class="meta">' +
        esc(({en:"Inglês",ko:"Coreano",ja:"Japonês",zh:"Chinês"})[project.source_language] || project.source_language) +
        ' → Português brasileiro · Criado em ' + esc(date(project.created_at)) + '</div></div>' +
        '<span class="status">' + esc(labels[project.status] || project.status) + '</span></div>' +
        '<div class="meta" style="margin-top:10px">' + Number(project.total_pages || 0) + ' páginas · ' +
        Number(project.completed_pages || 0) + ' concluídas · ' + Number(project.failed_pages || 0) + ' com falha</div>' +
        (mayUpload ? '<div class="file-row"><input type="file" class="files" multiple accept=".zip,.cbz,.pdf,.png,.jpg,.jpeg,.webp"><button class="small-button upload">Enviar arquivos</button></div>' +
          '<section class="engine-panel"><h4>Motor de tradução · teste</h4><textarea class="source-text" rows="3" maxlength="6000" placeholder="Cole uma fala ou trecho para testar a tradução…"></textarea><button class="small-button translate-text">Traduzir para PT-BR</button><div class="engine-output" data-translation-output></div></section>' +
          '<section class="engine-panel review-panel"><h4>Revisão e entrega editorial</h4><p>Envie a tradução para avaliação ou registre a decisão editorial. A aprovação não publica automaticamente a obra.</p><textarea class="review-notes" rows="2" maxlength="4000" placeholder="Observações para a equipe (opcional)…"></textarea>' +
          (["owner","admin","translator"].some(role => roles.includes(role)) && ["uploaded","translator_review","changes_requested"].includes(project.status) && (roles.includes("owner") || roles.includes("admin") || project.created_by === session.user.id || project.assigned_translator_id === session.user.id) ? '<button class="small-button submit-review" type="button">Enviar para revisão editorial</button>' : '') +
          (["owner","admin","editor_bl","editor_gl","reviewer"].some(role => roles.includes(role)) && project.status === "editorial_review" ? '<div class="review-actions"><button class="small-button approve-review" type="button">Aprovar tradução</button><button class="small-button request-changes" type="button">Solicitar ajustes</button></div>' : '') +
          '</section>' +
          '<section class="engine-panel"><h4>Obra completa · OCR + tradução em lote</h4><p>Processe páginas de imagens, ZIP/CBZ ou PDF. O reconhecimento acontece no seu navegador; a tradução usa a IA do ALMORA.</p><label>Arquivo da obra <input class="batch-source" type="file" accept=".zip,.cbz,.pdf,image/png,image/jpeg,image/webp"></label><button class="small-button batch-process" type="button">Extrair, reconhecer e traduzir</button><div class="batch-progress" aria-live="polite"></div><div class="engine-output" data-batch-output></div></section>' +
          '<section class="engine-panel"><h4>Reconstrução de imagem · teste</h4><p>Envie uma página e pinte diretamente sobre as áreas com texto. O pincel marca em vermelho o que deve ser reconstruído.</p><label>Página original <input class="rebuild-image" type="file" accept="image/png,image/jpeg,image/webp"></label><div class="mask-editor" hidden><div class="mask-stage"><canvas class="mask-preview"></canvas><canvas class="mask-overlay"></canvas></div><label>Pincel <input class="brush-size" type="range" min="8" max="120" value="36"></label><button class="small-button clear-mask" type="button">Limpar marcação</button></div><button class="small-button reconstruct-image">Reconstruir área marcada</button><div class="engine-output" data-reconstruction-output></div></section>' +
          '<section class="engine-panel"><h4>Aplicar tradução nos balões · lettering</h4><p>Envie a página limpa, digite uma fala e toque no local do balão para posicioná-la. Você pode adicionar vários textos à mesma página.</p><label>Página limpa <input class="letter-image" type="file" accept="image/png,image/jpeg,image/webp"></label><textarea class="letter-text" rows="2" maxlength="1500" placeholder="Digite ou cole a fala traduzida…"></textarea><button class="small-button use-translation" type="button">Usar tradução acima</button><div class="letter-stage" hidden><canvas class="letter-canvas"></canvas></div><div class="letter-actions"><label>Tamanho do texto <input class="letter-size" type="range" min="12" max="80" value="32"></label><button class="small-button clear-lettering" type="button">Limpar textos</button><button class="small-button export-lettering" type="button">Baixar página legendada</button></div><div class="engine-output" data-lettering-output></div></section>' : '') +
        '<div class="file-list" data-file-list>' +
        ((project.almora_translation_files || []).length
          ? project.almora_translation_files.map(file => '✓ ' + esc(file.original_name) + ' · ' + bytes(Number(file.file_size_bytes || 0))).join('<br>')
          : 'Nenhum arquivo enviado ainda.') +
        '</div></article>';
    }).join("");
    document.querySelectorAll(".project .upload").forEach(button => {
      button.addEventListener("click", () => uploadFiles(button.closest(".project")));
    });

    document.querySelectorAll(".project .submit-review, .project .approve-review, .project .request-changes").forEach(button => {
      button.addEventListener("click", async () => {
        const card = button.closest(".project");
        const decision = button.classList.contains("submit-review") ? "submitted" :
          button.classList.contains("approve-review") ? "approved" : "changes_requested";
        const notes = card.querySelector(".review-notes")?.value || "";
        button.disabled = true;
        try {
          const result = await api("/api/projects/" + card.dataset.project + "/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision, notes })
          });
          notice(decision === "submitted" ? "Projeto enviado para revisão editorial." :
            decision === "approved" ? "Tradução aprovada. A publicação ainda depende do fluxo editorial da obra." :
            "Ajustes solicitados ao responsável pela tradução.");
          await refresh();
        } catch(error) {
          notice(error.message, true);
          button.disabled = false;
        }
      });
    });

    document.querySelectorAll(".project .translate-text").forEach(button => {
      button.addEventListener("click", async () => {
        const card = button.closest(".project");
        const input = card.querySelector(".source-text");
        const output = card.querySelector("[data-translation-output]");
        const project = projects.find(item => item.id === card.dataset.project);
        if (!input.value.trim()) return notice("Cole o texto que deseja traduzir.", true);
        button.disabled = true;
        output.textContent = "Traduzindo…";
        card._lastTranslation = "";
        try {
          const result = await api("/api/projects/" + card.dataset.project + "/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: input.value.trim(),
              source_language: project.source_language,
              context: project.narrative_context || ""
            })
          });
          output.textContent = result.translation;
          card._lastTranslation = result.translation;
          notice("Tradução concluída pelo motor " + esc(result.model) + ".");
        } catch (error) {
          output.textContent = error.message;
          notice(error.message, true);
        } finally { button.disabled = false; }
      });
    });


    document.querySelectorAll(".project .batch-process").forEach(button => {
      button.addEventListener("click", async () => {
        const card = button.closest(".project");
        const file = card.querySelector(".batch-source").files[0];
        const progress = card.querySelector(".batch-progress");
        const output = card.querySelector("[data-batch-output]");
        if (!file) return notice("Escolha um ZIP, CBZ, PDF ou imagem.", true);
        if (file.size > 50 * 1024 * 1024) return notice("O arquivo deve ter até 50 MiB.", true);
        button.disabled = true;
        output.textContent = "";
        const pages = [];
        let worker = null;
        try {
          const ext = file.name.toLowerCase().split(".").pop();
          if (["zip","cbz"].includes(ext)) {
            if (!window.JSZip) throw new Error("A biblioteca ZIP não carregou. Atualize a página e tente novamente.");
            const zip = await JSZip.loadAsync(file);
            const entries = Object.values(zip.files).filter(x => !x.dir && /\.(png|jpe?g|webp)$/i.test(x.name)).sort((x,y)=>x.name.localeCompare(y.name,undefined,{numeric:true}));
            if (!entries.length) throw new Error("O arquivo não contém páginas PNG, JPG ou WEBP.");
            if (entries.length > 20) throw new Error("Por segurança, processe no máximo 20 páginas por lote.");
            for (const entry of entries) pages.push({name:entry.name, blob:await entry.async("blob")});
          } else if (ext === "pdf") {
            if (!window.pdfjsLib) throw new Error("O leitor de PDF não carregou. Atualize a página e tente novamente.");
            pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
            const pdf = await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
            if (pdf.numPages > 20) throw new Error("Por segurança, processe no máximo 20 páginas por lote.");
            for (let n=1;n<=pdf.numPages;n++) {
              progress.textContent = "Preparando PDF · página "+n+"/"+pdf.numPages;
              const page=await pdf.getPage(n), viewport=page.getViewport({scale:1.5});
              const canvas=document.createElement("canvas");
              canvas.width=Math.ceil(viewport.width); canvas.height=Math.ceil(viewport.height);
              await page.render({canvasContext:canvas.getContext("2d"),viewport}).promise;
              const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
              if(blob) pages.push({name:"pagina-"+String(n).padStart(3,"0")+".png",blob});
            }
          } else if (file.type.startsWith("image/")) pages.push({name:file.name,blob:file});
          else throw new Error("Formato não suportado. Use ZIP, CBZ, PDF, PNG, JPG ou WEBP.");
          if (!window.Tesseract) throw new Error("O OCR não carregou. Atualize a página e tente novamente.");
          const lang = ({en:"eng",ko:"kor",ja:"jpn",zh:"chi_sim"})[card.dataset.sourceLanguage] || "eng";
          progress.textContent = "Iniciando OCR ("+lang+")…";
          worker = await Tesseract.createWorker(lang, 1, {logger:m => {
            if(m.status==="recognizing text") progress.textContent="Reconhecendo texto · "+Math.round((m.progress||0)*100)+"%";
          }});
          const project = (window.__almoraProjects || []).find(p=>p.id===card.dataset.project);
          const results=[];
          const existingDetail = await api("/api/projects/"+card.dataset.project);
          const firstPageNumber = (existingDetail.pages || []).reduce((max,p)=>Math.max(max,Number(p.page_number)||0),0)+1;
          for(let i=0;i<pages.length;i++){
            progress.textContent="OCR · página "+(i+1)+"/"+pages.length;
            const recognized=await worker.recognize(pages[i].blob);
            const source=String(recognized.data.text||"").trim();
            let translatedText="";
            if(source){
              progress.textContent="Traduzindo · página "+(i+1)+"/"+pages.length;
              const translated=await api("/api/projects/"+card.dataset.project+"/translate",{
                method:"POST",headers:{"Content-Type":"application/json"},
                body:JSON.stringify({text:source.slice(0,5800),source_language:project?.source_language||"en",context:project?.narrative_context||""})
              });
              translatedText=translated.translation;
            }
            progress.textContent="Salvando página "+(i+1)+"/"+pages.length+"…";
            const pageImage=await loadImage(await readDataUrl(pages[i].blob));
            const scale=Math.min(1,1800/Math.max(pageImage.width,pageImage.height));
            const pageCanvas=document.createElement("canvas");
            pageCanvas.width=Math.max(1,Math.round(pageImage.width*scale));
            pageCanvas.height=Math.max(1,Math.round(pageImage.height*scale));
            pageCanvas.getContext("2d").drawImage(pageImage,0,0,pageCanvas.width,pageCanvas.height);
            let imageData=pageCanvas.toDataURL("image/jpeg",0.84);
            if(imageData.length>10*1024*1024) imageData=pageCanvas.toDataURL("image/jpeg",0.68);
            if(imageData.length>11*1024*1024) throw new Error("A página "+(i+1)+" ficou grande demais para armazenamento.");
            const saved=await api("/api/projects/"+card.dataset.project+"/pages",{
              method:"POST",headers:{"Content-Type":"application/json"},
              body:JSON.stringify({
                page_number:firstPageNumber+i,
                original_name:pages[i].name.replace(/\.[^.]+$/,"")+".jpg",
                mime_type:"image/jpeg", image_b64:imageData,
                ocr_text:source, translated_text:translatedText,
                translation_model:translatedText ? "Cloudflare Workers AI" : ""
              })
            });
            results.push("PÁGINA "+(i+1)+" — "+pages[i].name+" · guardada como página "+saved.page_number+
              "\nTEXTO RECONHECIDO:\n"+(source||"Nenhum texto reconhecido.")+
              (translatedText?"\n\nTRADUÇÃO:\n"+translatedText:"\n\nTRADUÇÃO: não gerada (sem texto reconhecido)."));
          }
          const report=results.join("\n\n"+ "─".repeat(32)+"\n\n");
            progress.textContent="OCR · página "+(i+1)+"/"+pages.length;
            const recognized=await worker.recognize(pages[i].blob);
            const source=String(recognized.data.text||"").trim();
            if(!source){results.push("PÁGINA "+(i+1)+" · Nenhum texto reconhecido.");continue;}
            progress.textContent="Traduzindo · página "+(i+1)+"/"+pages.length;
            const translated=await api("/api/projects/"+card.dataset.project+"/translate",{
              method:"POST",headers:{"Content-Type":"application/json"},
              body:JSON.stringify({text:source.slice(0,5800),source_language:project?.source_language||lang,context:project?.narrative_context||""})
            });
            results.push("PÁGINA "+(i+1)+" — "+pages[i].name+"\nTEXTO RECONHECIDO:\n"+source+"\n\nTRADUÇÃO:\n"+translated.translation);
          }
          const report=results.join("\n\n"+ "─".repeat(32)+"\n\n");
          const blob=new Blob([report],{type:"text/plain;charset=utf-8"});
          const url=URL.createObjectURL(blob);
          output.innerHTML='<a class="download-result" download="'+esc(file.name.replace(/\.[^.]+$/,""))+'-traduzido.txt" href="'+url+'">Baixar OCR + traduções (.txt)</a><pre class="batch-report">'+esc(report)+'</pre>';
          progress.textContent="Concluído · "+pages.length+" página(s). Revise o OCR e as traduções antes de aplicar o lettering.";
          notice("Lote concluído. O relatório foi gerado; nenhuma página original foi alterada.");
        } catch(error) {
          progress.textContent="";
          output.textContent=error.message;
          notice(error.message,true);
        } finally {
          if(worker) await worker.terminate().catch(()=>{});
          button.disabled=false;
        }
      });
    });

    document.querySelectorAll(".project .rebuild-image").forEach(input => {
      input.addEventListener("change", async () => {
        const card = input.closest(".project");
        const file = input.files[0];
        const editor = card.querySelector(".mask-editor");
        if (!file) { editor.hidden = true; card._maskCanvas = null; return; }
        if (file.size > 5 * 1024 * 1024) {
          notice("A página deve ter no máximo 5 MiB.", true);
          input.value = "";
          editor.hidden = true;
          return;
        }
        try {
          const image = await loadImage(await readDataUrl(file));
          if (image.width > 1920 || image.height > 1920 || image.width < 256 || image.height < 256) {
            throw new Error("Use uma página entre 256 e 1.920 pixels por lado.");
          }
          const preview = card.querySelector(".mask-preview");
          const overlay = card.querySelector(".mask-overlay");
          const maskCanvas = document.createElement("canvas");
          [preview, overlay, maskCanvas].forEach(canvas => { canvas.width = image.width; canvas.height = image.height; });
          preview.getContext("2d").drawImage(image, 0, 0);
          const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
          maskContext.fillStyle = "#000";
          maskContext.fillRect(0, 0, image.width, image.height);
          card._maskCanvas = maskCanvas;
          const overlayContext = overlay.getContext("2d");
          let drawing = false;
          let previous = null;
          const point = event => {
            const rect = overlay.getBoundingClientRect();
            return { x: (event.clientX - rect.left) * overlay.width / rect.width, y: (event.clientY - rect.top) * overlay.height / rect.height };
          };
          const stroke = (ctx, from, to, radius, color) => {
            ctx.beginPath();
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = color;
            ctx.lineWidth = radius * 2;
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.arc(to.x, to.y, radius, 0, Math.PI * 2);
            ctx.fill();
          };
          overlay.onpointerdown = event => {
            drawing = true;
            previous = point(event);
            overlay.setPointerCapture(event.pointerId);
            const radius = Number(card.querySelector(".brush-size").value) / 2;
            stroke(maskContext, previous, previous, radius, "#fff");
            stroke(overlayContext, previous, previous, radius, "rgba(255,55,105,.58)");
          };
          overlay.onpointermove = event => {
            if (!drawing || !previous) return;
            const next = point(event);
            const radius = Number(card.querySelector(".brush-size").value) / 2;
            stroke(maskContext, previous, next, radius, "#fff");
            stroke(overlayContext, previous, next, radius, "rgba(255,55,105,.58)");
            previous = next;
          };
          overlay.onpointerup = overlay.onpointercancel = () => { drawing = false; previous = null; };
          card.querySelector(".clear-mask").onclick = () => {
            maskContext.fillStyle = "#000";
            maskContext.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
            overlayContext.clearRect(0, 0, overlay.width, overlay.height);
          };
          editor.hidden = false;
        } catch (error) {
          editor.hidden = true;
          card._maskCanvas = null;
          notice(error.message, true);
        }
      });
    });


    document.querySelectorAll(".project .letter-image").forEach(input => {
      input.addEventListener("change", async () => {
        const card = input.closest(".project");
        const file = input.files[0];
        const stage = card.querySelector(".letter-stage");
        if (!file) { stage.hidden = true; card._letterBase = null; return; }
        if (file.size > 5 * 1024 * 1024) {
          notice("A página para lettering deve ter no máximo 5 MiB.", true);
          input.value = "";
          return;
        }
        try {
          const image = await loadImage(await readDataUrl(file));
          if (image.width > 4096 || image.height > 4096) throw new Error("A página deve ter até 4.096 pixels por lado.");
          const canvas = card.querySelector(".letter-canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          card._letterBase = image;
          card._letterBlocks = [];
          canvas.onclick = event => {
            const text = card.querySelector(".letter-text").value.trim();
            if (!text) return notice("Digite a fala antes de tocar no balão.", true);
            const rect = canvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) * canvas.width / rect.width;
            const y = (event.clientY - rect.top) * canvas.height / rect.height;
            card._letterBlocks.push({ text, x, y });
            drawLettering(card);
          };
          stage.hidden = false;
          drawLettering(card);
        } catch (error) {
          stage.hidden = true;
          card._letterBase = null;
          notice(error.message, true);
        }
      });
    });
    document.querySelectorAll(".project .use-translation").forEach(button => {
      button.addEventListener("click", () => {
        const card = button.closest(".project");
        const translated = String(card._lastTranslation || "").trim();
        if (!translated) return notice("Faça uma tradução bem-sucedida primeiro.", true);
        card.querySelector(".letter-text").value = translated;
      });
    });
    document.querySelectorAll(".project .clear-lettering").forEach(button => {
      button.addEventListener("click", () => {
        const card = button.closest(".project");
        card._letterBlocks = [];
        drawLettering(card);
      });
    });
    document.querySelectorAll(".project .letter-size").forEach(input => {
      input.addEventListener("input", () => drawLettering(input.closest(".project")));
    });
    document.querySelectorAll(".project .export-lettering").forEach(button => {
      button.addEventListener("click", () => {
        const card = button.closest(".project");
        const canvas = card.querySelector(".letter-canvas");
        if (!card._letterBase || !card._letterBlocks || !card._letterBlocks.length) return notice("Adicione pelo menos uma fala à página.", true);
        canvas.toBlob(blob => {
          if (!blob) return notice("Não foi possível exportar a página.", true);
          const url = URL.createObjectURL(blob);
          const output = card.querySelector("[data-lettering-output]");
          output.innerHTML = '<a class="download-result" download="almora-pagina-legendada.png" href="' + url + '">Baixar página legendada</a>';
          notice("Lettering aplicado. O arquivo original permanece intacto.");
        }, "image/png");
      });
    });

    document.querySelectorAll(".project .reconstruct-image").forEach(button => {
      button.addEventListener("click", async () => {
        const card = button.closest(".project");
        const original = card.querySelector(".rebuild-image").files[0];
        const maskCanvas = card._maskCanvas;
        const output = card.querySelector("[data-reconstruction-output]");
        if (!original || !maskCanvas) return notice("Envie uma página e marque pelo menos uma área para reconstrução.", true);
        if (original.size > 5 * 1024 * 1024) return notice("A página deve ter no máximo 5 MiB.", true);
        button.disabled = true;
        output.textContent = "Reconstruindo…";
        try {
          if (API_BASE.includes("YOUR_SUBDOMAIN")) throw new Error("A API do Translate ainda não foi publicada.");
          const dataUrl = await readDataUrl(original);
          const image = await loadImage(dataUrl);
          if (image.width !== maskCanvas.width || image.height !== maskCanvas.height) throw new Error("A máscara não corresponde à página selecionada.");
          if (image.width > 1920 || image.height > 1920) throw new Error("Para este motor, a página deve ter até 1.920 pixels por lado.");
          const scale = Math.min(1, 511 / Math.max(image.width, image.height));
          const refWidth = Math.max(1, Math.round(image.width * scale));
          const refHeight = Math.max(1, Math.round(image.height * scale));
          const refImage = document.createElement("canvas");
          refImage.width = refWidth; refImage.height = refHeight;
          refImage.getContext("2d").drawImage(image, 0, 0, refWidth, refHeight);
          const refMask = document.createElement("canvas");
          refMask.width = refWidth; refMask.height = refHeight;
          refMask.getContext("2d").drawImage(maskCanvas, 0, 0, refWidth, refHeight);
          const maskBlob = await new Promise(resolve => refMask.toBlob(resolve, "image/png"));
          if (!maskBlob) throw new Error("Não foi possível preparar a máscara PNG.");
          const mask = Array.from(new Uint8Array(await maskBlob.arrayBuffer()));
          const result = await fetch(API_BASE.replace(/\/$/, "") + "/api/projects/" + card.dataset.project + "/reconstruct", {
            method: "POST",
            headers: { "Authorization": "Bearer " + session.access_token, "Content-Type": "application/json" },
            body: JSON.stringify({ image_b64: refImage.toDataURL("image/png"), mask, width: image.width, height: image.height })
          });
          if (!result.ok) {
            const error = await result.json().catch(() => ({}));
            throw new Error(error.error || "Falha na edição da imagem.");
          }
          const generated = await loadImage(URL.createObjectURL(await result.blob()));
          const finalCanvas = document.createElement("canvas");
          finalCanvas.width = image.width; finalCanvas.height = image.height;
          const finalContext = finalCanvas.getContext("2d");
          finalContext.drawImage(image, 0, 0);
          const patch = document.createElement("canvas");
          patch.width = image.width; patch.height = image.height;
          const patchContext = patch.getContext("2d");
          patchContext.drawImage(generated, 0, 0, image.width, image.height);
          const alphaMask = document.createElement("canvas");
          alphaMask.width = image.width; alphaMask.height = image.height;
          const alphaContext = alphaMask.getContext("2d", { willReadFrequently: true });
          alphaContext.drawImage(maskCanvas, 0, 0);
          const maskPixels = alphaContext.getImageData(0, 0, image.width, image.height);
          for (let i = 0; i < maskPixels.data.length; i += 4) {
            const amount = Math.round((maskPixels.data[i] + maskPixels.data[i+1] + maskPixels.data[i+2]) / 3);
            maskPixels.data[i] = 255; maskPixels.data[i+1] = 255; maskPixels.data[i+2] = 255;
            maskPixels.data[i+3] = amount;
          }
          alphaContext.putImageData(maskPixels, 0, 0);
          patchContext.globalCompositeOperation = "destination-in";
          patchContext.drawImage(alphaMask, 0, 0);
          finalContext.drawImage(patch, 0, 0);
          const finalBlob = await new Promise(resolve => finalCanvas.toBlob(resolve, "image/png"));
          if (!finalBlob) throw new Error("Não foi possível montar a página final.");
          const imageUrl = URL.createObjectURL(finalBlob);
          output.innerHTML = '<img class="reconstruction-preview" alt="Imagem editada" src="' + imageUrl + '"><a class="download-result" download="almora-reconstruida.png" href="' + imageUrl + '">Baixar resultado</a>';
          notice("Edição concluída. As alterações foram compostas somente nas áreas pintadas; revise o resultado.");
        } catch (error) {
          output.textContent = error.message;
          notice(error.message, true);
        } finally { button.disabled = false; }
      });
    });
  }



  function wrapLetterText(ctx, text, maxWidth) {
    const lines = [];
    for (const paragraph of String(text).split("\n")) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (!words.length) { lines.push(""); continue; }
      let line = "";
      for (const word of words) {
        const candidate = line ? line + " " + word : word;
        if (line && ctx.measureText(candidate).width > maxWidth) {
          lines.push(line);
          line = word;
        } else line = candidate;
      }
      lines.push(line);
    }
    return lines;
  }

  function drawLettering(card) {
    const canvas = card.querySelector(".letter-canvas");
    if (!canvas || !card._letterBase) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(card._letterBase, 0, 0);
    for (const block of card._letterBlocks || []) {
      let size = Math.max(12, Number(card.querySelector(".letter-size").value) * canvas.width / 1000);
      const maxWidth = canvas.width * 0.76;
      const maxHeight = canvas.height * 0.30;
      let lines = [];
      let lineHeight = size * 1.12;
      while (size >= 10) {
        ctx.font = "700 " + size + "px Arial, sans-serif";
        lines = wrapLetterText(ctx, block.text, maxWidth);
        lineHeight = size * 1.12;
        if (lines.every(line => ctx.measureText(line).width <= maxWidth) && lines.length * lineHeight <= maxHeight) break;
        size -= 1;
      }
      ctx.font = "700 " + size + "px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const x = Math.max(maxWidth / 2 + 4, Math.min(canvas.width - maxWidth / 2 - 4, block.x));
      const totalHeight = lines.length * lineHeight;
      const y = Math.max(totalHeight / 2 + 4, Math.min(canvas.height - totalHeight / 2 - 4, block.y));
      lines.forEach((line, index) => {
        const lineY = y - totalHeight / 2 + lineHeight * (index + 0.5);
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(2, size * 0.10);
        ctx.strokeStyle = "rgba(255,255,255,.92)";
        ctx.strokeText(line, x, lineY, maxWidth);
        ctx.fillStyle = "#17131f";
        ctx.fillText(line, x, lineY, maxWidth);
      });
    }
  }

  function readDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      reader.readAsDataURL(file);
    });
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Imagem inválida."));
      image.src = src;
    });
  }

  async function uploadFiles(card) {
    const input = card.querySelector(".files");
    const files = [...(input.files || [])];
    if (!files.length) return notice("Escolha pelo menos um arquivo antes de enviar.", true);
    const button = card.querySelector(".upload");
    const list = card.querySelector("[data-file-list]");
    button.disabled = true;
    const uploaded = [];
    try {
      for (const file of files) {
        list.textContent = "Enviando " + file.name + "…";
        const result = await api("/api/projects/" + card.dataset.project + "/files", {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "X-File-Name": encodeURIComponent(file.name)
          },
          body: file
        });
        uploaded.push(result.file.name + " (" + bytes(result.file.size_bytes) + ")");
      }
      list.innerHTML = uploaded.map(name => "✓ " + esc(name)).join("<br>");
      input.value = "";
      notice("Arquivos enviados e armazenados com criptografia.");
      await refresh();
    } catch (error) {
      list.textContent = error.message;
      notice(error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  $("projectForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      const data = await api("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: $("title").value.trim(),
          source_language: $("sourceLanguage").value,
          target_language: "pt-BR",
          translation_style: "adaptive",
          narrative_context: $("context").value.trim(),
          rights_confirmed: $("rights").checked
        })
      });
      $("projectForm").reset();
      notice("Projeto criado. Agora você pode enviar os arquivos originais.");
      await refresh();
    } catch (error) {
      notice(error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  async function init() {
    const { data, error } = await supabase.auth.getSession();
    if (error) return notice("Não foi possível verificar sua sessão ALMORA.", true);
    session = data.session;
    if (!session) {
      notice('Você precisa entrar na sua conta ALMORA primeiro. <a href="../#conta">Abrir login da ALMORA</a> e depois voltar a esta página.');
      $("app").hidden = true;
      return;
    }
    $("notice").hidden = true;
    $("app").hidden = false;
    await refresh();
  }

  $("refreshBtn").addEventListener("click", refresh);
  init();
})();