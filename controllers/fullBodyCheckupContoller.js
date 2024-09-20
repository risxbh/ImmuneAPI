const bcrypt = require("bcrypt");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const User = require("../models/User");
const DoctorAvailability = require("../models/Availability");
const Appointment = require("../models/Appointments");
const { sendDoctorNotification } = require("./Notification/docterNotification");
const { sendUserNotification } = require("./Notification/userNotification");

const url =
  "mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/?retryWrites=true&w=majority&appName=ImmunePlus";

let client = new MongoClient(url, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
});
let isConnected = false;

async function connectToDatabase() {
  if (!isConnected) {
    try {
      await client.connect();
      isConnected = true;
      console.log("Connected to the database");
    } catch (err) {
      console.error("Failed to connect to the database", err);
      throw err;
    }
  }
}

// Example usage of the connectToDatabase function
connectToDatabase()
  .then(() => {
    // You can perform database operations here
  })
  .catch((err) => {
    console.error("Error connecting to the database:", err);
  });

const storage = multer.memoryStorage();
const upload = multer({ storage });

const mongoose = require("mongoose");

async function bookAppointment(req, res) {
    try {
        await connectToDatabase();
        await client.connect();
        
        const { name, address, age, appointmentId,userId, dateofAppoinment } = req.body; // Get user data
        const db = client.db("ImmunePlus");
        const bookingCollection = db.collection("FullBodyBooking");
        const scheduleCollection = db.collection("FullBodySchedule");

        // Validate input fields
        let validations = [];
        if (!name) validations.push({ key: "name", message: "Name is required" });
        if(!userId) validations.push({ key: "userId", message: "UserId is required" });
        if (!address) validations.push({ key: "address", message: "Address is required" });
        if (!age) validations.push({ key: "age", message: "Age is required" });
        if (!dateofAppoinment) validations.push({ key: "dateofAppoinment", message: "Date of Appoinment is required" });
        if (!appointmentId) validations.push({ key: "appointmentId", message: "Appointment ID is required" });
        
        if (validations.length) {
            res.status(400).json({ status: "error", validations: validations });
            return;
        }

        // Check if the appointment is available
        const appointment = await scheduleCollection.findOne({ _id: parseInt(appointmentId) });

        if (!appointment) {
            res.status(404).json({ status: "error", message: "Appointment not found" });
            return;
        }

        if (appointment.availableSlots <= 0) {
            res.status(400).json({ status: "error", message: "No available slots for this appointment" });
            return;
        }

        // Deduct one slot from the available slots
        const updateResult = await scheduleCollection.updateOne(
            { _id: parseInt(appointmentId) },
            { $inc: { availableSlots: -1 } }
        );

        if (updateResult.modifiedCount > 0) {
            // Insert the booking into the FullBodyBooking collection
            const bookingResult = await bookingCollection.insertOne({
                name,
                address,
                age,
                appointmentId: parseInt(appointmentId),
                bookingDate: new Date(),
                userId,
                dateofAppoinment
            });

            if (bookingResult.acknowledged) {
                res.status(200).json({
                    status: "success",
                    message: "Appointment booked successfully",
                    appointmentDetails: {
                        name,
                        address,
                        age,
                        appointmentId,
                    }
                });
            } else {
                res.status(400).json({ status: "error", message: "Booking insertion failed" });
            }
        } else {
            res.status(400).json({ status: "error", message: "Failed to update available slots" });
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to book appointment", error: error.message });
    } finally {
        //await client.close();
    }
}

  
async function getBookingById(req, res) {
  try {
    await connectToDatabase();
    await client.connect();
    const { id } = req.query;
    const db = client.db("ImmunePlus");
    const appointmentsCollection = db.collection("FullBodyBooking");

    if (!id) {
      res
        .status(400)
        .json({ status: "error", message: "Booking ID is required" });
      return;
    }

    const appointment = await appointmentsCollection.findOne({
        _id: new ObjectId(id) // Use 'new' keyword with ObjectId
      });

    if (!appointment) {
      res.status(404).json({
        status: "error",
        message: "No appointment found for the given ID",
      });
      return;
    }

    res.status(200).json({ status: "success", appointment });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve appointment",
      error: error.message,
    });
  } finally {
    // await client.close();
  }
}

