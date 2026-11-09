const DEFAULT_ORIGINS = [
  "https://btwangelo.github.io",
  "https://almoraverse.pages.dev"
];

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function response(data, status, origin, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { ...JSON_HEADERS, ...corsHeaders(origin, env) }
  });
}

function corsHeaders(origin, env) {
  const allowed = (env.CORS_ORIGINS || DEFAULT_ORIGINS.join(","))
    .split(",").map(x => x.trim()).filter(Boolean);
  const headers = {
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "Authorization,Content-Type,X-File-Name,X-Output-Format",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
  if (origin && allowed.includes(origin)) headers["access-control-allow-origin"] = origin;
  return headers;
}

function fail(message, status, origin, env, code) {
  return response({ error: message, code: code || "request_failed" }, status || 400, origin, env);
}

function safeName(name) {
  let decoded = String(name || "upload");
  try { decoded = decodeURIComponent(decoded); } catch (_) {}
  const leaf = decoded.split(/[\\/]/).pop();
  return leaf.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._() -]/g, "_").replace(/\s+/g, "_").slice(0, 140) || "upload";
}

function supabaseBase(env) {
  const raw = String(env.SUPABASE_URL || "").trim();
  if (!raw) throw new Error("SUPABASE_URL não configurada.");
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:") throw new Error("SUPABASE_URL precisa usar HTTPS.");
  parsed.pathname = parsed.pathname.replace(/\/(?:rest|auth)\/v1\/?$/i, "").replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.origin + parsed.pathname;
}

