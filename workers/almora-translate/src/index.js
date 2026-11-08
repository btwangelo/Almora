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
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "Authorization,Content-Type,X-File-Name",
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
  const leaf = String(name || "upload").split(/[\\/]/).pop();
  return leaf.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._() -]/g, "_").replace(/\s+/g, "_").slice(0, 140) || "upload";
}

async function db(env, path, options) {
  const url = env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + path;
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
  const res = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
    headers: {
      "apikey": env.SUPABASE_PUBLISHABLE_KEY,
      "authorization": "Bearer " + token[1]
    }
  });
  if (!res.ok) return null;
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
    return response({ service: "ALMORA Translate", status: "online", stage: "secure-upload-foundation" }, 200, origin, env);
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY || !env.ALMORA_BUCKET) {
    return fail("O servidor ainda não foi configurado. Verifique as variáveis e o vínculo R2.", 503, origin, env, "server_not_configured");
  }

  let auth;
  try { auth = await authenticate(request, env); }
  catch (error) { return fail("Não foi possível validar a sessão.", 502, origin, env, "auth_unavailable"); }
  if (!auth) return fail("Entre na sua conta ALMORA para continuar.", 401, origin, env, "authentication_required");

  if (!auth.roles.length) return fail("Sua conta não tem autorização para usar o ALMORA Translate.", 403, origin, env, "role_required");

  try {
    if (request.method === "GET" && path === "/api/projects") {
      let query = "almora_translation_projects?select=*&order=created_at.desc";
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
        if (!isAdmin(auth) && project.created_by !== auth.user.id && project.assigned_translator_id !== auth.user.id) {
          return fail("Somente o responsável pelo projeto pode enviar arquivos.", 403, origin, env);
        }
        const name = safeName(request.headers.get("x-file-name") || url.searchParams.get("name"));
        const extension = (name.split(".").pop() || "").toLowerCase();
        const allowed = ["zip", "cbz", "pdf", "png", "jpg", "jpeg", "webp"];
        if (!allowed.includes(extension)) return fail("Formato não permitido.", 415, origin, env);
        const maxBytes = Number(env.MAX_UPLOAD_BYTES || 50 * 1024 * 1024);
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

        const mime = request.headers.get("content-type") || "application/octet-stream";
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

export default {
  fetch(request, env) {
    return handle(request, env);
  }
};
