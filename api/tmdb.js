export default async function handler(req, res) {
  const { endpoint, query = '' } = req.query;
  const apiKey = process.env.TMDB_API_KEY;
  
  if (!endpoint) {
    return res.status(400).json({ error: "Endpoint manquant." });
  }

  // On force la langue en français (fr-FR) pour récupérer les titres et résumés en VF
  let tmdbUrl = `https://api.themoviedb.org/3${endpoint}?api_key=${apiKey}&language=fr-FR`;
  if (query) {
    tmdbUrl += `&query=${encodeURIComponent(query)}`;
  }

  try {
    const response = await fetch(tmdbUrl);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la communication avec TMDB." });
  }
}