async function db(env, path, options) {
  const url = supabaseBase(env) + "/rest/v1/" + path;
  const headers = new Headers(options && options.headers || {});
  headers.set("apikey", env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set("authorization", "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY);
  if (!headers.has("content-type") && options && options.body) headers.set("content-type", "application/json");
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!res.ok) {
    const err = new Error((data && data.message) || ("Database request failed (" + res.status + ")"));
    err.status = res.status;
    throw err;
  }
  return data;
}

async function authenticate(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.match(/^Bearer\s+(.+)$/i);
  if (!token) return null;
  const authUrl = supabaseBase(env) + "/auth/v1/user";
  const headers = { "authorization": "Bearer " + token[1] };

  // Primeiro usa a chave pública configurada. Se ela estiver divergente das
  // chaves do projeto, tenta a chave secreta do próprio Worker (nunca exposta
  // ao navegador) para validar o mesmo token de usuário.
  let res = await fetch(authUrl, {
    headers: { ...headers, "apikey": env.SUPABASE_PUBLISHABLE_KEY }
  });
  if ((res.status === 401 || res.status === 403) &&
      env.SUPABASE_SERVICE_ROLE_KEY &&
      env.SUPABASE_SERVICE_ROLE_KEY !== env.SUPABASE_PUBLISHABLE_KEY) {
    res = await fetch(authUrl, {
      headers: { ...headers, "apikey": env.SUPABASE_SERVICE_ROLE_KEY }
    });
  }
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error("Supabase Auth respondeu HTTP " + res.status + ".");
  const user = await res.json();
  const roles = await db(env,
    "staff_roles?user_id=eq." + encodeURIComponent(user.id) + "&select=role_key"
  );
  return {
    user,
    roles: (roles || []).map(row => row.role_key),
    token: token[1]
  };
}

function isAdmin(auth) {
  return auth.roles.includes("owner") || auth.roles.includes("admin");
}
function isTranslator(auth) {
  return auth.roles.includes("translator") || isAdmin(auth);
}
function isEditor(auth) {
  return isAdmin(auth) || ["editor_bl", "editor_gl", "reviewer"].some(role => auth.roles.includes(role));
}
function canAccessTranslate(auth) {
  // A ferramenta aceita somente a equipe de tradução/editorial e a administração.
  // A autorização é validada no Worker, inclusive em acessos por URL direta.
  return isTranslator(auth) || isEditor(auth);
}
function canCreate(auth) {
  return isTranslator(auth);
}

async function getProject(env, id) {
  const rows = await db(env, "almora_translation_projects?id=eq." +
    encodeURIComponent(id) + "&select=*&limit=1");
  return rows && rows[0] || null;
}

function canReadProject(auth, project) {
  if (!project) return false;
  if (isAdmin(auth)) return true;
  if (project.created_by === auth.user.id || project.assigned_translator_id === auth.user.id) return true;
  return isEditor(auth) &&
    ["editorial_review", "changes_requested", "approved", "published"].includes(project.status);
}

async function encryptionKey(env) {
  if (!env.ALMORA_TRANSLATE_ENCRYPTION_KEY || env.ALMORA_TRANSLATE_ENCRYPTION_KEY.length < 32) {
    throw new Error("ALMORA_TRANSLATE_ENCRYPTION_KEY must contain at least 32 characters.");
  }
  const raw = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(env.ALMORA_TRANSLATE_ENCRYPTION_KEY)
  );
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encrypt(bytes, env) {
  const key = await encryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  const packed = new Uint8Array(12 + encrypted.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(encrypted), 12);
  return packed;
}

async function decrypt(bytes, env) {
  if (bytes.byteLength < 29) throw new Error("Encrypted object is invalid.");
  const key = await encryptionKey(env);
  const packed = new Uint8Array(bytes);
  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}

async function addEvent(env, projectId, actorId, eventType, details) {
  try {
    await db(env, "almora_translation_events", {
      method: "POST",
      headers: { "prefer": "return=minimal" },
      body: JSON.stringify({
        project_id: projectId,
        actor_id: actorId,
        event_type: eventType,
        details: details || {}
      })
    });
  } catch (_) {
    // An audit-event outage must not turn a successful upload into a retryable failure.
  }
}

function validFileSignature(extension, bytes) {
  const b = new Uint8Array(bytes);
  if (["zip", "cbz"].includes(extension)) {
    return b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b &&
      [0x03, 0x05, 0x07].includes(b[2]) && [0x04, 0x06, 0x08].includes(b[3]);
  }
  if (extension === "pdf") return new TextDecoder().decode(b.slice(0, 5)) === "%PDF-";
  if (extension === "png") return b.length >= 8 &&
    [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((v,i) => b[i] === v);
  if (["jpg", "jpeg"].includes(extension)) return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (extension === "webp") return b.length >= 12 &&
    new TextDecoder().decode(b.slice(0,4)) === "RIFF" &&
    new TextDecoder().decode(b.slice(8,12)) === "WEBP";
  return false;
}


function sourceLanguageName(code) {
  return ({ en: "inglês", ko: "coreano", ja: "japonês", zh: "chinês" })[code] || code;
}

async function translateWithAI(env, input) {
  if (!env.AI) throw new Error("O motor de IA ainda não está vinculado ao Worker.");
  const text = String(input.text || "").trim();
  const sourceLanguage = String(input.source_language || "").toLowerCase();
  if (!text || text.length > 6000) {
    const error = new Error("O texto deve ter entre 1 e 6.000 caracteres.");
    error.status = 400;
    throw error;
  }
  if (!["en", "ko", "ja", "zh"].includes(sourceLanguage)) {
    const error = new Error("Idioma de origem não suportado.");
    error.status = 400;
    throw error;
  }
  const glossary = Array.isArray(input.glossary)
    ? input.glossary.slice(0, 80).map(item => {
        const from = String(item.source || "").slice(0, 120);
        const to = String(item.target || "").slice(0, 120);
        return from && to ? from + " → " + to : "";
      }).filter(Boolean).join("\n")
    : "";
  const system = [
    "Você é tradutor literário especializado em mangá, manhwa e manhua.",
    "Traduza para português brasileiro natural, fluido e adequado a balões de quadrinhos.",
    "Preserve significado, intenção, subtexto, humor, sarcasmo, intimidade, relações e voz individual dos personagens.",
    "Não invente fatos, emoções, falas ou informações. Não intensifique declarações nem altere relações.",
    "Preserve nomes próprios e honoríficos quando forem narrativamente relevantes. Respeite o glossário.",
    "Considere o contexto narrativo fornecido, mas não acrescente explicações à fala.",
    "Responda somente com a tradução, sem aspas, comentários ou alternativas."
  ].join(" ");
  const user = [
    "Idioma original: " + sourceLanguageName(sourceLanguage) + ".",
    "Idioma final: português brasileiro.",
    input.context ? "Contexto da obra/personagem: " + String(input.context).slice(0, 5000) : "",
    glossary ? "Glossário obrigatório:\n" + glossary : "",
    "Texto a traduzir:\n" + text
  ].filter(Boolean).join("\n\n");
  const model = env.TRANSLATION_MODEL || "@cf/zai-org/glm-4.7-flash";
  const result = await env.AI.run(model, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.2,
    // Tradução não precisa de raciocínio longo; desativar thinking
    // reserva os tokens de saída para o texto traduzido.
    chat_template_kwargs: { enable_thinking: false },
    max_completion_tokens: Math.min(8192, Math.max(1024, text.length * 3))
  });
  const extractText = value => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      return value.map(part => {
        if (typeof part === "string") return part;
        return part && typeof part.text === "string" ? part.text : "";
      }).join("");
    }
    return "";
  };
  const candidates = [
    result && result.response,
    result && result.output_text,
    result && result.choices && result.choices[0] &&
      result.choices[0].message && result.choices[0].message.content,
    result && result.choices && result.choices[0] && result.choices[0].text,
    result && result.message && result.message.content
  ];
  const translated = candidates.map(extractText).find(value => value.trim())?.trim() || "";
  if (!translated) {
    const finishReason = result && result.choices && result.choices[0] &&
      result.choices[0].finish_reason;
    const error = new Error(
      finishReason === "length"
        ? "O modelo atingiu o limite de resposta antes de concluir a tradução. Tente dividir o texto."
        : "O provedor de IA respondeu, mas não enviou texto de tradução. Tente novamente."
    );
    error.status = 502;
    throw error;
  }
  return { translation: translated, model, source_language: sourceLanguage, target_language: "pt-BR" };
}

