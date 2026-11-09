(() => {
  const SUPABASE_URL = "https://mcdinntggkanmsqubozn.supabase.co";
  const SUPABASE_KEY = "sb_publishable_dbymLTRkJyrohmyCjS6aPA_25sOAS61";
  const API_BASE = window.ALMORA_TRANSLATE_API || "https://almora-translate.kauansousa353.workers.dev";
  // Use the exact Supabase Auth storage key shared by the main ALMORA client.
  // This keeps both clients on the same browser origin attached to one session.
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      storageKey: "sb-mcdinntggkanmsqubozn-auth-token",
      // Force both ALMORA and Translate clients to read the same origin-scoped browser storage.
      storage: window.localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
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

  function showProgress(container, label, percent = null, detail = "") {
    if (!container) return;
    const known = Number.isFinite(percent);
    const value = known ? Math.max(0, Math.min(100, percent)) : 0;
    container.innerHTML = '<div class="task-progress" role="status" aria-live="polite">' +
      '<div class="task-progress-heading"><span>' + esc(label) + '</span><strong>' + (known ? Math.round(value) + "%" : "Em andamento") + '</strong></div>' +
      '<div class="task-progress-track' + (known ? "" : " is-indeterminate") + '" role="progressbar" aria-label="' + esc(label) + '"' +
      (known ? ' aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(value) + '"' : ' aria-valuetext="Em andamento"') + '><span style="width:' + (known ? value : 38) + '%"></span></div>' +
      (detail ? '<div class="task-progress-detail">' + esc(detail) + '</div>' : '') +
      '</div>';
  }

  function withTimeout(promise, label, ms = 10000) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(label + " demorou mais de " + Math.round(ms / 1000) + " segundos. Recarregue a página e tente novamente.")), ms);
      })
    ]).finally(() => window.clearTimeout(timer));
  }

  async function request(path, options = {}) {
    if (API_BASE.includes("YOUR_SUBDOMAIN")) throw new Error("A API do Translate ainda não foi publicada. Falta configurar o endereço do Worker.");

    // Sempre buscar o token atual do armazenamento compartilhado; a variável
    // session pode conter um access token antigo mesmo com a conta conectada.
    const current = await withTimeout(supabase.auth.getSession(), "A leitura da sessão ALMORA");
    if (current.error) throw new Error("Não foi possível recuperar sua sessão ALMORA: " + current.error.message);
    let accessToken = current.data.session?.access_token;
    if (!accessToken) throw new Error("Sua sessão ALMORA expirou. Entre novamente.");

    const send = token => fetch(API_BASE.replace(/\/$/,"") + path, {
      ...options,
      headers: { ...(options.headers || {}), "Authorization": "Bearer " + token }
    });

    let res = await send(accessToken);
    if (res.status === 401) {
      // Se o access token expirou, renovar usando o refresh token da sessão
      // existente e repetir a mesma requisição uma única vez.
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.error || !refreshed.data.session?.access_token) {
        throw new Error("O servidor recusou a sessão ALMORA e não foi possível renová-la. Entre novamente na ALMORA.");
      }
      session = refreshed.data.session;
      accessToken = session.access_token;
      res = await send(accessToken);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Falha na comunicação com o servidor (HTTP " + res.status + ").");
    }
    return res;
  }
  async function api(path, options = {}) { return (await request(path, options)).json().catch(() => ({})); }
  async function apiBlob(path) { return (await request(path)).blob(); }
  function sha256Hex(value) { return crypto.subtle.digest("SHA-256", value instanceof ArrayBuffer ? value : new TextEncoder().encode(String(value))).then(buffer => Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2,"0")).join("")); }
  function blobDataUrl(blob) { return new Promise((resolve,reject) => { const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result)); reader.onerror=()=>reject(new Error("Não foi possível preparar a imagem.")); reader.readAsDataURL(blob); }); }

  function scoreOcrResult(result) {
    const text = String(result?.data?.text || "").trim();
    const confidence = Number(result?.data?.confidence);
    const chars = [...text].filter(char => /[\\p{L}\\p{N}]/u.test(char)).length;
    const symbols = [...text].filter(char => !/[\\p{L}\\p{N}\\s.,!?;:'"“”‘’()\\[\\]{}…—–-]/u.test(char)).length;
    const meaningfulRatio = text.length ? chars / text.length : 0;
    const symbolRatio = text.length ? symbols / text.length : 0;
    const words = text.split(/\\s+/).filter(word => /[\\p{L}\\p{N}]{2,}/u.test(word)).length;
    let score = Number.isFinite(confidence) ? confidence : 0;
    if (text.length < 8) score -= 30;
    if (text.length >= 18 && meaningfulRatio < 0.48) score -= 35;
    if (text.length >= 18 && symbolRatio > 0.20) score -= 25;
    if (text.length >= 35 && words < 4) score -= 12;
    return { text, confidence: Number.isFinite(confidence) ? Math.round(confidence) : null,
      meaningful_ratio: Math.round(meaningfulRatio * 100), symbol_ratio: Math.round(symbolRatio * 100),
      words, score: Math.max(0, Math.min(100, Math.round(score))),
      reliable: text.length >= 8 && score >= 42 && meaningfulRatio >= 0.48 && symbolRatio <= 0.20 };
  }

  async function recognizePageWithRetry(worker, blob) {
    const first = await worker.recognize(blob);
    let best = scoreOcrResult(first);
    if (best.reliable) return { ...best, attempts: 1 };
    const image = await loadImageFile(blob);
    const scale = Math.min(2.2, 2600 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.filter = "grayscale(1) contrast(1.45)";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.filter = "none";
    const retry = await worker.recognize(canvas);
    const candidate = scoreOcrResult(retry);
    canvas.width = 0;
    canvas.height = 0;
    if (candidate.score > best.score) best = candidate;
    return { ...best, attempts: 2 };
  }

  function normalizeForComparison(value) {
    return String(value || "").normalize("NFKC").toLocaleLowerCase()
      .replace(/[\\p{P}\\p{S}\\s]+/gu, "");
  }

  async function translateLongText(projectId, text, language, _context, onProgress) {
    const chunks = [];
    let remaining = String(text || "").trim();
    while (remaining.length) {
      let cut = Math.min(5600, remaining.length);
      if (cut < remaining.length) {
        const newline = remaining.lastIndexOf(String.fromCharCode(10), cut);
        const sentence = Math.max(remaining.lastIndexOf(". ", cut), remaining.lastIndexOf("! ", cut), remaining.lastIndexOf("? ", cut));
        const boundary = Math.max(newline, sentence, remaining.lastIndexOf(" ", cut));
        if (boundary > 2800) cut = boundary + 1;
      }
      chunks.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    const translated = [];
    for (let i = 0; i < chunks.length; i++) {
      if (onProgress) onProgress(i + 1, chunks.length);
      const result = await api("/api/projects/" + projectId + "/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunks[i], source_language: language })
      });
      translated.push(result.translation);
    }
    return translated.join(String.fromCharCode(10));
  }

  function notice(message, error = false) { const node=$("notice"); node.className=error?"notice error":"notice"; node.textContent=String(message??""); node.hidden=false; }

  async function refresh() {
    $("projects").innerHTML = '<div class="loading">Carregando projetos…</div>';
    try {
      const data = await api("/api/projects");
      roles = data.roles || [];
      $("rolePill").textContent = roles.map(role => roleLabels[role] || role).join(" · ");
      $("createPanel").hidden = !roles.some(role => ["owner","admin","translator"].includes(role));
      renderProjects(data.projects || []);
    } catch (error) {
      $("projects").textContent = error.message;
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
      const mayDelete = roles.includes("owner") || roles.includes("admin") || project.created_by === session.user.id;
      return '<article class="project" data-project="' + esc(project.id) + '" data-source-language="' + esc(project.source_language) + '">' +
        '<div class="project-top"><div><h3>' + esc(project.title) + '</h3><div class="meta">' +
        esc(({en:"Inglês",ko:"Coreano",ja:"Japonês",zh:"Chinês"})[project.source_language] || project.source_language) +
        ' → Português brasileiro · Criado em ' + esc(date(project.created_at)) + '</div></div>' +
        '<span class="status">' + esc(labels[project.status] || project.status) + '</span></div>' +
        (mayDelete ? '<div class="project-actions"><button class="small-button delete-project" type="button">Apagar projeto</button></div>' : '') +
        '<div class="meta" style="margin-top:10px">' + Number(project.total_pages || 0) + ' páginas · ' +
        Number(project.completed_pages || 0) + ' concluídas · ' + Number(project.failed_pages || 0) + ' com falha</div>' +
        (mayUpload ? '<div class="file-row"><input type="file" class="files" multiple accept=".zip,.cbz,.pdf,.png,.jpg,.jpeg,.webp"><button class="small-button upload">Enviar arquivos</button></div>' +
          '<section class="engine-panel"><h4>Motor de tradução · teste</h4><textarea class="source-text" rows="3" maxlength="6000" placeholder="Cole uma fala ou trecho para testar a tradução…"></textarea><button class="small-button translate-text">Traduzir para PT-BR</button><div class="engine-output" data-translation-output></div></section>' +
          '<section class="engine-panel review-panel"><h4>Revisão e entrega editorial</h4><p>Gere um pacote ZIP com as imagens originais e as traduções em separado para avaliação.</p>' +
          (["editorial_review","approved","published"].includes(project.status) ? "" : '<button class="small-button package-review" type="button">Gerar pacote de revisão (.zip)</button>') +
          (["owner","admin","translator"].some(role => roles.includes(role)) && !["editorial_review","approved","published"].includes(project.status) ? '<button class="small-button prepare-lettering" type="button">Preparar balões das páginas salvas</button>' : '') +
          '<div class="package-progress" aria-live="polite"></div><div class="version-list">' + ((project.almora_translation_versions || []).map(v => '<div>Versão ' + Number(v.version_number) + ' · ' + esc(v.status) + ' <button class="small-button download-version" data-version="' + esc(v.id) + '" type="button">Baixar pacote</button></div>').join("")) + '</div><textarea class="review-notes" rows="2" maxlength="4000" placeholder="Observações para a equipe (opcional)…"></textarea>' +
          (["owner","admin","translator"].some(role => roles.includes(role)) && ["uploaded","translator_review","changes_requested"].includes(project.status) && (roles.includes("owner") || roles.includes("admin") || project.created_by === session.user.id || project.assigned_translator_id === session.user.id) ? '<button class="small-button submit-review" type="button">Enviar para revisão editorial</button>' : '') +
          (["owner","admin","editor_bl","editor_gl","reviewer"].some(role => roles.includes(role)) && project.status === "editorial_review" ? '<div class="review-actions"><button class="small-button approve-review" type="button">Aprovar tradução</button><button class="small-button request-changes" type="button">Solicitar ajustes</button></div>' : '') +
          '</section>' +
          '<section class="engine-panel"><h4>Obra completa · OCR + tradução em lote</h4><p>Processe páginas de imagens, ZIP/CBZ ou PDF. O reconhecimento acontece no seu navegador; a tradução usa a IA do ALMORA.</p><label>Arquivo da obra <input class="batch-source" type="file" accept=".zip,.cbz,.pdf,.png,.jpg,.jpeg,.webp,application/zip,application/pdf,image/png,image/jpeg,image/webp"></label><div class="batch-file-name" aria-live="polite">Nenhum arquivo selecionado.</div><button class="small-button batch-process" type="button">Extrair, reconhecer e traduzir</button><div class="batch-progress" aria-live="polite"></div><div class="engine-output" data-batch-output></div></section>' +
          '<section class="engine-panel"><h4>Reconstrução de imagem · teste</h4><p>Envie uma página e pinte diretamente sobre as áreas com texto. O pincel marca em vermelho o que deve ser reconstruído.</p><label>Página original <input class="rebuild-image" type="file" accept="image/png,image/jpeg,image/webp"></label><div class="mask-editor" hidden><div class="mask-stage"><canvas class="mask-preview"></canvas><canvas class="mask-overlay"></canvas></div><label>Pincel <input class="brush-size" type="range" min="8" max="120" value="36"></label><button class="small-button clear-mask" type="button">Limpar marcação</button></div><button class="small-button reconstruct-image">Reconstruir área marcada</button><div class="engine-output" data-reconstruction-output></div></section>' +
          '<section class="engine-panel"><h4>Aplicar tradução nos balões · lettering</h4><p>Envie a página limpa, digite uma fala e toque no local do balão para posicioná-la. Você pode adicionar vários textos à mesma página.</p><label>Página limpa <input class="letter-image" type="file" accept="image/png,image/jpeg,image/webp"></label><textarea class="letter-text" rows="2" maxlength="1500" placeholder="Digite ou cole a fala traduzida…"></textarea><button class="small-button use-translation" type="button">Usar tradução acima</button><div class="letter-stage" hidden><canvas class="letter-canvas"></canvas></div><div class="letter-actions"><label>Tamanho do texto <input class="letter-size" type="range" min="12" max="80" value="32"></label><button class="small-button clear-lettering" type="button">Limpar textos</button><button class="small-button export-lettering" type="button">Baixar página legendada</button></div><div class="engine-output" data-lettering-output></div></section>' : '') +
        (!mayUpload && ["owner","admin","editor_bl","editor_gl","reviewer"].some(role => roles.includes(role)) && project.status === "editorial_review" ? '<section class="engine-panel review-panel"><h4>Revisão editorial</h4><p>Confira as páginas e o pacote antes de decidir.</p><div class="version-list">' + ((project.almora_translation_versions || []).map(v => '<div>Versão ' + Number(v.version_number) + ' · ' + esc(v.status) + ' <button class="small-button download-version" data-version="' + esc(v.id) + '" type="button">Baixar pacote</button></div>').join("")) + '</div><textarea class="review-notes" rows="2" maxlength="4000" placeholder="Observações da revisão…"></textarea><div class="review-actions"><button class="small-button approve-review" type="button">Aprovar tradução</button><button class="small-button request-changes" type="button">Solicitar ajustes</button></div></section>' : '') +
        '<div class="file-list" data-file-list>' +
        ((project.almora_translation_files || []).length
          ? project.almora_translation_files.map(file => '<div>✓ ' + esc(file.original_name) + ' · ' + bytes(Number(file.file_size_bytes || 0)) + ' <button class="small-button download-file" data-file="' + esc(file.id) + '" type="button">Baixar original</button></div>').join("")
          : 'Nenhum arquivo enviado ainda.') +
        '</div>' +
        '<section class="saved-pages"><h4>Páginas processadas</h4>' + (((project.almora_translation_pages || []).length) ? project.almora_translation_pages.map(page => { const o=page.ocr_data||{}; return '<details><summary>Página ' + Number(page.page_number) + ' · ' + esc(o.original_name || "imagem") + '</summary><p><strong>Texto reconhecido</strong></p><pre>' + esc(o.source_text || "Nenhum texto reconhecido.") + '</pre><p><strong>Tradução</strong></p><pre>' + esc(o.translated_text || "Ainda sem tradução.") + '</pre><button class="small-button download-page" data-page="' + esc(page.id) + '" type="button">Baixar imagem original</button></details>'; }).join("") : '<p>Nenhuma página processada ainda.</p>') + '</section></article>';
    }).join("");
    document.querySelectorAll(".project .download-file").forEach(button => button.addEventListener("click", async () => { const card=button.closest(".project"); button.disabled=true; try { const blob=await apiBlob("/api/projects/"+card.dataset.project+"/files/"+button.dataset.file+"/download"); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="arquivo-almora"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),60000); } catch(e){notice(e.message,true);} finally{button.disabled=false;} }));
    document.querySelectorAll(".project .download-page").forEach(button => button.addEventListener("click", async () => { const card=button.closest(".project"); button.disabled=true; try { const blob=await apiBlob("/api/projects/"+card.dataset.project+"/pages/"+button.dataset.page+"/image"); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="pagina-original.png"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),60000); } catch(e){notice(e.message,true);} finally{button.disabled=false;} }));
    document.querySelectorAll(".project .download-version").forEach(button => button.addEventListener("click", async () => { const card=button.closest(".project"); button.disabled=true; try { const blob=await apiBlob("/api/projects/"+card.dataset.project+"/versions/"+button.dataset.version+"/download"); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="almora-revisao.zip"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),60000); } catch(e){notice(e.message,true);} finally{button.disabled=false;} }));
    document.querySelectorAll(".project .package-review").forEach(button => button.addEventListener("click", () => createReviewPackage(button)));
    document.querySelectorAll(".project .prepare-lettering").forEach(button => button.addEventListener("click", async () => {
      const card=button.closest(".project"), progress=card.querySelector(".package-progress"); button.disabled=true; let worker=null;
      try {
        const detail=await api("/api/projects/"+card.dataset.project), pages=[...(detail.pages||[])].sort((x,y)=>Number(x.page_number)-Number(y.page_number));
        if(!pages.length) throw new Error("Ainda não há páginas salvas neste projeto.");
        if(!window.Tesseract) throw new Error("O OCR não carregou. Atualize a página.");
        const lang=({en:"eng",ko:"kor",ja:"jpn",zh:"chi_sim"})[detail.project?.source_language]||"eng";
        worker=await Tesseract.createWorker(lang,1,{logger:m=>{if(m.status==="recognizing text")showProgress(progress,"Analisando página "+(Math.min(pages.length,prepared+skipped+1))+"/"+pages.length,((prepared+skipped+(m.progress||0))/pages.length)*100,"Reconhecimento de texto e coordenadas");}});
        let prepared=0, skipped=0;
        for(let i=0;i<pages.length;i++){
          const page=pages[i]; if(page.ocr_data?.lettering_layout?.lines?.length){skipped++;continue;}
          showProgress(progress,"Preparando mapa de texto",((prepared+skipped)/pages.length)*100,"Página "+page.page_number+" de "+pages.length);
          const blob=await apiBlob("/api/projects/"+card.dataset.project+"/pages/"+page.id+"/image"), img=await loadImageFile(blob);
          const scale=Math.min(1,1800/Math.max(img.width,img.height)), width=Math.max(1,Math.round(img.width*scale)), height=Math.max(1,Math.round(img.height*scale));
          const canvas=document.createElement("canvas"); canvas.width=width; canvas.height=height; canvas.getContext("2d").drawImage(img,0,0,width,height);
          const result=await worker.recognize(canvas), lines=(result.data.lines||[]).slice(0,300).map(line=>({text:String(line.text||"").trim(),x:Math.round((Number(line.bbox?.x0)||0)*scale),y:Math.round((Number(line.bbox?.y0)||0)*scale),width:Math.max(0,Math.round(((Number(line.bbox?.x1)||0)-(Number(line.bbox?.x0)||0))*scale)),height:Math.max(0,Math.round(((Number(line.bbox?.y1)||0)-(Number(line.bbox?.y0)||0))*scale))})).filter(line=>line.text&&line.width>0&&line.height>0);
          await api("/api/projects/"+card.dataset.project+"/pages/"+page.id+"/layout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({width,height,lines})}); prepared++;
        }
        showProgress(progress,"Mapeamento concluído",100,prepared+" página(s) preparadas; "+skipped+" já tinham mapa OCR. Nenhuma tradução foi refeita.");
        notice("Mapas de texto salvos. Imagens originais e traduções preservadas."); await refresh();
      } catch(e){progress.textContent="";notice(e.message,true);} finally{if(worker)await worker.terminate().catch(()=>{});button.disabled=false;}
    }));

    document.querySelectorAll(".project .delete-project").forEach(button => {
      button.addEventListener("click", async () => {
        const card = button.closest(".project");
        const project = projects.find(item => item.id === card.dataset.project);
        if (!project) return notice("Não foi possível localizar este projeto.", true);
        const confirmed = window.confirm(
          'Apagar permanentemente "' + project.title + '"? Todos os arquivos, páginas, versões e registros deste projeto serão excluídos. Esta ação não pode ser desfeita.'
        );
        if (!confirmed) return;
        button.disabled = true;
        button.textContent = "Apagando…";
        try {
          await request("/api/projects/" + card.dataset.project, { method: "DELETE" });
          notice("Projeto apagado permanentemente.");
          await refresh();
        } catch (error) {
          notice(error.message, true);
          button.disabled = false;
          button.textContent = "Apagar projeto";
        }
      });
    });

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
        showProgress(output,"Traduzindo texto",null,"Aguardando a resposta do motor de tradução.");
        card._lastTranslation = "";
        try {
          const result = await api("/api/projects/" + card.dataset.project + "/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: input.value.trim(),
              source_language: project.source_language,
            })
          });
          showProgress(output,"Tradução concluída",100,"Motor: "+(result.model||"IA"));\n          output.insertAdjacentHTML("beforeend", '<div class="task-progress-detail">' + esc(result.translation) + '</div>');
          card._lastTranslation = result.translation;
          notice("Tradução concluída pelo motor " + esc(result.model) + ".");
        } catch (error) {
          output.textContent = error.message;
          notice(error.message, true);
        } finally { button.disabled = false; }
      });
    });


    document.querySelectorAll(".project .batch-source").forEach(input => input.addEventListener("change", () => { const file=input.files && input.files[0]; const label=input.closest(".engine-panel").querySelector(".batch-file-name"); if(label) label.textContent=file ? file.name+" · "+bytes(file.size) : "Nenhum arquivo selecionado."; }));

    document.querySelectorAll(".project .batch-process").forEach(button => {
      button.addEventListener("click", async () => {
        const card = button.closest(".project");
        const file = card.querySelector(".batch-source").files[0];
        const progress = card.querySelector(".batch-progress");
        const output = card.querySelector("[data-batch-output]");
        if (!file) return notice("Escolha um ZIP, CBZ, PDF ou imagem.", true);
        if (file.size > 80 * 1024 * 1024) return notice("O arquivo deve ter até 80 MiB.", true);
        button.disabled = true;
        output.textContent = "";
        let pageCount = 0;
        let getPage = null;
        let worker = null;
        try {
          const ext = file.name.toLowerCase().split(".").pop();
          if (["zip","cbz"].includes(ext)) {
            if (!window.JSZip) throw new Error("A biblioteca ZIP não carregou. Atualize a página e tente novamente.");
            const zip = await JSZip.loadAsync(file);
            const entries = Object.values(zip.files).filter(x => !x.dir && /\.(png|jpe?g|webp)$/i.test(x.name)).sort((x,y)=>x.name.localeCompare(y.name,undefined,{numeric:true}));
            if (!entries.length) throw new Error("O arquivo não contém páginas PNG, JPG ou WEBP.");
            if (entries.length > 500) throw new Error("Cada obra pode ter no máximo 500 páginas por processamento.");
            let expandedBytes = 0;
            for (const entry of entries) {
              const size = Number(entry._data?.uncompressedSize || 0);
              expandedBytes += size;
              if (size > 20 * 1024 * 1024 || expandedBytes > 500 * 1024 * 1024) throw new Error("O ZIP excede o limite seguro de extração (20 MiB por página e 500 MiB no total).");
            }
            pageCount = entries.length;
            getPage = async index => ({name:entries[index].name,blob:await entries[index].async("blob")});
          } else if (ext === "pdf") {
            if (!window.pdfjsLib) throw new Error("O leitor de PDF não carregou. Atualize a página e tente novamente.");
            pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
            const pdf = await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
            if (pdf.numPages > 500) throw new Error("Cada obra pode ter no máximo 500 páginas por processamento.");
            pageCount = pdf.numPages;
            getPage = async index => {
              const n = index + 1;
              showProgress(progress,"Preparando PDF",((index)/pageCount)*100,"Página "+n+" de "+pageCount);
              const page = await pdf.getPage(n);
              const baseViewport = page.getViewport({scale:1});
              const pdfScale = Math.min(1.5,1800/Math.max(baseViewport.width,baseViewport.height));
              const viewport = page.getViewport({scale:pdfScale});
              const canvas = document.createElement("canvas");
              canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
              await page.render({canvasContext:canvas.getContext("2d"),viewport}).promise;
              const blob = await new Promise(resolve => canvas.toBlob(resolve,"image/png"));
              canvas.width = 0; canvas.height = 0;
              page.cleanup?.();
              if (!blob) throw new Error("Não foi possível preparar a página " + n + " do PDF.");
              return {name:"pagina-"+String(n).padStart(3,"0")+".png",blob};
            };
          } else if (file.type.startsWith("image/")) {
            pageCount = 1;
            getPage = async () => ({name:file.name,blob:file});
          } else throw new Error("Formato não suportado. Use ZIP, CBZ, PDF, PNG, JPG ou WEBP.");
          if (!window.Tesseract) throw new Error("O OCR não carregou. Atualize a página e tente novamente.");
          const lang = ({en:"eng",ko:"kor",ja:"jpn",zh:"chi_sim"})[card.dataset.sourceLanguage] || "eng";
          progress.textContent = "Iniciando OCR ("+lang+")…";
          worker = await Tesseract.createWorker(lang, 1, {logger:m => {
            if(m.status==="recognizing text") showProgress(progress,"Reconhecendo texto",((window.__almoraBatchPage||0)+(m.progress||0)*0.4)/Math.max(1,window.__almoraBatchTotal||1)*100,"OCR · página "+((window.__almoraBatchPage||0)+1)+" de "+(window.__almoraBatchTotal||pageCount));
          }});
          const project = (window.__almoraProjects || []).find(p=>p.id===card.dataset.project);
          const results=[];
          const existingDetail = await api("/api/projects/"+card.dataset.project);
          const fileHash = await sha256Hex(await file.arrayBuffer());
          const existingOriginal = (existingDetail.files || []).find(item => item.checksum_sha256 === fileHash);
          let sourceFileId = existingOriginal?.id || null;
          if (!existingOriginal) {
            progress.textContent = "Preservando o arquivo original no armazenamento seguro…";
            const uploadedSource = await api("/api/projects/"+card.dataset.project+"/files", { method:"POST", headers:{"Content-Type":file.type || "application/octet-stream","X-File-Name":encodeURIComponent(file.name)}, body:file });
            sourceFileId = uploadedSource.file.id;
          }
          const priorPages = existingDetail.pages || [];
          const batchPages = priorPages.filter(p => p.ocr_data?.batch_file_hash === fileHash && Number.isInteger(Number(p.ocr_data?.batch_index)));
          const maxPageNumber = priorPages.reduce((max,p)=>Math.max(max,Number(p.page_number)||0),0);
          const batchStartNumber = batchPages.length ? Math.min(...batchPages.map(p => Number(p.page_number)-Number(p.ocr_data.batch_index))) : maxPageNumber + 1;
          const completedKeys = new Set(priorPages.map(p => p.ocr_data?.batch_key).filter(Boolean));
          window.__almoraBatchTotal=pageCount;
          for(let i=0;i<pageCount;i++){
            window.__almoraBatchPage=i;
            const currentPage = await getPage(i);
            const batchKey = await sha256Hex(fileHash + "|" + i + "|" + currentPage.name);
            if (completedKeys.has(batchKey)) { showProgress(progress,"Página já processada",((i+1)/pageCount)*100,"Página "+(i+1)+" de "+pageCount+" — preservada, sem duplicação"); continue; }
            showProgress(progress,"Reconhecendo texto",((i)/pageCount)*100,"OCR · página "+(i+1)+" de "+pageCount);
            const ocr = await recognizePageWithRetry(worker, currentPage.blob);
            const source = ocr.text;
            let translatedCandidate = "";
            let translatedText = "";
            let translationWarning = "";
            if (source && ocr.reliable) {
              translatedCandidate = await translateLongText(card.dataset.project, source.slice(0,24000), project?.source_language || "en", "", (part,total) => { showProgress(progress,"Traduzindo página "+(i+1)+"/"+pageCount,((i+0.4+0.35*(part/total))/pageCount)*100,"Trecho "+part+" de "+total); });
              if (normalizeForComparison(translatedCandidate) === normalizeForComparison(source)) {
                translationWarning = "A IA devolveu o texto sem traduzir; precisa de revisão.";
              } else translatedText = translatedCandidate;
            } else if (source) {
              translationWarning = "OCR suspeito mesmo após uma segunda leitura; tradução automática bloqueada para evitar uma tradução incorreta.";
            } else {
              translationWarning = "Nenhum texto foi reconhecido; página precisa de revisão.";
            }
            showProgress(progress,"Salvando página "+(i+1)+"/"+pageCount,((i+0.82)/pageCount)*100,"Enviando imagem original e dados da tradução");
            const pageImage=await loadImage(await readDataUrl(currentPage.blob));
            const scale=Math.min(1,1800/Math.max(pageImage.width,pageImage.height));
            const pageCanvas=document.createElement("canvas");
            pageCanvas.width=Math.max(1,Math.round(pageImage.width*scale));
            pageCanvas.height=Math.max(1,Math.round(pageImage.height*scale));
            pageCanvas.getContext("2d").drawImage(pageImage,0,0,pageCanvas.width,pageCanvas.height);
            let imageBlob = await new Promise(resolve => pageCanvas.toBlob(resolve, "image/jpeg", 0.84));
            if (!imageBlob) throw new Error("Não foi possível preparar a página " + (i+1) + ".");
            if (imageBlob.size > 7 * 1024 * 1024) imageBlob = await new Promise(resolve => pageCanvas.toBlob(resolve, "image/jpeg", 0.62));
            pageCanvas.width=0; pageCanvas.height=0;
            if (!imageBlob || imageBlob.size > 8 * 1024 * 1024) throw new Error("A página " + (i+1) + " excede o limite de armazenamento.");
            const imageData = await blobDataUrl(imageBlob);
            const saved=await api("/api/projects/"+card.dataset.project+"/pages",{
              method:"POST",headers:{"Content-Type":"application/json"},
              body:JSON.stringify({
                page_number:batchStartNumber+i,
                source_file_id:sourceFileId,
                batch_key:batchKey,
                batch_file_hash:fileHash,
                batch_index:i,
                batch_start_number:batchStartNumber,
                original_name:currentPage.name.replace(/\.[^.]+$/,"")+".jpg",
                mime_type:"image/jpeg", image_b64:imageData,
                ocr_text:source, translated_text:translatedText,
                translation_candidate:translatedCandidate,
                ocr_quality:{confidence:ocr.confidence,score:ocr.score,reliable:ocr.reliable,attempts:ocr.attempts,meaningful_ratio:ocr.meaningful_ratio,symbol_ratio:ocr.symbol_ratio,words:ocr.words},
                translation_warning:translationWarning,
                translation_model:translatedText ? "Cloudflare Workers AI" : ""
              })
            });
            results.push("PÁGINA "+(i+1)+" — "+currentPage.name+" · guardada como página "+saved.page_number+
              "\nTEXTO RECONHECIDO:\n"+(source||"Nenhum texto reconhecido.")+
              (translatedText?"\n\nTRADUÇÃO:\n"+translatedText:
                "\n\nTRADUÇÃO: NÃO VALIDADA\n"+(translatedCandidate||"Não gerada.")+
                (translationWarning?"\nAVISO: "+translationWarning:""))+
              "\nOCR: "+(ocr.reliable?"confiável":"revisão necessária")+" · confiança "+(ocr.confidence===null?"indisponível":ocr.confidence+"%")+" · "+ocr.attempts+" tentativa(s));
          }
          const report=results.join("\n\n"+ "─".repeat(32)+"\n\n");
          const blob=new Blob([report],{type:"text/plain;charset=utf-8"});
          const url=URL.createObjectURL(blob);
          const reportMarkup='<a class="download-result" download="'+esc(file.name.replace(/\.[^.]+$/,""))+'-traduzido.txt" href="'+url+'">Baixar OCR + traduções (.txt)</a><pre class="batch-report">'+esc(report)+'</pre>';
          const completionMessage="Concluído · "+pageCount+" página(s) analisadas; as páginas já salvas foram preservadas sem duplicação. Revise OCR e traduções antes do lettering.";
          output.innerHTML=reportMarkup;
          showProgress(progress,"Lote concluído",100,pageCount+" página(s) analisadas. Páginas existentes preservadas sem duplicação.");
          notice("Lote concluído. O relatório foi gerado e o arquivo original ficou preservado.");
          const projectId=card.dataset.project;
          await refresh();
          const refreshedCard=document.querySelector('.project[data-project="'+projectId+'"]');
          if(refreshedCard){ refreshedCard.querySelector("[data-batch-output]").innerHTML=reportMarkup; showProgress(refreshedCard.querySelector(".batch-progress"),"Lote concluído",100,pageCount+" página(s) analisadas. Páginas existentes preservadas sem duplicação."); }
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
        if (file.size > 80 * 1024 * 1024) {
          notice("A página deve ter no máximo 80 MiB.", true);
          input.value = "";
          editor.hidden = true;
          return;
        }
        try {
          const image = await loadImageFile(file);
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
          const savedMask = await window.ALMORADrafts?.loadData("mask", card.dataset.project);
          if (savedMask) {
            const savedImage = await loadImage(savedMask);
            maskContext.drawImage(savedImage, 0, 0, maskCanvas.width, maskCanvas.height);
          }
          const overlayContext = overlay.getContext("2d");
          if (savedMask) {
            overlayContext.drawImage(maskCanvas, 0, 0);
            overlayContext.globalCompositeOperation = "source-in";
            overlayContext.fillStyle = "rgba(255,55,105,.58)";
            overlayContext.fillRect(0, 0, overlay.width, overlay.height);
            overlayContext.globalCompositeOperation = "source-over";
          }
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
          overlay.onpointerup = overlay.onpointercancel = () => {
            drawing = false; previous = null;
            window.ALMORADrafts?.saveData("mask", maskCanvas.toDataURL("image/png"), card.dataset.project);
          };
          card.querySelector(".clear-mask").onclick = () => {
            maskContext.fillStyle = "#000";
            maskContext.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
            overlayContext.clearRect(0, 0, overlay.width, overlay.height);
            window.ALMORADrafts?.removeData("mask", card.dataset.project);
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
        if (file.size > 80 * 1024 * 1024) {
          notice("A página para lettering deve ter no máximo 80 MiB.", true);
          input.value = "";
          return;
        }
        try {
          const image = await loadImageFile(file);
          if (image.width > 4096 || image.height > 4096) throw new Error("A página deve ter até 4.096 pixels por lado.");
          const canvas = card.querySelector(".letter-canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          card._letterBase = image;
          card._letterBlocks = await window.ALMORADrafts?.loadData("letter-blocks", card.dataset.project) || [];
          canvas.onclick = event => {
            const text = card.querySelector(".letter-text").value.trim();
            if (!text) return notice("Digite a fala antes de tocar no balão.", true);
            const rect = canvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) * canvas.width / rect.width;
            const y = (event.clientY - rect.top) * canvas.height / rect.height;
            card._letterBlocks.push({ text, x, y });
            window.ALMORADrafts?.saveData("letter-blocks", card._letterBlocks, card.dataset.project);
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
        window.ALMORADrafts?.removeData("letter-blocks", card.dataset.project);
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
        if (original.size > 80 * 1024 * 1024) return notice("A página deve ter no máximo 80 MiB.", true);
        button.disabled = true;
        showProgress(output,"Preparando reconstrução",null,"A IA está processando a imagem. O servidor não fornece porcentagem real nesta etapa.");
        try {
          if (API_BASE.includes("YOUR_SUBDOMAIN")) throw new Error("A API do Translate ainda não foi publicada.");
          const image = await loadImageFile(original);
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
          showProgress(output,"Enviando imagem para a IA",null,"Aguarde a geração do resultado.");
          const result = await fetch(API_BASE.replace(/\/$/, "") + "/api/projects/" + card.dataset.project + "/reconstruct", {
            method: "POST",
            headers: { "Authorization": "Bearer " + session.access_token, "Content-Type": "application/json" },
            body: JSON.stringify({ image_b64: refImage.toDataURL("image/png"), mask, width: image.width, height: image.height })
          });
          if (!result.ok) {
            const error = await result.json().catch(() => ({}));
            throw new Error(error.error || "Falha na edição da imagem.");
          }
          showProgress(output,"Recebendo e montando resultado",92,"Compondo a edição sobre a imagem original.");
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

  function loadImageFile(file) {
    const url = URL.createObjectURL(file);
    return loadImage(url).finally(() => URL.revokeObjectURL(url));
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

  async function createReviewPackage(button) {
    const card=button.closest(".project"), progress=card.querySelector(".package-progress");
    button.disabled=true;
    try {
      const detail=await api("/api/projects/"+card.dataset.project);
      const project=detail.project;
      const pages=[...(detail.pages||[])].sort((a,b)=>Number(a.page_number)-Number(b.page_number));
      if(!pages.length)throw new Error("Processe pelo menos uma página antes de gerar o pacote.");
      if(!window.JSZip)throw new Error("A biblioteca ZIP não carregou. Atualize a página.");
      const zip=new JSZip(), manifest=["ALMORA TRANSLATE — PACOTE DE REVISÃO","Projeto: "+project.title,"Este pacote contém imagens originais e traduções separadas para revisão. Não é uma edição final pronta para publicação.",""];
      for(let i=0;i<pages.length;i++){
        const page=pages[i],o=page.ocr_data||{}; showProgress(progress,"Montando pacote de revisão",((i)/pages.length)*85,"Página "+(i+1)+" de "+pages.length);
        const blob=await apiBlob("/api/projects/"+card.dataset.project+"/pages/"+page.id+"/image");
        const ext=({"image/png":"png","image/webp":"webp"})[o.mime_type]||"jpg", number=String(page.page_number).padStart(3,"0");
        zip.file("paginas/"+number+"-original."+ext,blob);
        zip.file("traducoes/"+number+".txt","PÁGINA "+page.page_number+"\n\nTEXTO ORIGINAL\n"+(o.source_text||"")+"\n\nTRADUÇÃO PT-BR\n"+(o.translated_text||"Sem tradução.")+"\n");
        manifest.push("Página "+page.page_number+": "+(o.translated_text?"traduzida":"sem tradução"));
      }
      zip.file("LEIA-ME.txt",manifest.join(String.fromCharCode(10)));
      showProgress(progress,"Compactando pacote",88,"Preparando o arquivo ZIP");
      const archive=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}},meta=>showProgress(progress,"Compactando pacote",88+(meta.percent||0)*0.10,"Compactação do arquivo"));
      if(archive.size>80*1024*1024)throw new Error("O pacote ultrapassa 80 MiB. Divida a obra em lotes menores.");
      const result=await api("/api/projects/"+card.dataset.project+"/versions",{method:"POST",headers:{"Content-Type":"application/zip","X-Output-Format":"zip"},body:archive});
      showProgress(progress,"Pacote de revisão salvo",100,"Versão "+result.version.version_number+" armazenada com segurança.");
      notice("Pacote de revisão criado. Os originais e as traduções estão em arquivos separados."); await refresh();
    } catch(error){progress.textContent="";notice(error.message,true);} finally{button.disabled=false;}
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
        showProgress(list,"Enviando arquivo",null,file.name+" · "+bytes(file.size));
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
    const button = event.submitter || $("projectForm").querySelector('button[type="submit"]');
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

  let authListenerReady = false;
  let authRefreshRunning = false;
  let hasConfirmedSession = false;
  let projectsLoadedForUser = null;

  async function applySession(nextSession, explicitSignOut = false) {
    if (!nextSession) {
      // Uma leitura transitória vazia não pode desfazer uma sessão já confirmada.
      if (hasConfirmedSession && !explicitSignOut) return;
      session = null;
      hasConfirmedSession = false;
      projectsLoadedForUser = null;
      $("app").hidden = false;
      notice("Entre na ALMORA e toque em “Verificar login” para carregar seus projetos.");
      return;
    }
    session = nextSession;
    hasConfirmedSession = true;
    $("app").hidden = false;
    const userId = nextSession.user?.id || null;
    // Returning from the native file picker fires focus/visibility events.
    // Do not replace the project cards with a loading placeholder on those events.
    // Load the project list only once per authenticated user; explicit actions
    // such as upload/create/delete continue to call refresh() when needed.
    // Confirma o login imediatamente. A consulta de projetos roda em segundo
    // plano para que uma falha de API nunca deixe a tela presa na verificação.
    notice("Você está conectado à ALMORA.");
    if (!authRefreshRunning && userId && projectsLoadedForUser !== userId) {
      authRefreshRunning = true;
      void refresh().then(() => {
        projectsLoadedForUser = userId;
      }).catch(error => {
        $("projects").textContent = error.message || "Não foi possível carregar os projetos.";
      }).finally(() => {
        authRefreshRunning = false;
      });
    }
  }

  let authInitPromise = null;
  async function init() {
    if (authInitPromise) return authInitPromise;
    authInitPromise = (async () => {
      if (!authListenerReady) {
        supabase.auth.onAuthStateChange((event, nextSession) => {
          // O callback roda sob o lock interno do Auth. Adie qualquer trabalho
          // que possa chamar getSession/refresh para evitar deadlock.
          if (event === "INITIAL_SESSION") return;
          if (!nextSession && event !== "SIGNED_OUT") return;
          window.setTimeout(() => {
            void applySession(nextSession, event === "SIGNED_OUT").catch(error => {
              notice("Falha ao atualizar a sessão ALMORA: " + (error.message || "erro desconhecido") + ".", true);
            });
          }, 0);
        });
        authListenerReady = true;
      }
      try {
        const { data, error } = await withTimeout(supabase.auth.getSession(), "A verificação da sessão ALMORA");
        if (error) throw error;
        if (data.session) await applySession(data.session);
        else if (!hasConfirmedSession) await applySession(null);
      } catch (error) {
        notice("Não foi possível verificar sua sessão ALMORA: " + (error.message || "erro desconhecido") + ". Confira sua conexão e tente atualizar a página.", true);
      }
    })();
    try {
      return await authInitPromise;
    } finally {
      authInitPromise = null;
    }
  }

  $("refreshBtn").addEventListener("click", async () => {
    const button = $("refreshBtn");
    button.disabled = true;
    try {
      await withTimeout(init(), "A verificação da sessão ALMORA");
    } catch (error) {
      notice(error.message || "Não foi possível verificar o login.", true);
    } finally {
      button.disabled = false;
      button.textContent = "Verificar login";
    }
  });
  // Uma única inicialização ao abrir a página. Eventos de foco/visibilidade
  // disparavam leituras concorrentes do Auth em navegadores móveis.
  init();
})();