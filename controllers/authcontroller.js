const User = require('../models/user');

// Display registration form
exports.getRegister = (req, res) => {
  res.render('auth/register', { title: 'Register' });
};

// Process registration
exports.postRegister = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    // Simple validation
    if (!username || !email || !password || !confirmPassword) {
      req.flash('error_msg', 'Please fill in all fields');
      return res.redirect('/auth/register');
    }

    if (password !== confirmPassword) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/auth/register');
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      req.flash('error_msg', 'User already exists with that email or username');
      return res.redirect('/auth/register');
    }

    // Create new user
    const user = new User({
      username,
      email,
      password
    });
    
    await user.save();
    req.flash('success_msg', 'Registration successful. You can now log in');
    res.redirect('/auth/login');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Server error');
    res.redirect('/auth/register');
  }
};

// Display login form
exports.getLogin = (req, res) => {
  res.render('auth/login', { title: 'Login' });
};

// Process login
exports.postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    // Set user in session
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email
    };

    req.flash('success_msg', 'You are now logged in');
    res.redirect('/quiz');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Server error');
    res.redirect('/auth/login');
  }
};

// Logout
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
};
