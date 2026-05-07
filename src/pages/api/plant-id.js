import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image } = req.body;
    
    const response = await axios.post('https://api.plant.id/v2/identify', {
      images: [image],
      modifiers: ['crops_fast', 'health_all'],
      plant_language: 'en',
      plant_details: ['common_names', 'url', 'name_authority', 'wiki_description', 'taxonomy'],
      disease_details: ['common_names', 'url', 'description']
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': process.env.PLANT_ID_API_KEY
      }
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error('Plant.id API error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to analyze image with Plant.id' });
  }
}