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

    const { name, address, age, appointmentId, userId, dateofAppointment, slotId } = req.body; // Get user data
    const db = client.db("ImmunePlus");
    const bookingCollection = db.collection("FullBodyBooking");
    const scheduleCollection = db.collection("FullBodySchedule");

    // Validate input fields
    let validations = [];
    if (!name) validations.push({ key: "name", message: "Name is required" });
    if (!userId) validations.push({ key: "userId", message: "UserId is required" });
    if (!address) validations.push({ key: "address", message: "Address is required" });
    if (!age) validations.push({ key: "age", message: "Age is required" });
    if (!dateofAppointment) validations.push({ key: "dateofAppointment", message: "Date of Appointment is required" });
    if (!appointmentId) validations.push({ key: "appointmentId", message: "Appointment ID is required" });
    if (!slotId) validations.push({ key: "slotId", message: "Slot ID is required" });

    if (validations.length) {
      res.status(400).json({ status: "error", validations: validations });
      return;
    }

    // Check if the appointment date exists
    const appointment = await scheduleCollection.findOne({ _id: parseInt(appointmentId) });

    if (!appointment) {
      res.status(404).json({ status: "error", message: "Appointment not found" });
      return;
    }

    // Find the specific time slot
    const slot = appointment.timeSlots.find((slot) => slot.id === slotId);

    if (!slot) {
      res.status(404).json({ status: "error", message: "Slot not found" });
      return;
    }

    if (slot.availableSlots <= 0) {
      res.status(400).json({ status: "error", message: "No available slots for this time slot" });
      return;
    }

    // Deduct one slot from the available slots of the specific time slot
    const updateResult = await scheduleCollection.updateOne(
      { _id: parseInt(appointmentId), "timeSlots.id": slotId },
      { $inc: { "timeSlots.$.availableSlots": -1 } }
    );

    if (updateResult.modifiedCount > 0) {
      // Insert the booking into the FullBodyBooking collection
      const bookingResult = await bookingCollection.insertOne({
        name,
        address,
        age,
        appointmentId: parseInt(appointmentId),
        slotId: slotId,
        bookingDate: new Date(),
        userId,
        dateofAppointment
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
            slotId
          }
        });
      } else {
        // If booking insertion fails, revert the slot update
        await scheduleCollection.updateOne(
          { _id: parseInt(appointmentId), "timeSlots.id": slotId },
          { $inc: { "timeSlots.$.availableSlots": 1 } }
        );
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
    const { id } = req.query; // Get booking ID from query

    if (!id) {
      res.status(400).json({ status: "error", message: "Booking ID is required" });
      return;
    }

    const db = client.db("ImmunePlus");
    const appointmentsCollection = db.collection("FullBodyBooking");

    // Find the booking by ID, converting the id string to an ObjectId
    const appointment = await appointmentsCollection.findOne({
      _id: new ObjectId(id) // Convert id to ObjectId for MongoDB query
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
    // await client.close(); // Commented out for now
  }
}

async function getBookingByDay(req, res) {
  try {
    await connectToDatabase();
    await client.connect();
    const { date } = req.query; // Get the date from query parameters

    if (!date) {
      res.status(400).json({ status: "error", message: "Date is required" });
      return;
    }

    const db = client.db("ImmunePlus");
    const appointmentsCollection = db.collection("FullBodyBooking");

    // Parse the date and set time range for the entire day
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    // Find all bookings on the given day
    const bookings = await appointmentsCollection.find({
      dateofAppointment: {
        $gte: startOfDay,
        $lte: endOfDay
      }
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
    // await client.close(); // Commented out for now
  }
}

async function createSchedule(req, res) {
  try {
    await connectToDatabase();
    await client.connect();
    const { date, timeSlots } = req.body; // date and timeSlots array from the request
    const db = client.db("ImmunePlus");
    const collection = db.collection("FullBodySchedule");
    const countersCollection = db.collection("Counters");

    // Validate date and timeSlots
    let validations = [];
    if (!date) validations.push({ key: "date", message: "Date is required" });
    if (!Array.isArray(timeSlots) || !timeSlots.length)
      validations.push({ key: "timeSlots", message: "Time slots are required and should be an array" });
    else {
      // Check each time slot object
      timeSlots.forEach((slot, index) => {
        if (!slot.time) validations.push({ key: `timeSlots[${index}].time`, message: "Time is required for each slot" });
        if (slot.totalSlots === undefined) validations.push({ key: `timeSlots[${index}].totalSlots`, message: "Total slots are required for each slot" });

        slot.availableSlots = slot.totalSlots;

        // Assign a unique ID to each time slot if it doesn't have one
        if (!slot.id) {
          slot.id = new ObjectId().toString(); // Use MongoDB ObjectId as a unique identifier
        }
      });
    }

    if (validations.length) {
      res.status(400).json({ status: "error", validations: validations });
      return;
    }

    // Check if a schedule for the given date exists
    const existingSchedule = await collection.findOne({
      date: new Date(date),
    });

    if (existingSchedule) {
      // Combine existing time slots with the new ones, maintaining unique IDs
      const updatedTimeSlots = existingSchedule.timeSlots || [];

      timeSlots.forEach(newSlot => {
        const index = updatedTimeSlots.findIndex(slot => slot.id === newSlot.id);
        if (index > -1) {
          // Update existing slot
          updatedTimeSlots[index] = { ...updatedTimeSlots[index], ...newSlot };
        } else {
          // Add new slot
          updatedTimeSlots.push(newSlot);
        }
      });

      // Update the existing schedule with new or updated time slots
      const updateResult = await collection.updateOne(
        { _id: existingSchedule._id },
        {
          $set: {
            timeSlots: updatedTimeSlots,
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
      const newId = counter ? counter.seq : 1;

      // Create new schedule record
      const newSchedule = {
        _id: newId,
        date: new Date(date),
        timeSlots,
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
    //await client.close(); // Commented out for debugging purposes
  }
}

async function deleteSchedule(req, res) {
  try {
    await connectToDatabase();

    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ status: "error", message: "Schedule ID is required" });
    }

    const db = client.db("ImmunePlus");
    const collection = db.collection("FullBodySchedule");

    // Convert id string to ObjectId
    const result = await collection.deleteOne({ _id: parseInt(id) });

    if (result.deletedCount > 0) {
      return res.status(200).json({ status: "success", message: "Schedule Deleted" });
    } else {
      return res.status(404).json({ status: "error", message: "Schedule not found" });
    }
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete Schedule", error: error.message });
  }
}

async function getAvailableSchedule(req, res) {
  try {
    await connectToDatabase();
    const db = client.db("ImmunePlus");
    const scheduleCollection = db.collection("FullBodySchedule");

    // Set today's date at midnight (00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch all schedules from today onwards
    const schedules = await scheduleCollection.find({
      date: { $gte: today }
    }).toArray();

    // Filter schedules with available time slots
    const availableSchedules = schedules
      .map(schedule => {
        if (Array.isArray(schedule.timeSlots)) {
          // Check if there are any time slots available
          const availableTimeSlots = schedule.timeSlots.filter(slot => slot.availableSlots > 0);
          // Return the schedule with available time slots or null if none are available
          return availableTimeSlots.length ? { ...schedule, timeSlots: availableTimeSlots } : null;
        }
        return null;
      })
      .filter(schedule => schedule !== null);

    // Check if no available schedules were found
    if (availableSchedules.length === 0) {
      return res.status(404).json({ status: "error", message: "No available schedules with free slots found" });
    }

    // Return the available schedules
    return res.status(200).json({ status: "success", availableSchedules });
  } catch (error) {
    // Handle errors and return a 500 response
    return res.status(500).json({ status: "error", message: "Failed to retrieve available schedules", error: error.message });
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

