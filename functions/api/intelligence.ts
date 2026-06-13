import OpenAI from 'openai';

export const onRequestPost = async ({ request, env }: any) => {
  const nvidiaKey = env.NVIDIA_API_KEY;
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

  if (!nvidiaKey || !tavilyKey) {
    console.warn("API Keys missing in /api/intelligence. Returning mock data.");
    return Response.json({ news: generateMockNews(sector, date) });
  }
  
  try {
      // 1. Tavily Search
      const searchQuery = `Actualité fiscale, opportunités économiques, appels d'offres et innovations au Burkina Faso et UEMOA ${sector !== 'Général' ? `pour le secteur ${sector}` : ''} ${date}`;
      
      const tavilyResponse = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tavilyKey}`
          },
          body: JSON.stringify({
              query: searchQuery,
              search_depth: "basic",
              include_answer: false,
              include_raw_content: false,
              max_results: 10
          })
      });

      if (!tavilyResponse.ok) {
           throw new Error('Erreur Tavily API');
      }

      const tavilyData: any = await tavilyResponse.json();
      let searchResultsText = "";
      if (tavilyData && tavilyData.results) {
         searchResultsText = tavilyData.results.map((r: any) => `Titre: ${r.title}\nURL: ${r.url}\nExtrait: ${r.snippet || r.content || ''}`).join('\n\n');
      }

      // 2. NVIDIA NIM DeepSeek V3.2
      const openai = new OpenAI({
          baseURL: "https://integrate.api.nvidia.com/v1",
          apiKey: nvidiaKey
      });

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

      const dsResponse = await openai.chat.completions.create({
          model: "stepfun-ai/step-3.7-flash",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4096,
          temperature: 0.1,
      });

      let text = dsResponse.choices[0]?.message?.content || "";
      if (!text) {
          throw new Error("L'IA n'a renvoyé aucune réponse.");
      }
      
      let jsonText = text;
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonText = text.substring(firstBrace, lastBrace + 1);
      }

      let parsedData;
      try {
         parsedData = JSON.parse(jsonText.trim());
      } catch (e) {
         console.error("AI JSON parse failed. Full text received:", text);
         throw new Error("L'IA a renvoyé une structure JSON invalide. Essayez de rafraîchir.");
      }
      
      const generatedNews = parsedData.news || (Array.isArray(parsedData) ? parsedData : []);
      
      return Response.json({ news: generatedNews });

  } catch (error) {
      console.error("Erreur gérée dans /api/intelligence :", error);
      return Response.json({ news: generateMockNews(sector, date) });
  }
};
