(() => {
  const SUPABASE_URL = "https://mcdinntggkanmsqubozn.supabase.co";
  const SUPABASE_KEY = "sb_publishable_dbymLTRkJyrohmyCjS6aPA_25sOAS61";
  const API_BASE = window.ALMORA_TRANSLATE_API || "https://almora-translate.YOUR_SUBDOMAIN.workers.dev";
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
    $("projects").innerHTML = projects.map(project => {
      const mayUpload = ["owner","admin","translator"].some(role => roles.includes(role)) &&
        (roles.includes("owner") || roles.includes("admin") || project.created_by === session.user.id || project.assigned_translator_id === session.user.id);
      return '<article class="project" data-project="' + esc(project.id) + '">' +
        '<div class="project-top"><div><h3>' + esc(project.title) + '</h3><div class="meta">' +
        esc(({en:"Inglês",ko:"Coreano",ja:"Japonês",zh:"Chinês"})[project.source_language] || project.source_language) +
        ' → Português brasileiro · Criado em ' + esc(date(project.created_at)) + '</div></div>' +
        '<span class="status">' + esc(labels[project.status] || project.status) + '</span></div>' +
        '<div class="meta" style="margin-top:10px">' + Number(project.total_pages || 0) + ' páginas · ' +
        Number(project.completed_pages || 0) + ' concluídas · ' + Number(project.failed_pages || 0) + ' com falha</div>' +
        (mayUpload ? '<div class="file-row"><input type="file" class="files" multiple accept=".zip,.cbz,.pdf,.png,.jpg,.jpeg,.webp"><button class="small-button upload">Enviar arquivos</button></div>' +
          '<section class="engine-panel"><h4>Motor de tradução · teste</h4><textarea class="source-text" rows="3" maxlength="6000" placeholder="Cole uma fala ou trecho para testar a tradução…"></textarea><button class="small-button translate-text">Traduzir para PT-BR</button><div class="engine-output" data-translation-output></div></section>' +
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

    document.querySelectorAll(".project .translate-text").forEach(button => {
      button.addEventListener("click", async () => {
        const card = button.closest(".project");
        const input = card.querySelector(".source-text");
        const output = card.querySelector("[data-translation-output]");
        const project = projects.find(item => item.id === card.dataset.project);
        if (!input.value.trim()) return notice("Cole o texto que deseja traduzir.", true);
        button.disabled = true;
        output.textContent = "Traduzindo…";
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
          notice("Tradução concluída pelo motor " + esc(result.model) + ".");
        } catch (error) {
          output.textContent = error.message;
          notice(error.message, true);
        } finally { button.disabled = false; }
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
          if (image.width > 2048 || image.height > 2048 || image.width < 256 || image.height < 256) {
            throw new Error("Use uma página entre 256 e 2.048 pixels por lado.");
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
        const translated = card.querySelector("[data-translation-output]").textContent.trim();
        if (!translated) return notice("Faça uma tradução primeiro.", true);
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
          const maskBlob = await new Promise(resolve => maskCanvas.toBlob(resolve, "image/png"));
          if (!maskBlob) throw new Error("Não foi possível preparar a máscara PNG.");
          const mask = Array.from(new Uint8Array(await maskBlob.arrayBuffer()));
          const result = await fetch(API_BASE.replace(/\/$/, "") + "/api/projects/" + card.dataset.project + "/reconstruct", {
            method: "POST",
            headers: { "Authorization": "Bearer " + session.access_token, "Content-Type": "application/json" },
            body: JSON.stringify({ image_b64: dataUrl, mask, width: maskCanvas.width, height: maskCanvas.height })
          });
          if (!result.ok) {
            const error = await result.json().catch(() => ({}));
            throw new Error(error.error || "Falha na reconstrução da imagem.");
          }
          const blob = await result.blob();
          const imageUrl = URL.createObjectURL(blob);
          output.innerHTML = '<img class="reconstruction-preview" alt="Imagem reconstruída" src="' + imageUrl + '"><a class="download-result" download="almora-reconstruida.png" href="' + imageUrl + '">Baixar resultado</a>';
          notice("Reconstrução concluída. Confira a imagem antes de utilizá-la.");
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