/**
 * seed.js — يضيف بيانات تجريبية للمتجر
 * الاستخدام: npm run seed
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product  = require('../models/Product');

const PLACEHOLDER = '/img/placeholder.png';

const categories = [
  { name: 'نوادر',    slug: 'nawadir',    order: 1 },
  { name: 'رجالي',   slug: 'rijali',     order: 2 },
  { name: 'نسائي',   slug: 'nisai',      order: 3 },
  { name: 'عود',     slug: 'oud',        order: 4 },
  { name: 'مميزة',   slug: 'mumayyaza',  order: 5 },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Clear existing
  await Category.deleteMany({});
  await Product.deleteMany({});

  // Insert categories
  const catDocs = await Category.insertMany(categories);
  const catMap  = Object.fromEntries(catDocs.map(c => [c.slug, c._id]));
  console.log('✅ Categories inserted');

  // Sample products
  const products = [
    {
      name: 'عود زحل امواج',
      description: 'عطر عودي فاخر بمزيج من العود النادر والمسك الأبيض',
      basePrice: 35000,
      sizes: [
        { label: '3 مل',  price: 12000 },
        { label: '5 مل',  price: 18000 },
        { label: '10 مل', price: 28000 },
        { label: '20 مل', price: 35000 },
      ],
      images: [PLACEHOLDER],
      category: catMap['nawadir'],
      tags: ['نوادر'],
      featured: true,
    },
    {
      name: 'لاكي ديور',
      description: 'عطر نسائي أنيق بنفحات زهرية خفيفة',
      basePrice: 15000,
      sizes: [
        { label: '5 مل',  price: 10000 },
        { label: '10 مل', price: 15000 },
      ],
      images: [PLACEHOLDER],
      category: catMap['nisai'],
      tags: ['جديد'],
      featured: true,
    },
    {
      name: 'كود كيرل كون باد كيليان',
      description: 'عطر مميز بخلطة شرقية غربية',
      basePrice: 22000,
      sizes: [
        { label: '5 مل',  price: 15000 },
        { label: '10 مل', price: 22000 },
      ],
      images: [PLACEHOLDER],
      category: catMap['mumayyaza'],
      tags: ['نوادر'],
      featured: true,
    },
    {
      name: 'امبر ليفانت لويس فيتون',
      description: 'من أرقى تشكيلات لويس فيتون، عبق فاخر بطابع شرقي',
      basePrice: 25000,
      sizes: [
        { label: '3 مل',  price: 12000 },
        { label: '5 مل',  price: 18000 },
        { label: '10 مل', price: 25000 },
      ],
      images: [PLACEHOLDER],
      category: catMap['nawadir'],
      tags: ['نوادر'],
      featured: true,
    },
    {
      name: 'اومبري نوماد لويس فيتون',
      description: 'عطر رجالي بشخصية قوية وخاصة',
      basePrice: 25000,
      sizes: [
        { label: '5 مل',  price: 18000 },
        { label: '10 مل', price: 25000 },
      ],
      images: [PLACEHOLDER],
      category: catMap['rijali'],
      tags: [],
      featured: false,
    },
    {
      name: 'لوستر امواج',
      description: 'تركيبة فريدة توازن بين الخشب والزهر',
      basePrice: 18000,
      sizes: [
        { label: '5 مل',  price: 12000 },
        { label: '10 مل', price: 18000 },
      ],
      images: [PLACEHOLDER],
      category: catMap['mumayyaza'],
      tags: [],
      featured: true,
    },
    {
      name: 'عود البخور الكلاسيكي',
      description: 'عود أصيل بنكهة تراثية عراقية',
      basePrice: 40000,
      sizes: [
        { label: '3 مل',  price: 15000 },
        { label: '5 مل',  price: 22000 },
        { label: '10 مل', price: 35000 },
        { label: '30 مل', price: 40000 },
      ],
      images: [PLACEHOLDER],
      category: catMap['oud'],
      tags: ['نوادر'],
      featured: true,
    },
    {
      name: 'ناكسوس زيرجوف',
      description: 'عطر طازج بمكونات تشجيرية فريدة',
      basePrice: 12000,
      sizes: [
        { label: '5 مل',  price: 8000  },
        { label: '10 مل', price: 12000 },
      ],
      images: [PLACEHOLDER],
      category: catMap['rijali'],
      tags: [],
      featured: false,
    },
  ];

  // Generate slugs and insert
  const productDocs = products.map((p, i) => ({
    ...p,
    slug: slugify(p.name) + '-' + (i + 1)
  }));

  await Product.insertMany(productDocs);
  console.log(`✅ ${productDocs.length} products inserted`);
  console.log('\n🎉 Seed completed! Visit http://localhost:6572');
  process.exit(0);
}

function slugify(text) {
  return text.trim().replace(/\s+/g, '-').replace(/[^\u0600-\u06FF\w-]/g, '').toLowerCase();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
