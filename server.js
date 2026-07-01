// Entry point untuk development lokal (npm run dev)
// Di Vercel, api/index.js yang dipakai langsung sebagai serverless function,
// dan folder public/ otomatis di-serve sebagai static assets oleh Vercel.
require('dotenv').config();
const path = require('path');
const express = require('express');
const app = require('./api/index');

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`OptikCerah jalan di http://localhost:${PORT}`);
});
