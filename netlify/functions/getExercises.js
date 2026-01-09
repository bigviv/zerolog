exports.handler = async (event) => {
  const { query, target } = event.queryStringParameters;
  
  // Choose endpoint based on if user searched by name or muscle group
  const endpoint = target 
    ? `https://exercisedb.p.rapidapi.com/exercises/target/${target}`
    : `https://exercisedb.p.rapidapi.com/exercises/name/${query}`;

  try {
    const response = await fetch(`${endpoint}?limit=20`, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': process.env.EXERCISE_DB_KEY, // This pulls from Netlify Settings
        'x-rapidapi-host': 'exercisedb.p.rapidapi.com'
      }
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch' }) };
  }
};
