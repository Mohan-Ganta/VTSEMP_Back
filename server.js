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

// Define Counter schema and model
const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

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

const announcementSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
  },
  dateTime: {
    type: String,
    required: true,
  },
}, { timestamps: true });

const Announcement = mongoose.model('Announcement', announcementSchema);

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

// Attendance route for a specific user :userId
app.get('/attendance/', verifyToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const attendanceData = await UserLog.find({ userId }).populate('userId', 'username');
    res.json(attendanceData);
  } catch (error) {
    res.status(500).send('Error fetching attendance data');
  }
});



// Initialize counter
const initializeCounter = async () => {
  const counter = await Counter.findOne({ name: 'taskId' });
  if (!counter) {
    await new Counter({ name: 'taskId', seq: 0 }).save();
  }
};

// Get next sequence value
const getNextSequenceValue = async (sequenceName) => {
  const counter = await Counter.findOneAndUpdate(
    { name: sequenceName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

// Create a new task
app.post('/tasks', async (req, res) => {
  try {
    const nextId = await getNextSequenceValue('taskId');
    const task = new Task({ ...req.body, id: nextId });
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

// Delete task by Name
// app.delete('/tasks/:projectName', async (req, res) => {
//   const { projectName } = req.params;
//   try {
//     const task = await Task.findOneAndDelete({ projectName });
//     if (!task) {
//       return res.status(404).send({ message: 'Task not found' });
//     }
//     res.send({ message: 'Task deleted successfully' });
//   } catch (error) {
//     res.status(500).send(error);
//   }
// });


// Delete task by ID
app.delete('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const task = await Task.findOneAndDelete({ id: parseInt(id) });
    if (!task) {
      return res.status(404).send({ message: 'Task not found' });
    }
    res.send({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).send(error);
  }
});


// Create Announcement
app.post('/announcements', async (req, res) => {
  try {
    const { message, dateTime } = req.body;
    const newAnnouncement = new Announcement({ message, dateTime });
    const savedAnnouncement = await newAnnouncement.save();
    res.status(201).json({ success: true, announcement: savedAnnouncement });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get All Announcements
app.get('/announcements', async (req, res) => {
  try {
    const announcements = await Announcement.find();
    res.status(200).json({ success: true, announcements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Announcement
app.put('/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, dateTime } = req.body;
    const updatedAnnouncement = await Announcement.findByIdAndUpdate(id, { message, dateTime }, { new: true });
    res.status(200).json({ success: true, announcement: updatedAnnouncement });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete Announcement
app.delete('/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Announcement.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Announcement deleted successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});



app.listen(4000, () => {
  console.log('Server is running on port 4000');
});
