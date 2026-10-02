export default async function handler(req, res) {
  const apiKey = process.env.TMDB_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: "Clé TMDB_API_KEY manquante sur Vercel." });
  }

  const { endpoint, ...queryParams } = req.query;
  const targetEndpoint = endpoint || "/trending/all/week";
  const targetUrl = new URL(`https://api.themoviedb.org/3${targetEndpoint}`);
  
  Object.keys(queryParams).forEach(key => {
    targetUrl.searchParams.set(key, queryParams[key]);
  });

  targetUrl.searchParams.set("api_key", apiKey);
  if (!targetUrl.searchParams.has("language")) {
    targetUrl.searchParams.set("language", "fr-FR");
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      headers: { "Accept": "application/json" }
    });
    const data = await response.json();
    
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
