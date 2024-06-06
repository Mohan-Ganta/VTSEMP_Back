const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
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
const userSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  phoneNo: { type: String, required: true },
  email: { type: String, required: true },
  empId: { type: String, required: true },
  designation: { type: String, required: true },
  profileUrl: { type: String, required: true },
  docUrl: { type: String, required: true },
  password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);



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
// app.post('/register', async (req, res) => {
//   const { username, password } = req.body;
//   try {
//     const user = new User({ username, password });
//     await user.save();
//     res.status(201).send('User registered');
//   } catch (error) {
//     res.status(400).send('Error registering user');
//   }
// });


app.post('/add', async (req, res) => {
  const { fullname, phoneNo, email, empId, designation, profileUrl, docUrl, password } = req.body;

  if (!fullname || !phoneNo || !email || !empId || !designation || !profileUrl || !docUrl || !password) {
      return res.status(400).json('All fields are required');
  }

  const newUser = new User({ fullname, phoneNo, email, empId, designation, profileUrl, docUrl, password });

  try {
      await newUser.save();
      res.status(200).json('User added successfully');
  } catch (err) {
      res.status(400).json('Error: ' + err.message);
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


// MongoDB Schema
const leaveSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  name: String,
  id: String,
  reason: String,
  status: { type: String, default: "Pending" },
});
const Leave = mongoose.model("Leave", leaveSchema);


//===================================//

const storage = multer.diskStorage({
  destination: "./src/assets/images",
  filename: (req, file, cb) => {
    return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage: storage });

app.post("/upload/images", upload.single("image"), (req, res) => {
  try {
    if (req.file) {
      console.log(`Uploaded image: ${req.file.filename}`);
      const imageUrl = `https://vtsemp-back.onrender.com/images/${req.file.filename}`;
      res.json({ message: "Image uploaded successfully!", image_url: imageUrl });
    } else {
      res.status(400).json({ message: "No image uploaded" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error uploading file" });
  }
});

app.use("/images", express.static("./src/assets/images"));



const docStorage = multer.diskStorage({
  destination: "./src/assets/docs",
  filename: (req, file, cb) => {
    return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
  },
});


const upload_doc = multer({ storage: docStorage });


app.post("/upload/doc", upload.single("file"), (req, res) => {
  try {
    if (req.file) {
      console.log(`Uploaded pdf: ${req.file.filename}`);
      const docUrl = `https://vtsemp-back.onrender.com/docs/${req.file.filename}`;
      res.json({ message: "Pdf uploaded successfully!", docurl: docUrl });
    } else {
      res.status(400).json({ message: "No pdf uploaded" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error uploading file" });
  }
});
app.use("/docs", express.static("./src/assets/images"));


//----------------------------------------- //

app.get("/", (req, res) => {
  res.send("Hello from VTS!");
});

// Login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
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


app.put('/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const dateTime = new Date().toLocaleString(); // Automatically set the current date and time
    const updatedAnnouncement = await Announcement.findByIdAndUpdate(
      id,
      { message, dateTime },
      { new: true }
    );
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


app.get("/leave", async (req, res) => {
  try {
    const leaveRequests = await Leave.find();
    res.json(leaveRequests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/leave", async (req, res) => {
  const leave = new Leave({
    name: req.body.name,
    id: req.body.id,
    reason: req.body.reason,
  });
  try {
    const newLeave = await leave.save();
    res.status(201).json(newLeave);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put("/leave/:id", async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (leave == null) {
      return res.status(404).json({ message: "Leave request not found" });
    }
    if (req.body.status) {
      leave.status = req.body.status;
    }
    const updatedLeave = await leave.save();
    res.json(updatedLeave);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});



app.listen(4000, () => {
  console.log('Server is running on port 4000');
});
