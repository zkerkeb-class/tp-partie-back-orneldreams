import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pokemon from '../schema/pokemon.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importData() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemon-db-2';
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    // Read the JSON file
    const filePath = path.join(__dirname, 'pokemons.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    console.log(`📦 Found ${data.length} Pokémons to import...`);

    // Update image URLs to use Railway API
    const railwayUrl = 'https://pokemon-pokedex-production-b5c1.up.railway.app';
    const updatedData = data.map(poke => ({
      ...poke,
      image: poke.image.replace('http://localhost:3000', railwayUrl)
    }));

    // Clear existing data
    await pokemon.deleteMany({});
    console.log('🗑️ Cleared existing data');

    // Insert new data
    const result = await pokemon.insertMany(updatedData);
    console.log(`✅ Successfully imported ${result.length} Pokémons!`);

    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error importing data:', error);
    process.exit(1);
  }
}

importData();
