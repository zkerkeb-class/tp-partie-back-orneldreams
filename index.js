
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { body, param, query, validationResult } from 'express-validator';
import pokemon from './schema/pokemon.js';
import path from 'path';
import { fileURLToPath } from 'url';

import './connect.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json({ limit: '1mb' }));

// Servir les fichiers statiques (images)
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// CORS (dev-friendly)
const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isLocalhost = origin.startsWith('http://localhost:');
        const isAllowed = allowedOrigins.includes(origin);
        if (isLocalhost || origin === 'http://localhost:3000' || isAllowed) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

// Basic rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

const handleValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    next();
};

app.get('/', (req, res) => {
    res.send('Pokemon API - Available routes: GET /pokemons (with pagination), GET /pokemons/search/:name, GET /pokemons/:id, POST /pokemons, PUT /pokemons/:id, DELETE /pokemons/:id');
});

// GET tous les pokemons avec pagination
app.get('/pokemons', [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100')
], handleValidation, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const pokemons = await pokemon.find({}).skip(skip).limit(limit);
        const total = await pokemon.countDocuments({});
        const totalPages = Math.ceil(total / limit);

        res.json({
            data: pokemons,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalPokemons: total,
                pokemonsPerPage: limit
            }
        });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// GET un pokemon par ID
app.get('/pokemons/:id', [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')
], handleValidation, async (req, res) => {
    try {
        const poke = await pokemon.findOne({ id: req.params.id });
        if (poke) {
            res.json(poke);
        } else {
            res.status(404).json({ error: 'Pokemon not found' });
        }
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// GET un pokemon par nom (recherche)
app.get('/pokemons/search/:name', [
    param('name').trim().isLength({ min: 1, max: 50 }).withMessage('name must be 1-50 chars')
], handleValidation, async (req, res) => {
    try {
        const name = req.params.name;
        const poke = await pokemon.findOne({
            $or: [
                { 'name.english': new RegExp(name, 'i') },
                { 'name.french': new RegExp(name, 'i') },
                { 'name.japanese': new RegExp(name, 'i') }
            ]
        });
        if (poke) {
            res.json(poke);
        } else {
            res.status(404).json({ error: 'Pokemon not found' });
        }
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// POST créer un nouveau pokemon
app.post('/pokemons', [
    body('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('name.english').trim().isLength({ min: 1, max: 50 }),
    body('name.french').optional().trim().isLength({ max: 50 }),
    body('name.japanese').optional().trim().isLength({ max: 50 }),
    body('name.chinese').optional().trim().isLength({ max: 50 }),
    body('type').isArray({ min: 1, max: 2 }),
    body('type.*').trim().isLength({ min: 1, max: 20 }),
    body('base.HP').isInt({ min: 1, max: 255 }),
    body('base.Attack').isInt({ min: 1, max: 255 }),
    body('base.Defense').isInt({ min: 1, max: 255 }),
    body('base.SpecialAttack').isInt({ min: 1, max: 255 }),
    body('base.SpecialDefense').isInt({ min: 1, max: 255 }),
    body('base.Speed').isInt({ min: 1, max: 255 }),
    body('image').isURL().withMessage('image must be a valid URL')
], handleValidation, async (req, res) => {
    try {
        const { id, name, type, base, image } = req.body;

        // Validation
        if (!id || !name || !type || !base || !image) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newPokemon = new pokemon({
            id,
            name,
            type,
            base,
            image
        });

        const saved = await newPokemon.save();
        res.status(201).json(saved);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT modifier un pokemon
app.put('/pokemons/:id', [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('name.english').optional().trim().isLength({ min: 1, max: 50 }),
    body('name.french').optional().trim().isLength({ max: 50 }),
    body('name.japanese').optional().trim().isLength({ max: 50 }),
    body('name.chinese').optional().trim().isLength({ max: 50 }),
    body('type').optional().isArray({ min: 1, max: 2 }),
    body('type.*').optional().trim().isLength({ min: 1, max: 20 }),
    body('base.HP').optional().isInt({ min: 1, max: 255 }),
    body('base.Attack').optional().isInt({ min: 1, max: 255 }),
    body('base.Defense').optional().isInt({ min: 1, max: 255 }),
    body('base.SpecialAttack').optional().isInt({ min: 1, max: 255 }),
    body('base.SpecialDefense').optional().isInt({ min: 1, max: 255 }),
    body('base.Speed').optional().isInt({ min: 1, max: 255 }),
    body('image').optional().trim().isLength({ min: 1 })
], handleValidation, async (req, res) => {
    try {
        const { name, type, base, image } = req.body;
        const pokemonId = req.params.id;

        const poke = await pokemon.findOneAndUpdate(
            { id: pokemonId },
            {
                ...(name && { name }),
                ...(type && { type }),
                ...(base && { base }),
                ...(image && { image })
            },
            { new: true, runValidators: true }
        );

        if (!poke) {
            return res.status(404).json({ error: 'Pokemon not found' });
        }

        res.json(poke);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE supprimer un pokemon
app.delete('/pokemons/:id', [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')
], handleValidation, async (req, res) => {
    try {
        const poke = await pokemon.findOneAndDelete({ id: req.params.id });

        if (!poke) {
            return res.status(404).json({ error: 'Pokemon not found' });
        }

        res.json({ message: 'Pokemon deleted successfully', pokemon: poke });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});