function decodeBase64(value) {
  const clean = String(value || "").replace(/^data:[^,]+,/, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function reconstructWithAI(env, input) {
  if (!env.AI) throw new Error("O motor de IA ainda não está vinculado ao Worker.");
  const image = String(input.image_b64 || "");
  const mask = input.mask;
  if (!image || image.length > 7 * 1024 * 1024 || !Array.isArray(mask) || mask.length < 8 || mask.length > 5 * 1024 * 1024) {
    const error = new Error("Imagem ou máscara inválida. Limite de entrada: 5 MiB por imagem.");
    error.status = 400;
    throw error;
  }
  if (mask.some(value => !Number.isInteger(value) || value < 0 || value > 255)) {
    const error = new Error("A máscara contém bytes inválidos.");
    error.status = 400;
    throw error;
  }
  if (mask[0] !== 0x89 || mask[1] !== 0x50 || mask[2] !== 0x4e || mask[3] !== 0x47) {
    const error = new Error("A máscara precisa ser uma imagem PNG.");
    error.status = 400;
    throw error;
  }
  const width = Number(input.width);
  const height = Number(input.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 256 || height < 256 || width > 1920 || height > 1920 || width * height > 3_686_400) {
    const error = new Error("Dimensões inválidas. Use imagens entre 256 e 1.920 pixels por lado.");
    error.status = 400;
    throw error;
  }
  const imageBytes = decodeBase64(image);
  const maskBytes = new Uint8Array(mask);
  const imageMime = /^data:(image\/(?:png|jpeg|webp));base64,/i.exec(image)?.[1] || "image/png";
  const form = new FormData();
  form.append("prompt", String(input.prompt ||
    "Image 0 is the original comic page. Image 1 is a black-and-white edit guide: white painted regions identify the ONLY areas that may be reconstructed. Remove lettering and restore the underlying original speech-bubble interior or artwork in those white areas. Preserve the exact manga/manhwa drawing style, line art, colors, characters, panel layout and composition. Do not add text, letters, symbols, objects or characters. Keep everything outside the marked regions unchanged.").slice(0, 1800));
  form.append("input_image_0", new Blob([imageBytes], { type: imageMime }), "original.png");
  form.append("input_image_1", new Blob([maskBytes], { type: "image/png" }), "edit-guide.png");
  form.append("width", String(width));
  form.append("height", String(height));
  form.append("guidance", "3.5");
  const serialized = new Response(form);
  const model = env.IMAGE_EDIT_MODEL || "@cf/black-forest-labs/flux-2-klein-4b";
  const result = await env.AI.run(model, {
    multipart: {
      body: serialized.body,
      contentType: serialized.headers.get("content-type")
    }
  });
  if (!result || !result.image) throw new Error("O modelo de edição não retornou uma imagem.");
  return decodeBase64(result.image);
}

async function handle(request, env) {
  const origin = request.headers.get("origin") || "";
  const cors = corsHeaders(origin, env);

  if (request.method === "OPTIONS") {
    if (origin && !cors["access-control-allow-origin"]) {
      return new Response(null, { status: 403, headers: cors });
    }
    return new Response(null, { status: 204, headers: cors });
  }

  if (origin && !cors["access-control-allow-origin"]) {
    return fail("Origem não autorizada.", 403, origin, env, "origin_denied");
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "GET" && path === "/api/health") {
    const config = {
      supabaseUrl: Boolean(env.SUPABASE_URL), publishableKey: Boolean(env.SUPABASE_PUBLISHABLE_KEY),
      serviceKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY), r2: Boolean(env.ALMORA_BUCKET),
      ai: Boolean(env.AI), encryptionKey: Boolean(env.ALMORA_TRANSLATE_ENCRYPTION_KEY && env.ALMORA_TRANSLATE_ENCRYPTION_KEY.length >= 32)
    };
    let database = false;
    if (config.supabaseUrl && config.serviceKey) {
      try { await db(env, "staff_roles?select=user_id&limit=1"); database = true; } catch (_) {}
    }
    let r2Access = false;
    if (config.r2) {
      try { await env.ALMORA_BUCKET.list({ limit: 1 }); r2Access = true; } catch (_) {}
    }
    const ready = Object.values(config).every(Boolean) && database && r2Access;
    return response({
      service: "ALMORA Translate",
      status: ready ? "ready" : "degraded",
      stage: "provider-prototype",
      checks: { ...config, database, r2Access },
      providers: {
        translation: { available: Boolean(env.AI), model: env.TRANSLATION_MODEL || "@cf/zai-org/glm-4.7-flash" },
        reconstruction: {
          available: Boolean(env.AI),
          model: env.IMAGE_EDIT_MODEL || "@cf/black-forest-labs/flux-2-klein-4b",
          experimental: true,
          mode: "image-editing-with-reference-mask-guide",
          notice: "Edição por imagem de referência; a máscara é enviada como guia visual e a composição final limita a alteração às áreas pintadas."
        }
      }
    }, ready ? 200 : 503, origin, env);
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY || !env.ALMORA_BUCKET || !env.ALMORA_TRANSLATE_ENCRYPTION_KEY) {
    return fail("O servidor ainda não foi configurado. Verifique as variáveis e o vínculo R2.", 503, origin, env, "server_not_configured");
  }

  let auth;
  try { auth = await authenticate(request, env); }
  catch (error) { return fail("Não foi possível validar a sessão.", 502, origin, env, "auth_unavailable"); }
  if (!auth) return fail("Entre na sua conta ALMORA para continuar.", 401, origin, env, "authentication_required");

  if (!canAccessTranslate(auth)) {
    return fail("O ALMORA Translate é restrito à equipe de tradução, edição, revisão e administração.", 403, origin, env, "role_required");
  }

  try {
    if (request.method === "GET" && path === "/api/projects") {
      let query = "almora_translation_projects?select=*,almora_translation_files(*),almora_translation_pages(*),almora_translation_versions(*)&order=created_at.desc&almora_translation_files.order=created_at.asc&almora_translation_pages.order=page_number.asc&almora_translation_versions.order=version_number.desc";
      if (!isAdmin(auth)) {
        const filters = ["created_by.eq." + auth.user.id, "assigned_translator_id.eq." + auth.user.id];
        if (isEditor(auth)) filters.push("status.in.(editorial_review,changes_requested,approved,published)");
        query += "&or=(" + filters.join(",") + ")";
      }
      const projects = await db(env, query);
      return response({ projects: projects || [], roles: auth.roles }, 200, origin, env);
    }

    if (request.method === "POST" && path === "/api/projects") {
      if (!canCreate(auth)) return fail("Apenas tradutores autorizados e administradores podem criar projetos.", 403, origin, env);
      const body = await request.json();
      const title = String(body.title || "").trim();
      const sourceLanguage = String(body.source_language || "").trim().toLowerCase();
      if (!title || title.length > 240) return fail("Informe um título com até 240 caracteres.", 400, origin, env);
      if (!["en", "ko", "ja", "zh"].includes(sourceLanguage)) return fail("Idioma de origem não suportado nesta primeira versão.", 400, origin, env);
      if (body.rights_confirmed !== true) return fail("Confirme que possui autorização para traduzir e utilizar os arquivos.", 400, origin, env);
      const created = await db(env, "almora_translation_projects", {
        method: "POST",
        headers: { "prefer": "return=representation" },
        body: JSON.stringify({
          created_by: auth.user.id,
          title,
          source_language: sourceLanguage,
          target_language: "pt-BR",
          translation_style: "adaptive",
          status: "pending_upload",
          rights_confirmed: true,
          narrative_context: String(body.narrative_context || "").slice(0, 12000)
        })
      });
      const project = created && created[0];
      if (!project) return fail("O projeto não foi criado.", 502, origin, env);
      await addEvent(env, project.id, auth.user.id, "project_created", { source_language: sourceLanguage });
      return response({ project }, 201, origin, env);
    }

    const projectMatch = path.match(/^\/api\/projects\/([0-9a-f-]{36})(?:\/(.*))?$/i);
    if (projectMatch) {
      const projectId = projectMatch[1];
      const action = projectMatch[2] || "";
      const project = await getProject(env, projectId);
      if (!canReadProject(auth, project)) return fail("Projeto não encontrado ou sem permissão.", 404, origin, env);


      if (request.method === "DELETE" && !action) {
        if (!isAdmin(auth) && project.created_by !== auth.user.id) {
          return fail("Somente quem criou o projeto ou a administração pode apagá-lo.", 403, origin, env);
        }

        // Remove primeiro todos os objetos privados associados ao projeto.
        // A chave do projeto é isolada pelo prefixo, sem tocar em outras obras.
        const prefix = "translate/" + projectId + "/";
        let cursor;
        do {
          const listed = await env.ALMORA_BUCKET.list({ prefix, cursor, limit: 1000 });
          const keys = (listed.objects || []).map(object => object.key);
          if (keys.length) await env.ALMORA_BUCKET.delete(keys);
          cursor = listed.truncated ? listed.cursor : undefined;
        } while (cursor);

        // As relações filhas usam ON DELETE CASCADE no banco.
        await db(env, "almora_translation_projects?id=eq." + projectId, {
          method: "DELETE",
          headers: { "prefer": "return=minimal" }
        });
        return response({ success: true, deleted: true }, 200, origin, env);
      }

      if (request.method === "POST" && action === "review") {
        const input = await request.json().catch(() => ({}));
        const decision = String(input.decision || "");
        const notes = String(input.notes || "").trim().slice(0, 4000);
        let nextStatus = "";
        let reviewType = "";
        if (decision === "submitted") {
          if (!isTranslator(auth) || ![project.created_by, project.assigned_translator_id].includes(auth.user.id) && !isAdmin(auth)) {
            return fail("Somente o responsável pela tradução pode enviá-la para revisão.", 403, origin, env);
          }
          if (!["uploaded", "translator_review", "changes_requested"].includes(project.status)) {
            return fail("Este projeto ainda não está pronto para revisão do tradutor.", 409, origin, env);
          }
          const pageRows = await db(env, "almora_translation_pages?project_id=eq." + projectId + "&select=id,ocr_data");
          const readablePages = (pageRows || []).filter(page => String(page.ocr_data?.source_text || "").trim());
          const translatedPages = readablePages.filter(page => String(page.ocr_data?.translated_text || "").trim());
          if (!pageRows?.length || !readablePages.length || translatedPages.length !== readablePages.length) {
            return fail("Antes da revisão, processe as páginas e conclua a tradução de todo texto reconhecido.", 409, origin, env, "translation_incomplete");
          }
          const versions = await db(env, "almora_translation_versions?project_id=eq." + projectId + "&status=eq.draft&select=id,status&order=version_number.desc&limit=1");
          if (!versions?.length) return fail("Gere um novo pacote de revisão depois das últimas alterações.", 409, origin, env, "review_package_required");
          nextStatus = "editorial_review";
          reviewType = "translator";
          await db(env, "almora_translation_versions?id=eq." + versions[0].id, { method: "PATCH", headers: { "prefer": "return=minimal" }, body: JSON.stringify({ status: "editorial_review" }) });
        } else if (decision === "approved" || decision === "changes_requested") {
          if (!isEditor(auth)) return fail("Somente a equipe editorial pode avaliar este projeto.", 403, origin, env);
          if (project.status !== "editorial_review") return fail("O projeto não está aguardando revisão editorial.", 409, origin, env);
          nextStatus = decision;
          reviewType = "editorial";
        } else {
          return fail("Decisão de revisão inválida.", 400, origin, env);
        }
        await db(env, "almora_translation_reviews", {
          method: "POST",
          headers: { "prefer": "return=minimal" },
          body: JSON.stringify({
            project_id: projectId,
            reviewer_id: auth.user.id,
            review_type: reviewType,
            decision,
            notes: notes || null
          })
        });
        const patch = { status: nextStatus, updated_at: new Date().toISOString() };
        if (decision === "submitted") patch.submitted_at = new Date().toISOString();
        if (decision === "approved" || decision === "changes_requested") {
          const versions = await db(env, "almora_translation_versions?project_id=eq." + projectId + "&select=id,status&order=version_number.desc&limit=1");
          if (versions?.[0]) await db(env, "almora_translation_versions?id=eq." + versions[0].id, {
            method: "PATCH", headers: { "prefer": "return=minimal" },
            body: JSON.stringify(decision === "approved" ? { status: "approved", approved_by: auth.user.id, approved_at: new Date().toISOString() } : { status: "superseded" })
          });
          if (decision === "approved") patch.approved_at = new Date().toISOString();
        }
        await db(env, "almora_translation_projects?id=eq." + projectId, {
          method: "PATCH",
          headers: { "prefer": "return=minimal" },
          body: JSON.stringify(patch)
        });
        await addEvent(env, projectId, auth.user.id, "review_" + decision, { notes });
        return response({ success: true, status: nextStatus }, 200, origin, env);
      }

      if (request.method === "POST" && action === "translate") {
        if (!isTranslator(auth)) return fail("Apenas tradutores autorizados e administradores podem usar o motor de tradução.", 403, origin, env);
        const input = await request.json();
        const result = await translateWithAI(env, {
          ...input,
          source_language: input.source_language || project.source_language,
          context: [project.narrative_context || "", input.context || ""].filter(Boolean).join("\n\n")
        });
        await addEvent(env, projectId, auth.user.id, "text_translated", {
          model: result.model,
          source_language: result.source_language,
          input_characters: String(input.text || "").length
        });
        return response(result, 200, origin, env);
      }

      if (request.method === "POST" && action === "pages") {
        if (["editorial_review", "approved", "published"].includes(project.status)) return fail("As páginas estão bloqueadas enquanto o projeto aguarda ou concluiu a revisão.", 409, origin, env, "project_locked");
        if (!isTranslator(auth) || (!isAdmin(auth) && project.created_by !== auth.user.id && project.assigned_translator_id !== auth.user.id)) {
          return fail("Somente o responsável pela tradução pode salvar páginas.", 403, origin, env);
        }
        const input = await request.json();
        const pageNumber = Number(input.page_number);
        const originalName = safeName(input.original_name || ("pagina-" + pageNumber + ".jpg"));
        const extension = (originalName.split(".").pop() || "").toLowerCase();
        const mime = String(input.mime_type || "image/jpeg").toLowerCase();
        const allowedMime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
        if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 10000 ||
            !allowedMime[extension] || allowedMime[extension] !== mime) {
          return fail("Número, formato ou tipo de página inválido.", 400, origin, env);
        }
        let sourceFileId = null;
        if (input.source_file_id) {
          const sourceFiles = await db(env, "almora_translation_files?id=eq." + encodeURIComponent(String(input.source_file_id)) + "&project_id=eq." + projectId + "&select=id&limit=1");
          if (!sourceFiles?.length) return fail("O arquivo de origem não pertence a este projeto.", 400, origin, env);
          sourceFileId = sourceFiles[0].id;
        }
        const sourceText = String(input.ocr_text || "").slice(0, 24000);
        const translatedText = String(input.translated_text || "").slice(0, 24000);
        const imageBytes = decodeBase64(input.image_b64 || "");
        if (!imageBytes.byteLength || imageBytes.byteLength > 8 * 1024 * 1024 ||
            !validFileSignature(extension, imageBytes)) {
          return fail("A imagem da página é inválida ou excede 8 MiB.", 413, origin, env);
        }
        const existing = await db(env, "almora_translation_pages?project_id=eq." + projectId +
          "&page_number=eq." + pageNumber + "&select=id,original_object_key&limit=1");
        const pageId = existing?.[0]?.id || crypto.randomUUID();
        const objectKey = "translate/" + projectId + "/pages/" + pageId + "/original-" + crypto.randomUUID() + "." + extension;
        const encrypted = await encrypt(imageBytes, env);
        await env.ALMORA_BUCKET.put(objectKey, encrypted, {
          httpMetadata: { contentType: "application/octet-stream", cacheControl: "private, no-store" },
          customMetadata: { almoraTranslate: "encrypted-v1", pageId }
        });
        const row = {
          id: pageId, project_id: projectId, source_file_id: sourceFileId, page_number: pageNumber,
          original_object_key: objectKey, status: "needs_attention",
          detected_language: project.source_language,
          ocr_data: {
            source_text: sourceText, translated_text: translatedText,
            original_name: originalName, mime_type: mime, ocr_engine: "tesseract.js",
            batch_key: input.batch_key ? String(input.batch_key).slice(0, 128) : null,
            batch_file_hash: input.batch_file_hash ? String(input.batch_file_hash).slice(0, 64) : null,
            batch_index: Number.isInteger(Number(input.batch_index)) ? Number(input.batch_index) : null,
            batch_start_number: Number.isInteger(Number(input.batch_start_number)) ? Number(input.batch_start_number) : null,
            translation_model: input.translation_model ? String(input.translation_model).slice(0, 160) : null,
            lettering_layout: input.lettering_layout && typeof input.lettering_layout === "object" ? input.lettering_layout : null
          },
          updated_at: new Date().toISOString()
        };
        try {
          await db(env, "almora_translation_pages?on_conflict=project_id,page_number", {
            method: "POST",
            headers: { "prefer": "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify(row)
          });
        } catch (error) {
          await env.ALMORA_BUCKET.delete(objectKey);
          throw error;
        }
        await db(env, "almora_translation_versions?project_id=eq." + projectId + "&status=eq.draft", { method: "PATCH", headers: { "prefer": "return=minimal" }, body: JSON.stringify({ status: "superseded" }) });
        const allPages = await db(env, "almora_translation_pages?project_id=eq." + projectId + "&select=id,ocr_data");
        const completedPages = (allPages || []).filter(page => String(page.ocr_data?.translated_text || "").trim()).length;
        await db(env, "almora_translation_projects?id=eq." + projectId, {
          method: "PATCH", headers: { "prefer": "return=minimal" },
          body: JSON.stringify({ total_pages: (allPages || []).length, completed_pages: completedPages, status: project.status === "pending_upload" ? "uploaded" : project.status, updated_at: new Date().toISOString() })
        });
        if (existing?.[0]?.original_object_key && existing[0].original_object_key !== objectKey) {
          await env.ALMORA_BUCKET.delete(existing[0].original_object_key);
        }
        await addEvent(env, projectId, auth.user.id, "page_ocr_saved", {
          page_id: pageId, page_number: pageNumber, image_bytes: imageBytes.byteLength,
          source_characters: sourceText.length, translated_characters: translatedText.length
        });
        return response({ success: true, page_id: pageId, page_number: pageNumber, status: "needs_attention" }, 201, origin, env);
      }

      if (request.method === "POST" && action === "reconstruct") {
        if (!isTranslator(auth)) return fail("Apenas tradutores autorizados e administradores podem reconstruir imagens.", 403, origin, env);
        const declared = Number(request.headers.get("content-length") || 0);
        if (declared > 30 * 1024 * 1024) return fail("A solicitação excede o limite de 30 MiB.", 413, origin, env);
        const input = await request.json();
        const imageBytes = await reconstructWithAI(env, input);
        await addEvent(env, projectId, auth.user.id, "image_reconstructed", {
          model: env.IMAGE_EDIT_MODEL || "@cf/black-forest-labs/flux-2-klein-4b",
          width: Number(input.width),
          height: Number(input.height)
        });
        return new Response(imageBytes, {
          status: 200,
          headers: {
            ...cors,
            "content-type": "image/png",
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff"
          }
        });
      }

      if (request.method === "GET" && !action) {
        const [files, pages, jobs, versions, reviews, events] = await Promise.all([
          db(env, "almora_translation_files?project_id=eq." + projectId + "&select=*&order=created_at.asc"),
          db(env, "almora_translation_pages?project_id=eq." + projectId + "&select=*&order=page_number.asc"),
          db(env, "almora_translation_jobs?project_id=eq." + projectId + "&select=*&order=created_at.desc"),
          db(env, "almora_translation_versions?project_id=eq." + projectId + "&select=*&order=version_number.desc"),
          db(env, "almora_translation_reviews?project_id=eq." + projectId + "&select=*&order=created_at.desc"),
          db(env, "almora_translation_events?project_id=eq." + projectId + "&select=*&order=created_at.desc&limit=50")
        ]);
        return response({ project, files, pages, jobs, versions, reviews, events }, 200, origin, env);
      }

      if (request.method === "POST" && action === "files") {
        if (["editorial_review", "approved", "published"].includes(project.status)) return fail("O envio de arquivos está bloqueado durante ou após a revisão editorial.", 409, origin, env, "project_locked");
        if (!isAdmin(auth) && project.created_by !== auth.user.id && project.assigned_translator_id !== auth.user.id) {
          return fail("Somente o responsável pelo projeto pode enviar arquivos.", 403, origin, env);
        }
        const name = safeName(request.headers.get("x-file-name") || url.searchParams.get("name"));
        const extension = (name.split(".").pop() || "").toLowerCase();
        const allowed = ["zip", "cbz", "pdf", "png", "jpg", "jpeg", "webp"];
        if (!allowed.includes(extension)) return fail("Formato não permitido.", 415, origin, env);
        const maxBytes = Number(env.MAX_UPLOAD_BYTES || 80 * 1024 * 1024);
        const declared = Number(request.headers.get("content-length") || 0);
        if (declared > maxBytes) return fail("Arquivo excede o limite técnico configurado.", 413, origin, env);
        const original = await request.arrayBuffer();
        if (!original.byteLength || original.byteLength > maxBytes) return fail("Arquivo vazio ou acima do limite técnico.", 413, origin, env);
        if (!validFileSignature(extension, original)) return fail("O conteúdo do arquivo não corresponde à extensão informada.", 415, origin, env, "invalid_file_signature");

        const fileId = crypto.randomUUID();
        const objectKey = "translate/" + projectId + "/originals/" + fileId + "/" + name;
        const encrypted = await encrypt(original, env);
        await env.ALMORA_BUCKET.put(objectKey, encrypted, {
          httpMetadata: { contentType: "application/octet-stream", cacheControl: "private, no-store" },
          customMetadata: { almoraTranslate: "encrypted-v1", fileId }
        });

        const mime = ({ zip: "application/zip", cbz: "application/vnd.comicbook+zip", pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" })[extension] || "application/octet-stream";
        const kind = ["zip", "cbz"].includes(extension) ? "archive" : extension === "pdf" ? "pdf" : "image";
        const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", original)))
          .map(byte => byte.toString(16).padStart(2, "0")).join("");

        try {
          await db(env, "almora_translation_files", {
            method: "POST",
            headers: { "prefer": "return=minimal" },
            body: JSON.stringify({
              id: fileId,
              project_id: projectId,
              uploaded_by: auth.user.id,
              original_name: name,
              object_key: objectKey,
              mime_type: mime,
              file_extension: extension,
              file_size_bytes: original.byteLength,
              checksum_sha256: checksum,
              file_kind: kind,
              status: "uploaded"
            })
          });
        } catch (error) {
          await env.ALMORA_BUCKET.delete(objectKey);
          throw error;
        }

        await db(env, "almora_translation_versions?project_id=eq." + projectId + "&status=eq.draft", { method: "PATCH", headers: { "prefer": "return=minimal" }, body: JSON.stringify({ status: "superseded" }) });
        const allFiles = await db(env, "almora_translation_files?project_id=eq." + projectId + "&select=id");
        await db(env, "almora_translation_projects?id=eq." + projectId, {
          method: "PATCH",
          headers: { "prefer": "return=minimal" },
          body: JSON.stringify({
            status: "uploaded",
            total_files: (allFiles || []).length,
            updated_at: new Date().toISOString()
          })
        });
        await addEvent(env, projectId, auth.user.id, "file_uploaded", {
          file_id: fileId, extension, size_bytes: original.byteLength, checksum_sha256: checksum
        });
        return response({ file: { id: fileId, name, size_bytes: original.byteLength, status: "uploaded" } }, 201, origin, env);
      }

      if (request.method === "POST" && action === "versions") {
        if (["editorial_review", "approved", "published"].includes(project.status)) return fail("Não é possível substituir o pacote durante ou após a revisão editorial.", 409, origin, env, "project_locked");
        if (!isTranslator(auth) || (!isAdmin(auth) && project.created_by !== auth.user.id && project.assigned_translator_id !== auth.user.id)) return fail("Somente o responsável pela tradução pode gerar um pacote.", 403, origin, env);
        const format = String(request.headers.get("x-output-format") || "zip").toLowerCase();
        if (format !== "zip") return fail("O pacote de revisão usa formato ZIP.", 400, origin, env);
        const declared = Number(request.headers.get("content-length") || 0);
        if (declared > 80 * 1024 * 1024) return fail("O pacote excede 80 MiB.", 413, origin, env);
        const archive = await request.arrayBuffer();
        if (!archive.byteLength || archive.byteLength > 80 * 1024 * 1024) return fail("Pacote vazio ou acima de 80 MiB.", 413, origin, env);
        const pages = await db(env, "almora_translation_pages?project_id=eq." + projectId + "&select=id,ocr_data&page_number=gt.0&order=page_number.asc");
        const readable = (pages || []).filter(page => String(page.ocr_data?.source_text || "").trim());
        if (!pages?.length || !readable.length || readable.some(page => !String(page.ocr_data?.translated_text || "").trim())) return fail("O pacote exige todas as páginas com texto reconhecido traduzido.", 409, origin, env);
        const latest = await db(env, "almora_translation_versions?project_id=eq." + projectId + "&select=version_number&order=version_number.desc&limit=1");
        const versionNumber = Number(latest?.[0]?.version_number || 0) + 1;
        const objectKey = "translate/" + projectId + "/versions/v" + versionNumber + "/" + crypto.randomUUID() + ".zip";
        const encrypted = await encrypt(archive, env);
        await env.ALMORA_BUCKET.put(objectKey, encrypted, { httpMetadata: { contentType: "application/octet-stream", cacheControl: "private, no-store" }, customMetadata: { almoraTranslate: "encrypted-v1", projectId, versionNumber: String(versionNumber) } });
        try {
          const created = await db(env, "almora_translation_versions", { method: "POST", headers: { "prefer": "return=representation" }, body: JSON.stringify({ project_id: projectId, version_number: versionNumber, output_format: "zip", object_prefix: objectKey, status: "draft", created_by: auth.user.id, report: { pages: pages.length, translated_pages: readable.length, package_type: "review_bundle" } }) });
          await addEvent(env, projectId, auth.user.id, "review_package_created", { version_number: versionNumber, pages: pages.length });
          return response({ success: true, version: created?.[0] || { version_number: versionNumber, status: "draft" } }, 201, origin, env);
        } catch (error) { await env.ALMORA_BUCKET.delete(objectKey); throw error; }
      }

      const versionDownloadMatch = action.match(/^versions\/([0-9a-f-]{36})\/download$/i);
      if (request.method === "GET" && versionDownloadMatch) {
        const rows = await db(env, "almora_translation_versions?id=eq." + versionDownloadMatch[1] + "&project_id=eq." + projectId + "&select=*&limit=1");
        const version = rows?.[0];
        if (!version) return fail("Versão não encontrada.", 404, origin, env);
        const object = await env.ALMORA_BUCKET.get(version.object_prefix);
        if (!object) return fail("Pacote não encontrado no armazenamento.", 404, origin, env);
        const plain = await decrypt(await object.arrayBuffer(), env);
        return new Response(plain, { status: 200, headers: { ...cors, "content-type": "application/zip", "content-disposition": "attachment; filename=almora-revisao-v" + version.version_number + ".zip", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
      }

      const pageLayoutMatch = action.match(/^pages\/([0-9a-f-]{36})\/layout$/i);
      if (request.method === "POST" && pageLayoutMatch) {
        if (!isTranslator(auth) || (!isAdmin(auth) && project.created_by !== auth.user.id && project.assigned_translator_id !== auth.user.id)) return fail("Somente o responsável pela tradução pode preparar o lettering.", 403, origin, env);
        const pageId = pageLayoutMatch[1];
        const rows = await db(env, "almora_translation_pages?id=eq." + pageId + "&project_id=eq." + projectId + "&select=*&limit=1");
        const page = rows?.[0];
        if (!page) return fail("Página não encontrada.", 404, origin, env);
        const input = await request.json();
        const width = Number(input.width), height = Number(input.height);
        const raw = Array.isArray(input.lines) ? input.lines : [];
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 1800 || height > 1800 || raw.length > 300) return fail("Dimensões ou quantidade de linhas OCR inválidas.", 400, origin, env);
        const lines = raw.map(line => ({ text: String(line.text || "").slice(0, 500), x: Math.max(0, Math.min(width, Math.round(Number(line.x) || 0))), y: Math.max(0, Math.min(height, Math.round(Number(line.y) || 0))), width: Math.max(0, Math.min(width, Math.round(Number(line.width) || 0))), height: Math.max(0, Math.min(height, Math.round(Number(line.height) || 0))) })).filter(line => line.text.trim() && line.width > 0 && line.height > 0);
        const ocrData = { ...(page.ocr_data || {}), lettering_layout: { width, height, lines, prepared_at: new Date().toISOString(), engine: "tesseract.js" } };
        await db(env, "almora_translation_pages?id=eq." + pageId + "&project_id=eq." + projectId, { method: "PATCH", headers: { "prefer": "return=minimal" }, body: JSON.stringify({ ocr_data: ocrData, updated_at: new Date().toISOString() }) });
        await addEvent(env, projectId, auth.user.id, "lettering_layout_prepared", { page_id: pageId, page_number: page.page_number, lines: lines.length });
        return response({ success: true, page_id: pageId, page_number: page.page_number, lines: lines.length }, 200, origin, env);
      }
      const pageImageMatch = action.match(/^pages\/([0-9a-f-]{36})\/image$/i);
      if (request.method === "GET" && pageImageMatch) {
        const pageId = pageImageMatch[1];
        const rows = await db(env, "almora_translation_pages?id=eq." + pageId +
          "&project_id=eq." + projectId + "&select=*&limit=1");
        const page = rows && rows[0];
        if (!page) return fail("Página não encontrada.", 404, origin, env);
        const object = await env.ALMORA_BUCKET.get(page.original_object_key);
        if (!object) return fail("Imagem da página não encontrada no armazenamento.", 404, origin, env);
        const plain = await decrypt(await object.arrayBuffer(), env);
        const mime = page.ocr_data?.mime_type || "application/octet-stream";
        return new Response(plain, { status: 200, headers: {
          ...cors, "content-type": mime, "cache-control": "private, no-store",
          "content-length": String(plain.byteLength), "x-content-type-options": "nosniff"
        }});
      }

      const downloadMatch = action.match(/^files\/([0-9a-f-]{36})\/download$/i);
      if (request.method === "GET" && downloadMatch) {
        const fileId = downloadMatch[1];
        const rows = await db(env, "almora_translation_files?id=eq." + fileId + "&project_id=eq." + projectId + "&select=*&limit=1");
        const file = rows && rows[0];
        if (!file) return fail("Arquivo não encontrado.", 404, origin, env);
        const object = await env.ALMORA_BUCKET.get(file.object_key);
        if (!object) return fail("Objeto não encontrado no armazenamento.", 404, origin, env);
        const plain = await decrypt(await object.arrayBuffer(), env);
        const headers = {
          ...cors,
          "content-type": file.mime_type,
          "content-length": String(plain.byteLength),
          "content-disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(file.original_name),
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff"
        };
        return new Response(plain, { status: 200, headers });
      }
    }

    return fail("Rota não encontrada.", 404, origin, env, "not_found");
  } catch (error) {
    return fail(error.message || "Erro interno.", error.status && error.status < 500 ? error.status : 500, origin, env, "internal_error");
  }
}

export { supabaseBase };

export default {
  fetch(request, env) {
    return handle(request, env);
  }
};
