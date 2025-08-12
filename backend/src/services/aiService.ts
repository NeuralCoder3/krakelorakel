interface MysticalResponse {
  response: string;
  category: string;
}

export function generateMysticalResponse(userMessage: string): string {
  const message = userMessage.toLowerCase();
  
  // Define mystical response categories
  const responses: MysticalResponse[] = [
    // Love and relationships
    {
      category: 'love',
      response: 'The heart speaks in whispers that only the soul can hear. Trust in the love that surrounds you, for it is the greatest magic of all.'
    },
    {
      category: 'love',
      response: 'Love flows like a river, sometimes gentle, sometimes wild. Embrace both currents, for they shape the landscape of your heart.'
    },
    {
      category: 'love',
      response: 'In the garden of emotions, love is the rarest flower. Nurture it with patience, and it will bloom in unexpected ways.'
    },
    
    // Career and purpose
    {
      category: 'career',
      response: 'Your path is written in the stars, but you must walk it with your own feet. The journey reveals the destination.'
    },
    {
      category: 'career',
      response: 'The work of your hands carries the energy of your soul. Choose wisely what you create, for it becomes part of the world.'
    },
    {
      category: 'career',
      response: 'Success is not a destination but a dance with destiny. Move with grace, and the universe will move with you.'
    },
    
    // Health and wellness
    {
      category: 'health',
      response: 'Your body is a temple of the divine. Honor it with movement, nourish it with wisdom, and rest it with peace.'
    },
    {
      category: 'health',
      response: 'The breath is the bridge between body and spirit. Each inhale brings life, each exhale releases what no longer serves.'
    },
    {
      category: 'health',
      response: 'Healing is not the absence of illness, but the presence of harmony. Seek balance in all things.'
    },
    
    // Spirituality and growth
    {
      category: 'spirituality',
      response: 'The soul grows in the soil of experience. Every challenge is a seed of wisdom waiting to bloom.'
    },
    {
      category: 'spirituality',
      response: 'You are not separate from the universe, but a unique expression of it. Your journey is the universe discovering itself.'
    },
    {
      category: 'spirituality',
      response: 'Meditation is not about emptying the mind, but about becoming the observer of your thoughts. In observation lies transformation.'
    },
    
    // General wisdom
    {
      category: 'general',
      response: 'The present moment is the only time that truly exists. Yesterday is memory, tomorrow is imagination. Be here now.'
    },
    {
      category: 'general',
      response: 'Change is the only constant in the universe. Embrace it like an old friend, for it brings growth and renewal.'
    },
    {
      category: 'general',
      response: 'Your thoughts shape your reality. Choose them as carefully as you would choose your companions on a long journey.'
    },
    {
      category: 'general',
      response: 'The answers you seek are already within you. The oracle merely helps you remember what you already know.'
    },
    {
      category: 'general',
      response: 'Every ending is a new beginning in disguise. Trust the cycles of life, for they are perfect in their timing.'
    }
  ];

  // Try to match user message with a category
  let category = 'general';
  
  if (message.includes('love') || message.includes('relationship') || message.includes('heart') || message.includes('romance')) {
    category = 'love';
  } else if (message.includes('work') || message.includes('career') || message.includes('job') || message.includes('business') || message.includes('success')) {
    category = 'career';
  } else if (message.includes('health') || message.includes('body') || message.includes('sick') || message.includes('wellness') || message.includes('healing')) {
    category = 'health';
  } else if (message.includes('spirit') || message.includes('soul') || message.includes('meditation') || message.includes('prayer') || message.includes('faith')) {
    category = 'spirituality';
  }

  // Filter responses by category and select a random one
  const categoryResponses = responses.filter(r => r.category === category);
  const randomResponse = categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
  
  // Add some mystical flair
  const mysticalPrefixes = [
    '🔮 The crystal ball reveals: ',
    '✨ The ancient wisdom speaks: ',
    '🌟 The stars align to tell us: ',
    '🌙 The moon whispers: ',
    '🧙‍♂️ The oracle proclaims: ',
    '🌿 The sacred herbs reveal: ',
    '💫 The cosmic energy flows: ',
    '🕯️ The mystical flame illuminates: '
  ];
  
  const randomPrefix = mysticalPrefixes[Math.floor(Math.random() * mysticalPrefixes.length)];
  
  return randomPrefix + randomResponse.response;
}
