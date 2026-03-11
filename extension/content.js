/**
 * Content script – runs in the context of every matched page.
 * Listens for an "extract" message from the popup and returns the text
 * content of the elements matching BASE_SELECTOR + SUB_SELECTOR (config.js).
 *
 * SUB_SELECTOR is a standard CSS selector string (comma-separated for
 * multiple targets) or null to extract the entire BASE_SELECTOR.
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== "extract") return;

  const { BASE_SELECTOR, SUB_SELECTOR, fallbackToFullText } = getSelectors();
  const base = document.querySelector(BASE_SELECTOR);

  if (!base) {
    sendResponse({
      success: false,
      error: `No container found for selector: ${BASE_SELECTOR}`,
    });
    return;
  }

  let text = "";

  if (SUB_SELECTOR && SUB_SELECTOR.trim()) {
    const nodes = [...base.querySelectorAll(SUB_SELECTOR.trim())];
    text = nodes
      .map((n) => n.innerText.trim())
      .filter(Boolean)
      .join("\n\n");

    text = stripInlineNoise(text);
  }

  // Fallback: grab <main> text but strip LinkedIn UI noise
  if (!text && fallbackToFullText) {
    text = cleanFallbackText(base.innerText.trim());
  }

  if (!text) {
    sendResponse({
      success: false,
      error: `No text found in ${BASE_SELECTOR}`,
    });
    return;
  }

  sendResponse({ success: true, text });
});

/**
 * Remove inline LinkedIn UI noise from extracted text.
 */
function stripInlineNoise(text) {
  const noisePatterns = [
    // EN
    /Promoted by hirer[^\n]*/gi,
    /Responses managed off LinkedIn/gi,
    /See how you compare to[^\n]*/gi,
    /Access exclusive applicant insights[^\n]*/g,
    /Try Premium for [^\n]*/g,
    /1-month free trial[^\n]*/g,
    /1-month free with[^\n]*/g,
    /\d+ people clicked apply/g,
    /\d+ others who clicked apply/g,
    /Reposted \d+ \w+ ago · /g,
    /^Apply$/gm,
    /^Save$/gm,
    /^Follow$/gm,
    /Set alert for similar jobs[\s\S]*?^Off$/gm,
    /^\d[\d,]+ followers$/gm,
    /^\d+ on LinkedIn$/gm,
    /show more$/gm,
    /… more$/gm,
    /^Millions of members use Premium$/gm,
    /^Job search faster with Premium$/gm,
    /^Access company insights[^\n]*/gm,
    /\d+ of \d+ skills? match[^\n]*/gi,
    /Matches your job preferences[^\n]*/gi,
    /^Full-time$/gm,
    /^Part-time$/gm,
    /^Contract$/gm,
    /^Hybrid$/gm,
    /^Remote$/gm,
    /^On-site$/gm,
    // PT
    /Promovida por quem está contratando[^\n]*/g,
    /Respostas gerenciadas fora do LinkedIn/g,
    /Veja como você se compara[^\n]*/g,
    /Veja sua posição entre (mais de )?\d+[^\n]*/g,
    /Acesse insights exclusivos[^\n]*/g,
    /Experimente Premium por [^\n]*/g,
    /Grátis por 1 mês com[^\n]*/g,
    /\d+ pessoas clicaram em Candidate-se/g,
    /Compartilhou há \d+ \w+/g,
    /^Candidate-se$/gm,
    /^Salvar$/gm,
    /^Seguir$/gm,
    /^Conectar$/gm,
    /Ative um alerta para vagas semelhantes[\s\S]*?^Desativada$/gm,
    /^\d[\d.]+ seguidores$/gm,
    /^\d+ no LinkedIn$/gm,
    /mostrar mais$/gm,
    /… mais$/gm,
    /^Milhões de usuários[^\n]*/gm,
    /^Pesquise vagas mais rápido[^\n]*/gm,
    /^Acesse informações sobre empresas[^\n]*/gm,
    /\d+ de \d+ competências? correspondem?[^\n]*/gi,
    /Corresponde às suas preferências de vaga[^\n]*/gi,
    /^Ex-aluno da instituição[^\n]*/gm,
    /^Enviaremos um lembrete[^\n]*/gm,
    /^Cancele quando quiser[^\n]*/gm,
    /^Híbrido$/gm,
    /^Tempo integral$/gm,
  ];
  for (const pattern of noisePatterns) {
    text = text.replace(pattern, "");
  }
  return text;
}

/**
 * Strip LinkedIn UI chrome from a full <main> innerText dump.
 * Cuts trailing sections (other jobs, footer) and removes inline CTAs.
 */
function cleanFallbackText(raw) {
  // 1. Cut at the earliest trailing-noise boundary
  //    (these appear AFTER the "About the company" block)
  const cutMarkers = [
    // EN
    "Interested in working with us in the future?",
    "\nMore jobs\n",
    "Need to hire fast?",
    "See more jobs like this",
    // PT
    "Tem interesse em trabalhar conosco no futuro?",
    "Tenho interesse",
    "\nMais vagas\n",
  ];
  let text = raw;
  let earliest = text.length;
  for (const marker of cutMarkers) {
    const idx = text.indexOf(marker);
    if (idx !== -1 && idx < earliest) earliest = idx;
  }
  text = text.substring(0, earliest);

  // 2. Remove the "People you can reach out to" block (before "About the job")
  text = text.replace(
    /People you can reach out to[\s\S]*?(?=\n*About the job)/,
    ""
  );
  text = text.replace(
    /Pessoas que você pode contatar[\s\S]*?(?=\n*Sobre a vaga)/,
    ""
  );

  // 3. Remove inline LinkedIn UI noise
  text = stripInlineNoise(text);

  // 4. Clean up the "About the company" section.
  //    Raw text includes: company name, industry, " • ", employee count, etc.
  //    We keep the heading and only the long description paragraphs.
  const aboutHeading = text.includes("Sobre a empresa")
    ? "Sobre a empresa"
    : "About the company";
  const aboutIdx = text.indexOf(aboutHeading);
  if (aboutIdx !== -1) {
    const before = text.substring(0, aboutIdx + aboutHeading.length);
    const after = text.substring(aboutIdx + aboutHeading.length);
    // Split into lines and keep only lines that look like real prose (>60 chars)
    // or are clearly part of a paragraph.
    const lines = after.split("\n");
    const cleaned = [];
    let inDescription = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inDescription) cleaned.push("");
        continue;
      }
      // Skip short metadata: company name, industry, bullets, employee counts
      if (!inDescription) {
        if (
          trimmed === "•" ||
          trimmed === " • " ||
          /^\d+-\d+\s+(employees|funcionários)$/.test(trimmed) ||
          /^\d[\d,.]+\s+(followers|seguidores)$/.test(trimmed) ||
          /^\d+\s+(on LinkedIn|no LinkedIn)$/.test(trimmed) ||
          trimmed.length < 50
        ) {
          continue; // skip metadata
        }
        inDescription = true;
      }
      cleaned.push(line);
    }
    text = before + "\n\n" + cleaned.join("\n").trim();
  }

  // 5. Collapse excess blank lines
  return text.replace(/\n{3,}/g, "\n\n").trim();
}
