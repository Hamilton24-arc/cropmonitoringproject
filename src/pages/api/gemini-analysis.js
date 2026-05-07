import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI('AIzaSyB_weYflQBelNRHmDX_eAcUtmyImPQh8vk');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, plantData } = req.body;
    
    // For image analysis
    if (image) {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const result = await model.generateContent([
        "Analyze this plant image for diseases, deficiencies, and health status. Provide detailed recommendations.",
        {
          inlineData: {
            data: image.split(',')[1],
            mimeType: 'image/jpeg'
          }
        }
      ]);
      
      const response = await result.response;
      return res.status(200).json({ analysis: response.text() });
    }
    
    // For text-based analysis enhancement
    if (plantData) {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `
        Based on the following plant analysis data:
        ${JSON.stringify(plantData)}
        
        Provide:
        1. Detailed health assessment
        2. Recommended remedies
        3. Prevention tips
        4. Any additional observations
        
        Use clear, farmer-friendly language.
      `;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return res.status(200).json({ analysis: response.text() });
    }
    
    throw new Error('No image or plant data provided');
  } catch (error) {
    console.error('Gemini API error:', error);
    res.status(500).json({ error: 'Failed to analyze with Gemini' });
  }
}