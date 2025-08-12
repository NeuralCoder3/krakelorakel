import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

// Sample words for different categories
const wordLists = {
  animals: ['cat', 'dog', 'elephant', 'lion', 'tiger', 'bear', 'wolf', 'fox', 'deer', 'rabbit', 'squirrel', 'bird', 'fish', 'horse', 'cow', 'pig', 'sheep', 'goat', 'chicken', 'duck'],
  objects: ['car', 'house', 'tree', 'flower', 'book', 'phone', 'computer', 'chair', 'table', 'bed', 'lamp', 'clock', 'cup', 'plate', 'fork', 'knife', 'spoon', 'bottle', 'bag', 'shoes'],
  nature: ['mountain', 'river', 'ocean', 'forest', 'beach', 'sun', 'moon', 'stars', 'clouds', 'rain', 'snow', 'grass', 'rocks', 'cave', 'volcano', 'island', 'desert', 'lake', 'waterfall', 'bridge'],
  food: ['apple', 'banana', 'orange', 'pizza', 'hamburger', 'hotdog', 'ice cream', 'cake', 'bread', 'cheese', 'milk', 'eggs', 'rice', 'pasta', 'soup', 'salad', 'steak', 'chicken', 'fish', 'vegetables'],
  fantasy: ['dragon', 'unicorn', 'wizard', 'witch', 'fairy', 'castle', 'knight', 'princess', 'king', 'queen', 'magic wand', 'crystal ball', 'flying carpet', 'treasure chest', 'monster', 'ghost', 'vampire', 'werewolf', 'mermaid', 'phoenix']
};

// GET /api/game/word - Get a random word to draw
router.get('/word', (req: Request, res: Response) => {
  try {
    const categories = Object.keys(wordLists);
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const words = wordLists[randomCategory as keyof typeof wordLists];
    const randomWord = words[Math.floor(Math.random() * words.length)];
    
    return res.status(200).json({
      word: randomWord,
      category: randomCategory,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting random word:', error);
    return res.status(500).json({
      error: 'Failed to get random word'
    });
  }
});

// GET /api/game/boards - Get available board images
router.get('/boards', (req: Request, res: Response) => {
  try {
    const boardsDir = path.join(__dirname, '../../boards');
    
    if (!fs.existsSync(boardsDir)) {
      return res.status(200).json({
        boards: [],
        message: 'No boards directory found'
      });
    }

    const files = fs.readdirSync(boardsDir);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext);
    });

    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const boards = imageFiles.map(file => ({
      filename: file,
      url: `${backendUrl}/boards/${file}`,
      name: path.parse(file).name
    }));

    return res.status(200).json({
      boards: boards,
      count: boards.length
    });
  } catch (error) {
    console.error('Error getting board list:', error);
    return res.status(500).json({
      error: 'Failed to get board list'
    });
  }
});

// GET /api/game/board/random - Get a random board image
router.get('/board/random', (req: Request, res: Response) => {
  try {
    const boardsDir = path.join(__dirname, '../../boards');
    
    if (!fs.existsSync(boardsDir)) {
      return res.status(404).json({
        error: 'No boards directory found'
      });
    }

    const files = fs.readdirSync(boardsDir);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext);
    });

    if (imageFiles.length === 0) {
      return res.status(404).json({
        error: 'No board images found'
      });
    }

    const randomFile = imageFiles[Math.floor(Math.random() * imageFiles.length)];
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    
    return res.status(200).json({
      filename: randomFile,
      url: `${backendUrl}/boards/${randomFile}`,
      name: path.parse(randomFile).name
    });
  } catch (error) {
    console.error('Error getting random board:', error);
    return res.status(500).json({
      error: 'Failed to get random board'
    });
  }
});

export { router as gameRouter };