async function getBookingByDay(req, res) {
    //http://localhost:5000/fullBody/getBookingByDay?date=2024-09-25T00:00:00.000Z
    try {
      await connectToDatabase();
      await client.connect();
      const { date } = req.query; // Get the date from the query params
      const db = client.db("ImmunePlus");
      const appointmentsCollection = db.collection("FullBodyBooking");
  
      if (!date) {
        res.status(400).json({ status: "error", message: "Date is required" });
        return;
      }
  
      // Parse the date and set the time range for the entire day
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
  
      // Find all bookings on that day
      const bookings = await appointmentsCollection.find({
        dateofAppoinment: date
      }).toArray();
      
  
      if (bookings.length === 0) {
        res.status(404).json({
          status: "error",
          message: "No bookings found for the given day"
        });
        return;
      }
  
      res.status(200).json({
        status: "success",
        bookings
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to retrieve bookings for the day",
        error: error.message
      });
    } finally {
      //await client.close();
    }
  }
  

async function createSchedule(req, res) {
    try {
      await connectToDatabase();
      await client.connect();
      const { date, availableSlots } = req.body; // Only date and availableSlots
      const db = client.db("ImmunePlus");
      const collection = db.collection("FullBodySchedule");
      const countersCollection = db.collection("Counters");
  
      // Validate date and availableSlots
      let validations = [];
      if (!date) validations.push({ key: "date", message: "Date is required" });
      if (availableSlots === undefined) validations.push({ key: "availableSlots", message: "Available slots are required" });
  
      if (validations.length) {
        res.status(400).json({ status: "error", validations: validations });
        return;
      }
  
      // Check if a schedule for the given date exists
      const existingSchedule = await collection.findOne({
        date: new Date(date),
      });
  
      if (existingSchedule) {
        // Update the existing schedule if the date exists
        const updateResult = await collection.updateOne(
          { _id: existingSchedule._id },
          {
            $set: {
              availableSlots,
              // You can add more fields to update if necessary
            }
          }
        );
  
        if (updateResult.modifiedCount > 0) {
          res.status(200).json({
            status: "success",
            message: "Schedule updated successfully",
          });
        } else {
          res.status(400).json({ status: "error", message: "Update failed" });
        }
      } else {
        // Insert a new schedule if no existing date is found
        const counter = await countersCollection.findOneAndUpdate(
          { _id: "fullBodyScheduleId" },
          { $inc: { seq: 1 } },
          { upsert: true, returnDocument: "after" }
        );
        const newId = counter.seq;
  
        // Create new schedule record
        const newSchedule = {
          _id: newId,
          date: new Date(date),
          totalslots: availableSlots,
          availableSlots,
        };
  
        // Insert the new schedule
        const result = await collection.insertOne(newSchedule);
  
        if (result.acknowledged) {
          res.status(200).json({
            status: "success",
            message: "Schedule created successfully",
          });
        } else {
          res.status(400).json({ status: "error", message: "Creation failed" });
        }
      }
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to create or update schedule", error: error.message });
    } finally {
      //await client.close();
    }
  }
 

async function deleteSchedule(req, res) {
  try {
    const { id } = req.body;
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("FullBodySchedule");

    const result = await collection.deleteOne({ _id: parseInt(id) });

    if (result.deletedCount > 0) {
      res.status(200).json({ status: "success", message: "Schedule Deleted" });
    } else {
      res.status(400).json({ status: "error", message: "Delete failed" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete Schedule", error: error });
  }
}


async function getAvailableSchedule(req, res) {
    try {
      await connectToDatabase();  // Ensure the database is connected
      await client.connect();
  
      const db = client.db("ImmunePlus");
      const scheduleCollection = db.collection("FullBodySchedule");
  
      // Get today's date and set time to 00:00:00 for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);
  
      // Fetch all schedules that have a date today or later
      const availableSchedules = await scheduleCollection.find({
        date: { $gte: today } // Greater than or equal to today's date
      }).toArray();
  
      // Check if there are any schedules available
      if (availableSchedules.length === 0) {
        return res.status(404).json({
          status: "error",
          message: "No available schedules found"
        });
      }
  
      // Return the available schedules
      return res.status(200).json({
        status: "success",
        availableSchedules
      });
  
    } catch (error) {
      // Handle any errors
      return res.status(500).json({
        message: "Failed to retrieve available schedules",
        error: error.message
      });
    } finally {
      // Close the database connection if necessary
      // await client.close();
    }
  }
  
  
  module.exports = {
    bookAppointment,
    getBookingById,
    createSchedule,
    deleteSchedule,
    getAvailableSchedule, // Exporting correctly
    getBookingByDay
  };
  
