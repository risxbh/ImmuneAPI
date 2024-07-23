const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const http = require("http");
const socketIo = require("socket.io");

const userRoutes = require("./routes/userRoutes");
const ageGroupRoutes = require("./routes/ageGroup");
const typeOfTreatment = require("./routes/typeOfTreatment");
const categoryRoutes = require("./routes/categoryRoutes");
const weekdayRoutes = require("./routes/weekdays");
const docterRoutes = require("./routes/docterRoutes");
const workingHours = require("./routes/workingHours");
const productRoutes = require("./routes/productRoutes");
const pharmaRoutes = require("./routes/pharmaRoutes");
const orderRoutes = require("./routes/orderRoutes");
const userReviewPosterRoutes = require("./routes/userReviewPosterRoutes");
const docterSpecRoutes = require("./routes/docterSpecRoutes");
const deliveryRoutes = require("./routes/deliveryPartner")

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST"],
  },
});
const port = 5000;

// Configure CORS to allow requests from specific origins
const corsOptions = {
  origin: ["https://immune-plus.netlify.app", 'http://localhost:8081', 'http://localhost:8082','http://localhost:3000','http://localhost:3001'],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

app.use("/users", userRoutes);
app.use("/ageGroups", ageGroupRoutes);
app.use("/typeOfTreatment", typeOfTreatment);
app.use(express.json());
app.use("/uploads", express.static("uploads")); // Serve uploaded files statically
app.use("/category", categoryRoutes);
app.use("/weekday", weekdayRoutes);
app.use("/docter", docterRoutes);
app.use("/workingHours", workingHours);
app.use("/product", productRoutes);
app.use("/pharma", pharmaRoutes);
app.use("/order", orderRoutes);
app.use("/userReviewPoster", userReviewPosterRoutes);
app.use("/docterSpec", docterSpecRoutes);
app.use("/delivery", deliveryRoutes);

io.on("connection", (socket) => {
  console.log("New client connected");
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

global.io = io;

mongoose
  .connect(
    "mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/ImmunePlus?retryWrites=true&w=majority",
  )
  .then(() => {
    console.log("Connected to MongoDB");
    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });
