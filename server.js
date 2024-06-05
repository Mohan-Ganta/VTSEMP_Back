const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const jwt_secret = 'eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTcxNjk1NTUwOSwiaWF0IjoxNzE2OTU1NTA5fQ.27ULRvW_fhBdaOrgDyjWOlrMwtDeVRe-hcrc6f4JoM4';

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['*']
}));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

const leaveSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  reason: { type: String, required: true },
  status: { type: String, default: 'Pending' }
});

const Leave = mongoose.model('Leave', leaveSchema);

// User Log Schema
const userLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  loginTime: { type: Date, required: true, default: Date.now },
  logoutTime: { type: Date },
  workingTime: { type: Number }  // Working time in milliseconds
});

const UserLog = mongoose.model('UserLog', userLogSchema);

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization') && req.header('Authorization').split(' ')[1];
  if (!token) return res.status(401).send('Access denied');

  try {
    const verified = jwt.verify(token, jwt_secret);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).send('Invalid token');
  }
};

// Register route
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = new User({ username, password });
    await user.save();
    res.status(201).send('User registered');
  } catch (error) {
    res.status(400).send('Error registering user');
  }
});

// Task Schema
const taskSchema = new mongoose.Schema({
  projectName: String,
  deadline: Date,
  brief: String,
  projectLeader: String,
  projectMembers: [String],
  status: String
});

const Task = mongoose.model('Task', taskSchema);

app.get("/", (req, res) => {
  res.send("Hello from Express!");
});

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || user.password !== password) {
    return res.status(400).send('Invalid credentials');
  }
  const token = jwt.sign({ userId: user._id }, jwt_secret, { expiresIn: '1h' });

  // Record login time
  const userLog = new UserLog({ userId: user._id, loginTime: new Date() });
  await userLog.save();

  res.json({ token, logId: userLog._id });
});

// Logout route
app.post('/logout', verifyToken, async (req, res) => {
  const { logId } = req.body;

  try {
    const userLog = await UserLog.findById(logId);
    if (!userLog) {
      return res.status(404).send('Log not found');
    }

    userLog.logoutTime = new Date();
    userLog.workingTime = userLog.logoutTime - userLog.loginTime;
    await userLog.save();

    res.status(200).send('Logged out successfully');
  } catch (error) {
    res.status(500).send('Error logging out');
  }
});

// Attendance route
app.get('/attendance', verifyToken, async (req, res) => {
  try {
    const attendanceData = await UserLog.find().populate('userId', 'username');
    res.json(attendanceData);
  } catch (error) {
    res.status(500).send('Error fetching attendance data');
  }
});


// Create a new task
app.post('/tasks', async (req, res) => {
  try {
    const task = new Task(req.body);
    await task.save();
    res.status(201).send(task);
  } catch (error) {
    res.status(400).send(error);
  }
});

// Get all tasks
app.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.find();
    res.send(tasks);
  } catch (error) {
    res.status(500).send(error);
  }
});


app.listen(4000, () => {
  console.log('Server is running on port 4000');
});
