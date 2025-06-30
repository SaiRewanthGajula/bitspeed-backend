import express from 'express';
import identifyRouter from './identify';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json()); // Use Express's built-in JSON parser

// Optional root GET endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Bitespeed Backend! Use POST /identify to interact with the API.' });
});

app.use('/', identifyRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});