import OpenAI from 'openai';

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_DEFAULT_MODEL = "inclusionai/ling-3.0-flash-vl:free";

export const onRequestPost = async ({ request, env }: any) => {
  const openrouterKey = env.OPENROUTER_API_KEY || env.NVIDIA_API_KEY;
  const tavilyKey = env.TAVILY_API_KEY;
  
  const generateMockNews = (sector: string, date: string) => {
      return [
        {
          title: "Nouvelle loi de finances 2026 : Ce qui change pour les PME",
          excerpt: "La déclaration de TVA passe au format 100% électronique avec des pénalités réduites pour les primo-déclarants.",
          category: "FISCAL",
          date: date,
          url: "",
          targetSectors: ["GLOBAL"]
        },
        {
          title: "Fonds de soutien à la digitalisation",
          excerpt: "Un nouveau fonds Ouest-Africain alloue jusqu'à 5M FCFA pour les entreprises modernisant leur gestion financière.",
          category: "OPPORTUNITY",
          date: date,
          url: "",
          targetSectors: ["GLOBAL", sector]
        },
        {
          title: `Appel d'offres : Innovation secteur ${sector}`,
          excerpt: `Le ministère du commerce lance un programme d'accompagnement spécifique au secteur ${sector}.`,
          category: "MARKET",
          date: date,
          url: "",
          targetSectors: [sector]
        }
      ];
  };

  const body = await request.json().catch(() => ({}));
  const { sector, date } = body;

  if (!openrouterKey || !tavilyKey) {
    console.warn("API Keys missing in /api/intelligence. Returning mock data.");
    return Response.json({ news: generateMockNews(sector, date), source: "mock", error: "missing_keys" });
  }

  try {
      // 1. Tavily Search — 3 requêtes ciblées en PARALLÈLE (fiscal + opportunités + secteur).
      // Parallèle = meilleure couverture que le OR unique, et résilient (1 échec n'aborte pas tout).
      const sectorLabel = sector && sector !== 'Général' ? sector : 'PME';
      const baseQuery = `Burkina Faso UEMOA ${date?.slice(0,4) || '2026'}`;
      const queries = [
        `fiscalité impôts TVA DGI Burkina ${baseQuery}`,
        `opportunités financement subvention appel d'offres PME ${baseQuery}`,
        `${sectorLabel} innovation marché économie ${baseQuery}`
      ];

      const runQuery = async (q: string) => {
        try {
          const res = await fetch('https://api.tavily.com/search', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${tavilyKey}`
              },
              body: JSON.stringify({
                  api_key: tavilyKey,
                  query: q,
                  search_depth: "advanced",
                  include_answer: false,
                  include_raw_content: false,
                  max_results: 5
              }),
              signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(15000) : undefined,
          });
          if (!res.ok) {
             const txt = await res.text().catch(()=> "");
             console.warn(`Tavily query failed ${res.status} for "${q.slice(0,40)}": ${txt.slice(0,200)}`);
             return [];
          }
          const data: any = await res.json();
          return Array.isArray(data?.results) ? data.results : [];
        } catch (e) {
          console.warn(`Tavily query error for "${q.slice(0,40)}":`, (e as any)?.message || e);
          return [];
        }
      };

      const settled = await Promise.all(queries.map(runQuery));
      // Merge + déduplique par URL (garde l'ordre fiscal > opportunités > secteur)
      const seen = new Set<string>();
      const merged: any[] = [];
      for (const list of settled) {
        for (const r of list) {
          const key = (r?.url || r?.title || "").toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(r);
          if (merged.length >= 12) break;
        }
        if (merged.length >= 12) break;
      }

      if (merged.length === 0) throw new Error('Tavily: aucun résultat (3 requêtes vides ou en échec)');

      let searchResultsText = merged
        .map((r: any) => `Titre: ${r.title}\nURL: ${r.url}\nExtrait: ${r.snippet || r.content || ''}`)
        .join('\n\n');

      // 2. OpenRouter (unified VL model)
      const openai = new OpenAI({
          baseURL: (env as any).OPENROUTER_BASE_URL || OPENROUTER_BASE_URL,
          apiKey: openrouterKey,
          defaultHeaders: {
            ...(env.APP_URL ? { "HTTP-Referer": env.APP_URL } : {}),
            "X-Title": "Libriwouo Intelligence Veille",
          },
      } as any);

      const prompt = `### CONSIGNES DE SÉCURITÉ ET DE LANGUE ###
- Tu dois IMPÉRATIVEMENT répondre en FRANÇAIS.
- Absolument TOUT le contenu textuel (titres, résumés/excerpts) doit être traduit ou rédigé en français.
- Même si les sources (résultats de recherche) sont en anglais, ton analyse doit être en français.

### Tâche ###
Voici des résultats de recherche web récents pour le Burkina Faso et l'UEMOA (date cible : ${date}):

${searchResultsText}

Génère EXACTEMENT 5 informations clés en te basant de préférence sur ces résultats.
Mélange les catégories suivantes :
1. GLOBAL : Grandes réformes fiscales, décisions douanières de la DGI ou lois de finances.
2. SPÉCIFIQUE AU SECTEUR "${sector}" : Appels d'offres (BOAD, Marchés publics), subventions, ou innovations spécifiques.

CONSIGNES DE SÉCURITÉ ABSOLUES :
- Zéro hallucination. Le champ "url" ne doit contenir QUE des liens cliquables provenant des résultats fournis, ou laisser vide "".
- Choisis tes sources parmi les journaux locaux ou économiques africains si possible.

Renvoie UNIQUEMENT un objet JSON contenant une propriété "news" qui est un tableau d'exactement 5 objets avec ces propriétés exactes :
- "title": (Le titre de la news, concis)
- "excerpt": (Un résumé TRÈS BREF et actionnable d'UNE SEULE PHRASE)
- "category": ("FISCAL", "OPPORTUNITY", "MARKET", ou "TECH")
- "date": ("${date}")
- "url": (Lien vérifié ou "")
- "targetSectors": (doit être un tableau de textes : ["GLOBAL"] ou ["${sector}"])

NE RENVOIE AUCUN TEXTE en dehors du bloc JSON. Assure-toi de la validité stricte de la syntaxe JSON. Exemple: {"news": [{"title": "...", "excerpt": "..."}]}`;

      const intelligenceModel = (env as any).OPENROUTER_CHAT_MODEL || OPENROUTER_DEFAULT_MODEL;

      const dsResponse = await openai.chat.completions.create({
          model: intelligenceModel,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4096,
          temperature: 0.1,
      });

      // Modèles reasoning (ling-3.0-flash-vl) : le contenu peut être dans `reasoning`
      // si tronqué — fallback gracieux + strip des fences ```json.
      const msg: any = (dsResponse as any).choices[0]?.message;
      let text = msg?.content || msg?.reasoning || "";
      if (!text) {
          throw new Error("L'IA n'a renvoyé aucune réponse.");
      }

      let jsonText = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "");
      const firstBrace = jsonText.indexOf('{');
      const firstBracket = jsonText.indexOf('[');
      let start = firstBrace;
      if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) start = firstBracket;
      const lastBrace = jsonText.lastIndexOf('}');
      const lastBracket = jsonText.lastIndexOf(']');
      let end = lastBrace;
      if (lastBracket > end) end = lastBracket;

      if (start !== -1 && end !== -1 && end > start) {
          jsonText = jsonText.substring(start, end + 1);
      }

      let parsedData;
      try {
         parsedData = JSON.parse(jsonText.trim());
      } catch (e) {
         console.error("AI JSON parse failed. Full text received:", text.slice(0, 1000));
         throw new Error("L'IA a renvoyé une structure JSON invalide. Essayez de rafraîchir.");
      }

      let generatedNews = parsedData.news || (Array.isArray(parsedData) ? parsedData : []);
      // Normalisation : exactement 5 items valides (catégorie + date + targetSectors garantis)
      const validCats = new Set(["FISCAL", "OPPORTUNITY", "MARKET", "TECH"]);
      generatedNews = (Array.isArray(generatedNews) ? generatedNews : [])
        .filter((n: any) => n && typeof n.title === "string" && typeof n.excerpt === "string")
        .slice(0, 5)
        .map((n: any) => ({
          title: n.title,
          excerpt: n.excerpt,
          category: validCats.has(n.category) ? n.category : "MARKET",
          date: typeof n.date === "string" && n.date ? n.date : date,
          url: typeof n.url === "string" ? n.url : "",
          targetSectors: Array.isArray(n.targetSectors) && n.targetSectors.length > 0
            ? n.targetSectors.map(String)
            : ["GLOBAL"],
        }));

      if (generatedNews.length === 0) throw new Error("L'IA n'a produit aucune news valide.");

      return Response.json({ news: generatedNews, source: "live" });

  } catch (error) {
      console.error("Erreur gérée dans /api/intelligence :", error);
      return Response.json({
        news: generateMockNews(sector, date),
        source: "mock",
        error: (error as any)?.message || "intelligence_fallback",
      });
  }
};
