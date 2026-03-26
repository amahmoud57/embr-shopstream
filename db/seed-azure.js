#!/usr/bin/env node
/**
 * ShopStream Azure PG Seed Script
 * Seeds ~1M rows into an external PostgreSQL database
 * Usage: DATABASE_URL="postgresql://..." node db/seed-azure.js
 */

const { Client } = require('pg');
const { Readable } = require('stream');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Data generators
const firstNames = ['James','Emma','Liam','Olivia','Noah','Ava','Ethan','Sophia','Mason','Isabella','Lucas','Mia','Logan','Charlotte','Alex','Amelia','Jack','Harper','Owen','Ella','Aiden','Abigail','Jackson','Emily','Sebastian','Madison','Mateo','Luna','Henry','Chloe','Benjamin','Penelope','Daniel','Layla','William','Riley','Michael','Zoey','Alexander','Nora'];
const lastNames = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Wilson','Anderson','Taylor','Thomas','Moore','Martin','Lee','Clark','Lewis','Walker','Hall','Young','Allen','King','Wright','Scott','Torres','Hill','Green','Adams','Baker','Nelson'];
const cities = ['New York','Los Angeles','Chicago','Houston','Phoenix','San Diego','Dallas','Austin','Seattle','Denver','Portland','Miami','Atlanta','Boston','Nashville','Detroit','Minneapolis','San Francisco','Philadelphia','Charlotte','Tampa','Orlando','Indianapolis','Columbus','San Jose'];
const countries = ['US','US','US','US','US','CA','CA','UK','UK','DE'];
const adjectives = ['Pro','Ultra','Elite','Essential','Classic','Nano','Max','Lite','Prime','Core','Studio','Edge','Flex','Swift','Zen','Bold','Pure','Apex','Nova','Spark','Turbo','Vivid','Sleek','Artisan','Quantum'];
const productTypes = ['Wireless Headphones','Running Shoes','Desk Lamp','Backpack','Water Bottle','Phone Case','Yoga Mat','Coffee Maker','Notebook','Sunglasses','Keyboard','T-Shirt','Face Cream','Camping Tent','Wall Art','Smart Watch','Sneakers','Throw Pillow','Resistance Bands','Lip Balm','Monitor Stand','Hoodie','Candle Set','Dumbbell Set','Serum','USB-C Hub','Jacket','Plant Pot','Jump Rope','Tote Bag','Webcam','Joggers','Bookshelf','Foam Roller','Moisturizer','Power Bank','Beanie','Table Runner','Kettlebell','Cleanser','Desk Mat','Polo Shirt','Door Mat','Ab Wheel','Hair Oil','Charger Cable','Scarf','Mirror','Pull-Up Bar','Eye Cream'];
const reviewTitles = ['Love it!','Great value','Exceeded expectations','Solid purchase','Would buy again','Pretty good','Decent quality','Nice product','Impressive','Highly recommend','Good but pricey','Perfect gift','Better than expected','Five stars','Very happy','Works great','Top notch','Fantastic quality','Just okay','Worth every penny'];
const reviewBodies = [
  'This product has been amazing for daily use. The quality is outstanding and it arrived quickly.',
  'Really impressed with the build quality. Exactly what I needed for my home office setup.',
  'Great value for the price. I have been using it for a few weeks now and it holds up well.',
  'The design is sleek and modern. Gets compliments every time someone sees it on my desk.',
  'Purchased as a gift and the recipient loved it. Would definitely buy from this vendor again.',
  'Solid product overall. Minor issues with packaging but the item itself is in perfect condition.',
  'Compared several options before buying this one. No regrets, this was the right choice.',
  'Fast shipping and the product matched the description exactly. Very satisfied with purchase.',
  'This is my second purchase from this vendor. Consistent quality and reliable every time.',
  'Good product for the price range. Does exactly what it claims to do, nothing more nothing less.',
];
const vendorNames = ['TechNova','Urban Threads','HomeHaven','FitForge','PureGlow','PageBound','ByteGear','GreenRoot','LittleLeap','TrailEdge','PixelCraft','SunVista','AquaPure','NeonWorks','VelvetLine','IronPeak','CloudNine','FrostByte','EcoBloom','SwiftEdge','CopperTone','BlueShift','FireLight','StoneBase','MoonRise','StarField','GoldLeaf','SilkPath','WindCrest','DeepBlue','ThunderBolt','SilverLine','OakBridge','RiverStone','SkyPeak','CedarWood','MarbleTech','PineCone','CoralReef','TidalWave','SolarFlare','ArcticFox','DesertSun','JungleVine','VolcanoAsh','GlacierIce','PrairieWind','CanyonRock','MeadowGrass','HarborView'];
const categories = [
  { name: 'Electronics', slug: 'electronics', parent_id: null, icon: '🔌' },
  { name: 'Clothing', slug: 'clothing', parent_id: null, icon: '👕' },
  { name: 'Home & Garden', slug: 'home-garden', parent_id: null, icon: '🏠' },
  { name: 'Sports & Fitness', slug: 'sports-fitness', parent_id: null, icon: '🏋️' },
  { name: 'Beauty', slug: 'beauty', parent_id: null, icon: '✨' },
  { name: 'Books & Office', slug: 'books-office', parent_id: null, icon: '📚' },
  { name: 'Toys & Games', slug: 'toys-games', parent_id: null, icon: '🎮' },
  { name: 'Food & Drink', slug: 'food-drink', parent_id: null, icon: '🍕' },
  { name: 'Phones & Tablets', slug: 'phones-tablets', parent_id: 1, icon: '📱' },
  { name: 'Laptops & PCs', slug: 'laptops-pcs', parent_id: 1, icon: '💻' },
  { name: 'Audio', slug: 'audio', parent_id: 1, icon: '🎧' },
  { name: "Men's Fashion", slug: 'mens-fashion', parent_id: 2, icon: '👔' },
  { name: "Women's Fashion", slug: 'womens-fashion', parent_id: 2, icon: '👗' },
  { name: 'Furniture', slug: 'furniture', parent_id: 3, icon: '🛋️' },
  { name: 'Kitchen', slug: 'kitchen', parent_id: 3, icon: '🍳' },
  { name: 'Outdoor Gear', slug: 'outdoor-gear', parent_id: 4, icon: '⛺' },
  { name: 'Skincare', slug: 'skincare', parent_id: 5, icon: '🧴' },
  { name: 'Stationery', slug: 'stationery', parent_id: 6, icon: '✏️' },
  { name: 'Board Games', slug: 'board-games', parent_id: 7, icon: '🎲' },
  { name: 'Accessories', slug: 'accessories', parent_id: 2, icon: '👜' },
  { name: 'Cameras', slug: 'cameras', parent_id: 1, icon: '📷' },
  { name: 'Garden Tools', slug: 'garden-tools', parent_id: 3, icon: '🌱' },
  { name: 'Yoga', slug: 'yoga', parent_id: 4, icon: '🧘' },
  { name: 'Makeup', slug: 'makeup', parent_id: 5, icon: '💄' },
  { name: 'Snacks', slug: 'snacks', parent_id: 8, icon: '🍿' },
  { name: 'Beverages', slug: 'beverages', parent_id: 8, icon: '☕' },
  { name: 'Smart Home', slug: 'smart-home', parent_id: 1, icon: '🏡' },
  { name: 'Outdoor Clothing', slug: 'outdoor-clothing', parent_id: 2, icon: '🧥' },
  { name: 'Lighting', slug: 'lighting', parent_id: 3, icon: '💡' },
  { name: 'Supplements', slug: 'supplements', parent_id: 4, icon: '💊' },
];
const orderStatuses = ['pending','confirmed','processing','shipped','delivered','delivered','delivered','delivered'];
const inventoryTypes = ['restock','sale','return','adjustment'];
const inventoryReasons = ['Supplier shipment received','Customer purchase','Customer return - defective','Cycle count adjustment','Warehouse transfer','Bulk order fulfilled','Quality inspection removal','Promotional restock'];

