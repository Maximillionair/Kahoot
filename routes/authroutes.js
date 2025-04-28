const express = require('express');
const router = express.Router();
const authController = require('../controllers/authcontroller');

// Registration routes
router.get('/register', authController.getRegister);
router.post('/register', authController.postRegister);

// Login routes
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);

// Logout route
router.get('/logout', authController.logout);

module.exports = router;
