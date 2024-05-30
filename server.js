const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require("cors");
const app = express();
const jwt_secret= 'eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiOiJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTcxNjk1NTUwOSwiaWF0IjoxNzE2OTU1NTA5fQ.27ULRvW_fhBdaOrgDyjWOlrMwtDeVRe-hcrc6f4JoM4';

// Middleware
app.use(cors());
app.use(express.json());

// Logging Middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// MongoDB connection
mongoose.connect('mongodb+srv://mohan:mohan@vtsempd.mnlllbe.mongodb.net/?retryWrites=true&w=majority&appName=VTSEMPD', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('Error connecting to MongoDB', err);
});

// User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const User = mongoose.model('User', UserSchema);

// Session Schema
const SessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  loginTime: { type: Date, default: Date.now },
  logoutTime: { type: Date }
});

const Session = mongoose.model('Session', SessionSchema);

// Register route
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.status(201).send('User registered');
  } catch (error) {
    res.status(400).send('Error registering user');
  }
});

app.get('/',()=>{

  return res.status(200).send("Welcome to Backend");
})

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) {
    return res.status(400).send('Invalid credentials');
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).send('Invalid credentials');
  }
  const token = jwt.sign({ userId: user._id }, jwt_secret, { expiresIn: '1h' });

  // Record login time
  const session = new Session({ userId: user._id });
  await session.save();

  res.json({ token, sessionId: session._id });
});

// Logout route
app.post('/logout', async (req, res) => {
  const { sessionId } = req.body;

  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).send('Session not found');
    }

    session.logoutTime = new Date();
    await session.save();

    res.status(200).send('Logged out successfully');
  } catch (error) {
    res.status(500).send('Error logging out');
  }
});

// Get session info
app.get('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await Session.findById(sessionId).populate('userId', 'username email');
    if (!session) {
      return res.status(404).send('Session not found');
    }

    const loginTime = session.loginTime.toLocaleString();
    const logoutTime = session.logoutTime ? session.logoutTime.toLocaleString() : '-';
    const duration = session.logoutTime ? calculateDuration(session.loginTime, session.logoutTime) : '-';

    res.status(200).json({ loginTime, logoutTime, duration });
  } catch (error) {
    res.status(500).send('Error fetching session info');
  }
});

// Function to calculate duration
function calculateDuration(loginTime, logoutTime) {
  const diff = Math.abs(logoutTime - loginTime);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return `${hours}h ${minutes}m ${seconds}s`;
}

// Protected route
app.get('/dashboard', (req, res) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).send('Access denied');
  }
  try {
    const decoded = jwt.verify(token, jwt_secret);
    res.send('Welcome to your dashboard');
  } catch (error) {
    res.status(401).send('Invalid token');
  }
});

app.listen(4000, () => {
  console.log('Server is running on port 4000');
});
