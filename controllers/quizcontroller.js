const Quiz = require('../models/quiz');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  req.flash('error_msg', 'Please log in to access this page');
  res.redirect('/auth/login');
};

// List all quizzes
exports.getQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ $or: [
      { creator: req.session.user?.id },
      { isPublic: true }
    ]})
    .populate('creator', 'username')
    .sort({ createdAt: -1 });
    
    res.render('quiz/list', { 
      title: 'My Quizzes', 
      quizzes,
      userId: req.session.user?.id
    });
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error fetching quizzes');
    res.redirect('/');
  }
};

// Display quiz creation form
exports.getCreateQuiz = (req, res) => {
  res.render('quiz/create', { title: 'Create Quiz' });
};

// Process quiz creation
exports.postCreateQuiz = async (req, res) => {
  try {
    const { title, description, isPublic, questions } = req.body;
    
    // Parse questions from form
    const parsedQuestions = [];
    
    // For simplicity, assuming questions are passed correctly
    // In a real app, you'd need to handle this more robustly
    if (Array.isArray(questions)) {
      for (const q of questions) {
        parsedQuestions.push({
          question: q.question,
          options: q.options,
          correctAnswer: parseInt(q.correctAnswer),
          timeLimit: parseInt(q.timeLimit) || 20
        });
      }
    }
    
    const quiz = new Quiz({
      title,
      description,
      creator: req.session.user.id,
      questions: parsedQuestions,
      isPublic: isPublic === 'on'
    });
    
    await quiz.save();
    req.flash('success_msg', 'Quiz created successfully');
    res.redirect('/quiz');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error creating quiz');
    res.redirect('/quiz/create');
  }
};

// Display quiz edit form
exports.getEditQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      creator: req.session.user.id
    });
    
    if (!quiz) {
      req.flash('error_msg', 'Quiz not found or you do not have permission');
      return res.redirect('/quiz');
    }
    
    res.render('quiz/edit', { title: 'Edit Quiz', quiz });
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error fetching quiz');
    res.redirect('/quiz');
  }
};

// Process quiz update
exports.putUpdateQuiz = async (req, res) => {
  try {
    const { title, description, isPublic, questions } = req.body;
    
    // Parse questions similar to create
    const parsedQuestions = [];
    
    if (Array.isArray(questions)) {
      for (const q of questions) {
        parsedQuestions.push({
          question: q.question,
          options: q.options,
          correctAnswer: parseInt(q.correctAnswer),
          timeLimit: parseInt(q.timeLimit) || 20
        });
      }
    }
    
    const quiz = await Quiz.findOneAndUpdate(
      { _id: req.params.id, creator: req.session.user.id },
      {
        title,
        description,
        questions: parsedQuestions,
        isPublic: isPublic === 'on'
      },
      { new: true }
    );
    
    if (!quiz) {
      req.flash('error_msg', 'Quiz not found or you do not have permission');
      return res.redirect('/quiz');
    }
    
    req.flash('success_msg', 'Quiz updated successfully');
    res.redirect('/quiz');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error updating quiz');
    res.redirect('/quiz');
  }
};

// Delete quiz
exports.deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOneAndDelete({
      _id: req.params.id,
      creator: req.session.user.id
    });
    
    if (!quiz) {
      req.flash('error_msg', 'Quiz not found or you do not have permission');
      return res.redirect('/quiz');
    }
    
    req.flash('success_msg', 'Quiz deleted successfully');
    res.redirect('/quiz');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error deleting quiz');
    res.redirect('/quiz');
  }
};

// Make these middlewares available
exports.isAuthenticated = isAuthenticated;
