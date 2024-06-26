const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const wss = require('./controllers/webSocket');
const http = require('http');
const socketIo = require('socket.io');

const userRoutes = require('./routes/userRoutes');
const ageGroupRoutes = require('./routes/ageGroup');
const typeOfTreatment = require('./routes/typeOfTreatment')
const categoryRoutes = require('./routes/categoryRoutes');
const weekdayRoutes = require('./routes/weekdays')
const docterRoutes = require('./routes/docterRoutes')
const workingHours = require('./routes/workingHours')
const productRoutes = require('./routes/productRoutes')
const pharmaRoutes = require('./routes/pharmaRoutes')
const orderRoutes = require('./routes/orderRoutes')

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow all origins
        methods: ["GET", "POST"]
    }
});
const port = 5000;


app.use(bodyParser.json());
app.use(cors());

app.use('/users', userRoutes);
app.use('/ageGroups', ageGroupRoutes);
app.use('/typeOfTreatment', typeOfTreatment);
app.use(express.json());
app.use('/uploads', express.static('uploads')); // Serve uploaded files statically
app.use('/category', categoryRoutes);
app.use('/weekday', weekdayRoutes);
app.use('/docter', docterRoutes);
app.use('/workingHours', workingHours);
app.use('/product', productRoutes);
app.use('/pharma', pharmaRoutes);
app.use('/order', orderRoutes);

io.on('connection', (socket) => {
    console.log('New client connected');
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
  
  global.io = io;
  
  server.listen(5000, () => {
    console.log('Server is running on port 5000');
  });

// mongoose.connect('mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/ImmunePlus?retryWrites=true&w=majority', {
//     useNewUrlParser: true,
//     useUnifiedTopology: true
// }).then(() => {
//     console.log('Connected to MongoDB');
//     app.listen(port, () => {
//         console.log(`Server running on port ${port}`);
//     });
// }).catch(err => {
//     console.error('Failed to connect to MongoDB', err);
// });

// app.listen(port, '0.0.0.0', () => {
//     console.log(`Server is running on port ${port}`);
// });


