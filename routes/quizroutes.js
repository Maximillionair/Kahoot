const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizqontroller');

// Apply authentication middleware to all quiz routes
router.use(quizController.isAuthenticated);

// Quiz routes
router.get('/', quizController.getQuizzes);
router.get('/create', quizController.getCreateQuiz);
router.post('/create', quizController.postCreateQuiz);
router.get('/edit/:id', quizController.getEditQuiz);
router.put('/edit/:id', quizController.putUpdateQuiz);
router.delete('/delete/:id', quizController.deleteQuiz);

module.exports = router;
