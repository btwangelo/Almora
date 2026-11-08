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
          '<section class="engine-panel"><h4>Reconstrução de imagem · teste</h4><p>Envie a página e uma máscara PNG do mesmo tamanho. Áreas brancas na máscara serão reconstruídas.</p><label>Página original <input class="rebuild-image" type="file" accept="image/png,image/jpeg,image/webp"></label><label>Máscara PNG <input class="rebuild-mask" type="file" accept="image/png"></label><button class="small-button reconstruct-image">Reconstruir área marcada</button><div class="engine-output" data-reconstruction-output></div></section>' : '') +
        '<div class="file-list" data-file-list>'
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
    document.querySelectorAll(".project .reconstruct-image").forEach(button => {
      button.addEventListener("click", async () => {
        const card = button.closest(".project");
        const original = card.querySelector(".rebuild-image").files[0];
        const maskFile = card.querySelector(".rebuild-mask").files[0];
        const output = card.querySelector("[data-reconstruction-output]");
        if (!original || !maskFile) return notice("Selecione a página original e a máscara PNG.", true);
        if (original.size > 5 * 1024 * 1024 || maskFile.size > 5 * 1024 * 1024) return notice("Cada imagem deve ter no máximo 5 MiB.", true);
        button.disabled = true;
        output.textContent = "Reconstruindo…";
        try {
          const dataUrl = await readDataUrl(original);
          const maskUrl = await readDataUrl(maskFile);
          const image = await loadImage(dataUrl);
          const maskImage = await loadImage(maskUrl);
          if (image.width !== maskImage.width || image.height !== maskImage.height) throw new Error("A máscara precisa ter exatamente as mesmas dimensões da página.");
          if (image.width > 2048 || image.height > 2048 || image.width < 256 || image.height < 256) throw new Error("Use uma página entre 256 e 2.048 pixels por lado.");
          const canvas = document.createElement("canvas");
          canvas.width = image.width; canvas.height = image.height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(maskImage, 0, 0);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const mask = new Array(canvas.width * canvas.height);
          for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
            mask[j] = Math.round((pixels[i] + pixels[i+1] + pixels[i+2]) / 3);
          }
          const result = await fetch(API_BASE.replace(/\/$/, "") + "/api/projects/" + card.dataset.project + "/reconstruct", {
            method: "POST",
            headers: { "Authorization": "Bearer " + session.access_token, "Content-Type": "application/json" },
            body: JSON.stringify({ image_b64: dataUrl, mask, width: image.width, height: image.height })
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
\n  async function uploadFiles(card) {
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