function pick(arr, seed) { return arr[seed % arr.length]; }

async function batchInsert(table, columns, rows, batchSize = 5000) {
  const colStr = columns.join(',');
  const total = rows.length;
  let inserted = 0;
  while (inserted < total) {
    const batch = rows.slice(inserted, inserted + batchSize);
    const values = [];
    const placeholders = [];
    let idx = 1;
    for (const row of batch) {
      const ph = [];
      for (const val of row) {
        ph.push('$' + idx++);
        values.push(val);
      }
      placeholders.push('(' + ph.join(',') + ')');
    }
    await client.query(`INSERT INTO ${table} (${colStr}) VALUES ${placeholders.join(',')} ON CONFLICT DO NOTHING`, values);
    inserted += batch.length;
    process.stdout.write(`\r  ${table}: ${inserted.toLocaleString()} / ${total.toLocaleString()}`);
  }
  console.log();
}

async function seed() {
  console.log('Connecting to database...');
  await client.connect();
  console.log('Connected. Starting seed...\n');

  // Apply schema
  const fs = require('fs');
  const path = require('path');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await client.query(schema);
  console.log('Schema applied.\n');

  // Truncate
  console.log('Clearing existing data...');
  await client.query('TRUNCATE inventory_events, reviews, order_items, orders, products, customers, categories, vendors RESTART IDENTITY CASCADE');
  console.log('Done.\n');

  // Vendors (50)
  console.log('Seeding vendors...');
  const vendorRows = [];
  for (let i = 0; i < 50; i++) {
    const name = vendorNames[i];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    vendorRows.push([name, slug, `${slug}@example.com`, `Premium ${pick(productTypes, i).toLowerCase()} and more. Quality products for discerning customers.`, null, (35 + (i * 7) % 15) / 10]);
  }
  await batchInsert('vendors', ['name','slug','email','description','logo_url','rating'], vendorRows);

  // Categories (30)
  console.log('Seeding categories...');
  const catRows = categories.map(c => [c.name, c.slug, c.parent_id, c.icon]);
  await batchInsert('categories', ['name','slug','parent_id','icon'], catRows);

  // Products (100,000)
  console.log('Seeding products (100k)...');
  const prodRows = [];
  for (let i = 1; i <= 100000; i++) {
    const vendorId = (i % 50) + 1;
    const catId = (i % 30) + 1;
    const adj = pick(adjectives, i);
    const type = pick(productTypes, i + 7);
    const name = `${adj} ${type} ${i <= 50000 ? 'V2' : ''} #${i}`.trim();
    const slug = `product-${i}`;
    const price = 500 + (i * 137) % 25000;
    const comparePrice = i % 3 === 0 ? price + 1000 + (i % 5000) : null;
    const stock = 5 + (i * 7) % 300;
    const rating = (25 + (i * 13) % 26) / 10;
    const reviewCount = (i * 3) % 80;
    const daysAgo = i % 730;
    prodRows.push([vendorId, catId, name, slug, 'High-quality product crafted with care. Perfect for everyday use. Made with premium materials.', price, comparePrice, `SKU-${String(i).padStart(7,'0')}`, stock, true, rating, reviewCount, new Date(Date.now() - daysAgo * 86400000).toISOString()]);
  }
  await batchInsert('products', ['vendor_id','category_id','name','slug','description','price_cents','compare_price_cents','sku','stock_qty','is_active','rating_avg','review_count','created_at'], prodRows, 2000);

  // Customers (200,000)
  console.log('Seeding customers (200k)...');
  const custRows = [];
  for (let i = 1; i <= 200000; i++) {
    const fn = pick(firstNames, i);
    const ln = pick(lastNames, i + 3);
    custRows.push([fn, ln, `user${i}@example.com`, pick(cities, i + 5), pick(countries, i), new Date(Date.now() - (i % 730) * 86400000).toISOString()]);
  }
  await batchInsert('customers', ['first_name','last_name','email','city','country','created_at'], custRows, 5000);

  // Orders (500,000)
  console.log('Seeding orders (500k)...');
  const orderRows = [];
  for (let i = 1; i <= 500000; i++) {
    const custId = (i % 200000) + 1;
    const status = pick(orderStatuses, i);
    const sub = 1000 + (i * 173) % 50000;
    const tax = Math.round(sub * 0.08);
    const ship = sub > 5000 ? 0 : 599;
    orderRows.push([custId, status, sub, tax, ship, sub + tax + ship, '123 Main St, Anytown, US 12345', new Date(Date.now() - (i % 365) * 86400000).toISOString()]);
  }
  await batchInsert('orders', ['customer_id','status','subtotal_cents','tax_cents','shipping_cents','total_cents','shipping_address','created_at'], orderRows, 5000);

  // Order Items (1,000,000)
  console.log('Seeding order items (1M)...');
  const oiRows = [];
  for (let i = 1; i <= 1000000; i++) {
    const orderId = Math.floor((i - 1) / 2) + 1; // ~2 items per order
    if (orderId > 500000) break;
    const prodId = (i % 100000) + 1;
    const vendorId = (prodId % 50) + 1;
    const qty = 1 + (i % 4);
    const price = 500 + (prodId * 137) % 25000;
    oiRows.push([orderId, prodId, vendorId, qty, price, price * qty]);
  }
  await batchInsert('order_items', ['order_id','product_id','vendor_id','quantity','unit_price_cents','total_cents'], oiRows, 5000);

  // Reviews (200,000)
  console.log('Seeding reviews (200k)...');
  const revRows = [];
  for (let i = 1; i <= 200000; i++) {
    const prodId = (i % 100000) + 1;
    const custId = (i % 200000) + 1;
    const rating = 2 + (i % 4); // 2-5
    revRows.push([prodId, custId, rating, pick(reviewTitles, i), pick(reviewBodies, i), i % 3 === 0, new Date(Date.now() - (i % 365) * 86400000).toISOString()]);
  }
  await batchInsert('reviews', ['product_id','customer_id','rating','title','body','is_verified','created_at'], revRows, 5000);

  // Inventory events (50,000)
  console.log('Seeding inventory events (50k)...');
  const invRows = [];
  for (let i = 1; i <= 50000; i++) {
    const prodId = (i % 100000) + 1;
    const type = pick(inventoryTypes, i);
    let delta;
    switch (type) {
      case 'restock': delta = 20 + (i % 100); break;
      case 'sale': delta = -(1 + (i % 8)); break;
      case 'return': delta = 1 + (i % 3); break;
      default: delta = (i % 20) - 10;
    }
    invRows.push([prodId, type, delta, pick(inventoryReasons, i), new Date(Date.now() - (i % 180) * 86400000).toISOString()]);
  }
  await batchInsert('inventory_events', ['product_id','event_type','quantity_delta','reason','created_at'], invRows, 5000);

  console.log('\nSeed complete!');
  console.log('  Vendors:          50');
  console.log('  Categories:       30');
  console.log('  Products:         100,000');
  console.log('  Customers:        200,000');
  console.log('  Orders:           500,000');
  console.log('  Order Items:      ~1,000,000');
  console.log('  Reviews:          200,000');
  console.log('  Inventory Events: 50,000');

  await client.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  client.end().catch(() => {});
  process.exit(1);
});
