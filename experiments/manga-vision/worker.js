/**
 * ALMORA manga-vision lab only.
 * Run locally with Wrangler; never deploy this file to the production Worker.
 * Required binding: AI (Cloudflare Workers AI).
 */
const MODEL = "@cf/moondream/moondream3.1-9B-A2B";
const MAX_IMAGE_CHARS = 14_000_000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/analyze") {
      return json({ error: "Use POST /analyze" }, 404);
    }
    if (!env.AI) return json({ error: "Workers AI binding AI is missing." }, 503);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Invalid JSON body." }, 400); }

    const image = String(body.image || "");
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(image)) {
      return json({ error: "image must be a PNG, JPEG or WEBP base64 data URL." }, 400);
    }
    if (image.length > MAX_IMAGE_CHARS) return json({ error: "Image too large for this lab endpoint." }, 413);

    const targets = [
      ["speech_bubbles", "speech bubble containing dialogue text"],
      ["thought_bubbles", "thought bubble containing text"],
      ["narration_boxes", "rectangular narration box containing text"],
      ["sound_effects", "comic sound effect lettering"],
      ["other_text", "visible text outside speech bubbles, such as character names or chapter titles"]
    ];

    const results = {};
    for (const [key, target] of targets) {
      try {
        results[key] = await env.AI.run(MODEL, {
          task: "detect",
          image,
          target,
          max_objects: 150
        });
      } catch (error) {
        results[key] = { error: String(error?.message || error) };
      }
    }

    let pageAnalysis = null;
    try {
      pageAnalysis = await env.AI.run(MODEL, {
        task: "query",
        image,
        question: "Analyze this manga/manhwa page. Return strict JSON only. List each distinct text region separately, including speech balloons, thought balloons, narration, background dialogue, sound effects, character name cards and chapter titles. For each item give type, exact visible text if legible, and approximate bounding box normalized from 0 to 1 as x_min, y_min, x_max, y_max. Do not merge repeated sound effects. Do not invent unreadable text.",
        reasoning: false,
        max_tokens: 6000,
        stream: false
      });
    } catch (error) {
      pageAnalysis = { error: String(error?.message || error) };
    }

    return json({
      model: MODEL,
      note: "Experimental model output, not yet validated against human annotations.",
      detections: results,
      page_analysis: pageAnalysis
    });
  }
};
