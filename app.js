const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- Scraper for Jumia using Cheerio ---
const scrapeJumia = async (searchQuery = 'electronics') => {
  const url = `https://www.jumia.com.ng/catalog/?q=${encodeURIComponent(searchQuery)}`;
  try {
    const { data: html } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $ = cheerio.load(html);
    const products = [];

    $('a.core').each((i, el) => {
      const title = $(el).find('h3.name').text().trim();
      const price = $(el).find('div.prc').text().trim();
      const image = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
      const description = title;

      if (title && price && image) {
        products.push({ title, price, image, description, source: 'jumia' });
      }
    });

    return products;
  } catch (err) {
    console.error('Jumia scrape error:', err.message);
    return [];
  }
};

// --- Scraper for Jiji using Puppeteer ---
const scrapeJiji = async (browser) => {
  const url = 'https://jiji.ng/search?query=electronics';
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const products = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a.-pVjz')).slice(0, 12).map(el => ({
        title: el.querySelector('div.-jGRmx')?.innerText || '',
        price: el.querySelector('div._7e09c')?.innerText || '',
        image: el.querySelector('img')?.src || '',
        description: el.querySelector('div.-jGRmx')?.innerText || '',
        source: 'jiji'
      }));
    });

    await page.close();
    return products;
  } catch (err) {
    console.error('Jiji scrape error:', err.message);
    return [];
  }
};

// --- Scraper for Konga using Puppeteer ---
const scrapeKonga = async (browser) => {
  const url = 'https://www.konga.com/search?search=electronics';
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const products = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a.product-block')).slice(0, 12).map(el => ({
        title: el.querySelector('.name')?.innerText || '',
        price: el.querySelector('.price')?.innerText || '',
        image: el.querySelector('img')?.src || '',
        description: el.querySelector('.name')?.innerText || '',
        source: 'konga'
      }));
    });

    await page.close();
    return products;
  } catch (err) {
    console.error('Konga scrape error:', err.message);
    return [];
  }
};

// --- Unified Endpoint ---
app.get('/api/products', async (req, res) => {
  try {
    const searchQuery = req.query.search || 'electronics';
    const browser = await puppeteer.launch({ headless: 'new' });

    const [jumiaData, jijiData, kongaData] = await Promise.all([
      scrapeJumia(searchQuery),
      scrapeJiji(browser),
      scrapeKonga(browser),
    ]);

    await browser.close();

    const allProducts = [...jumiaData, ...jijiData, ...kongaData];
    res.json({ total: allProducts.length, products: allProducts });
  } catch (err) {
    console.error('Unified scrape error:', err.message);
    res.status(500).json({ error: 'Failed to scrape all sources' });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(` scraper running at http://localhost:${PORT}/api/products`);
});
