// app.js
const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const methodOverride = require('method-override');

// Import routes
const authRoutes = require('./routes/authroutes');
const quizRoutes = require('./routes/quizroutes');
const gameRoutes = require('./routes/gameroutes');

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'kahoot-clone-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/kahoot-clone',
    ttl: 24 * 60 * 60 // 1 day
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

app.use(flash());

// Debug middleware
app.use((req, res, next) => {
  console.log('\n--- Request Debug Info ---');
  console.log('URL:', req.url);
  console.log('Method:', req.method);
  console.log('Session:', {
    user: req.session.user,
    tempPlayer: req.session.tempPlayer
  });
  console.log('Flash Messages:', {
    success: req.flash('success_msg'),
    error: req.flash('error_msg')
  });
  next();
});

// Global variables middleware
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.user = req.session.user || null;
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/quiz', quizRoutes);
app.use('/game', gameRoutes);

// Home route
app.get('/', (req, res) => {
  res.render('index', { title: 'Kahoot Clone' });
});

// 404 route
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

module.exports = app;