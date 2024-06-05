const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require("cors");
const app = express();
const jwt_secret = 'eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTcxNjk1NTUwOSwiaWF0IjoxNzE2OTU1NTA5fQ.27ULRvW_fhBdaOrgDyjWOlrMwtDeVRe-hcrc6f4JoM4';
const multer = require('multer');
const path = require('path');
const fs = require('fs');


app.use(cors({
  origin: 'https://vtsemp-back.onrender.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
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



// Mongoose Schema and Model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  id: { type: String, required: true },
  email: { type: String, required: true },
  mobile: { type: String, required: true },
  dob: { type: Date, required: true },
  doj: { type: Date, required: true },
  designation: { type: String, required: true },
  profilePhoto: { type: String },
  offerLetter: { type: String },
  password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

// Leave Schema
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
  const token = req.header('auth-token');
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
// app.post('/register', async (req, res) => {
//   const { username, password } = req.body;
//   const hashedPassword = await bcrypt.hash(password, 10);
//   try {
//     const user = new User({ username, password: hashedPassword });
//     await user.save();
//     res.status(201).send('User registered');
//   } catch (error) {
//     res.status(400).send('Error registering user');
//   }
// });


// File storage setup for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Routes
app.post('/register', upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'offerLetter', maxCount: 1 },
]), async (req, res) => {
  try {
    const { username, id, email, mobile, dob, doj, designation, password } = req.body;

    const user = new User({
      username,
      id,
      email,
      mobile,
      dob,
      doj,
      designation,
      profilePhoto: req.files['profilePhoto'] ? req.files['profilePhoto'][0].path : null,
      offerLetter: req.files['offerLetter'] ? req.files['offerLetter'][0].path : null,
      password,
    });

    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


app.get("/", (req, res) => {
  res.send("Hello from Express!");
});

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) {
    return res.status(400).send('Invalid credentials');
  }
  const isMatch = await compare(password, user.password);
  if (!isMatch) {
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

app.listen(4000, () => {
  console.log('Server is running on port 4000');
});
