import { Router, Request, Response } from 'express';
import { generateMysticalResponse } from '../services/aiService';

const router = Router();

interface ChatRequest {
  message: string;
}

interface ChatResponse {
  response: string;
  timestamp: string;
}

// POST /api/chat - Send a message and get a mystical response
router.post('/', async (req: Request<{}, {}, ChatRequest>, res: Response<ChatResponse>) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        response: 'The oracle requires a meaningful question to reveal its wisdom.',
        timestamp: new Date().toISOString()
      });
    }

    // Generate mystical response
    const mysticalResponse = generateMysticalResponse(message.trim());

    return res.status(200).json({
      response: mysticalResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return res.status(500).json({
      response: 'The mystical forces are disturbed. Please try again later.',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/chat - Get a random mystical wisdom
router.get('/wisdom', (req: Request, res: Response<ChatResponse>) => {
  try {
    const randomWisdom = generateMysticalResponse('random wisdom');
    
    res.status(200).json({
      response: randomWisdom,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in wisdom endpoint:', error);
    res.status(500).json({
      response: 'The oracle is silent today. Please return tomorrow.',
      timestamp: new Date().toISOString()
    });
  }
});

export { router as chatRouter };
