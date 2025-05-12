const User = require('../models/user');

// Display registration form
exports.getRegister = (req, res) => {
  res.render('auth/register', { title: 'Register' });
};

// Process registration
exports.postRegister = async (req, res) => {
  try {
    console.log('\n--- Registration Attempt ---');
    const { username, email, password, confirmPassword } = req.body;
    console.log('Registration data:', { username, email, passwordLength: password?.length });

    // Validation
    if (!username || !email || !password || !confirmPassword) {
      console.log('Validation failed: Missing fields');
      req.flash('error_msg', 'Please fill in all fields');
      return res.redirect('/auth/register');
    }

    if (password !== confirmPassword) {
      console.log('Validation failed: Passwords do not match');
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/auth/register');
    }

    if (password.length < 6) {
      console.log('Validation failed: Password too short');
      req.flash('error_msg', 'Password must be at least 6 characters long');
      return res.redirect('/auth/register');
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      console.log('Registration failed: User already exists');
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
    console.log('Registration successful:', { username, email });
    req.flash('success_msg', 'Registration successful. You can now log in');
    res.redirect('/auth/login');
  } catch (error) {
    console.error('Registration error:', error);
    req.flash('error_msg', error.message || 'Server error during registration');
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
    console.log('\n--- Login Attempt ---');
    const { email, password } = req.body;
    console.log('Login attempt for email:', email);

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('Login failed: User not found');
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.log('Login failed: Invalid password');
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    // Set user in session
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email
    };

    // Save session
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        req.flash('error_msg', 'Error during login');
        return res.redirect('/auth/login');
      }
      console.log('Login successful:', { username: user.username, email: user.email });
      req.flash('success_msg', 'You are now logged in');
      res.redirect('/quiz');
    });
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error_msg', 'Server error during login');
    res.redirect('/auth/login');
  }
};

// Logout
exports.logout = (req, res) => {
  console.log('\n--- Logout ---');
  console.log('User logging out:', req.session.user?.username);
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/');
    }
    res.redirect('/auth/login');
  });
};
