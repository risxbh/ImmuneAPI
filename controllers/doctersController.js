const bcrypt = require('bcrypt');
const { MongoClient, ServerApiVersion } = require('mongodb');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const DoctorAvailability = require('../models/Availability');
const Appointment = require('../models/Appointments');

const url = 'mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/?retryWrites=true&w=majority&appName=ImmunePlus';

let client = new MongoClient(url, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
        useNewUrlParser: true,
        useUnifiedTopology: true
    }
});

let isConnected = false;

async function connectToDatabase() {
    if (!isConnected) {
        try {
            await client.connect();
            isConnected = true;
            console.log('Connected to the database');
        } catch (err) {
            console.error('Failed to connect to the database', err);
            throw err;
        }
    }
}

// Example usage of the connectToDatabase function
connectToDatabase().then(() => {
    // You can perform database operations here
}).catch(err => {
    console.error('Error connecting to the database:', err);
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

const mongoose = require('mongoose');

async function bookAppointment(req, res) {
    try {
        await connectToDatabase();
        await client.connect();
        const { scheduleId, patientId, type } = req.body;
        const db = client.db("ImmunePlus");
        const availabilitiesCollection = db.collection("doctoravailabilities");
        const appointmentsCollection = db.collection("appointments");
        const countersCollection = db.collection("Counters");

        // Validate input
        if (!scheduleId || !patientId || !type) {
            res.status(400).json({ status: 'error', message: 'Schedule ID, Type of Appointment and patient name are required' });
            return;
        }

        // Find the schedule by its ID
        const schedule = await availabilitiesCollection.findOne({
            _id: scheduleId
        });

        if (!schedule) {
            res.status(404).json({ status: 'error', message: 'No schedule found for the given ID' });
            return;
        }

        // Check if there are available slots
        if (schedule.availableSlots <= 0) {
            res.status(400).json({ status: 'error', message: 'No available slots for the given time' });
            return;
        }

        // Decrement the available slots
        if(type ==1){
        await availabilitiesCollection.updateMany(
            { _id: schedule._id },
            { $inc: { availableSlots: -1, bookedClinic: +1 } }
        );
    }else{
        await availabilitiesCollection.updateMany(
            { _id: schedule._id },
            { $inc: { availableSlots: -1, bookedVideo: +1 } }
        );
    }

        // Create the appointment record
        const counter = await countersCollection.findOneAndUpdate(
            { _id: "bookingId" },
            { $inc: { seq: 1 } },
            { upsert: true, returnDocument: 'after' }
        );
        const newId = counter.seq;
        const appointment = {
            _id: newId,
            scheduleId: schedule._id,
            doctorId: schedule.doctorId,
            date: schedule.date,
            time: schedule.time,
            patientId: patientId,
            type:type
        };

        const result = await appointmentsCollection.insertOne(appointment);

        if (result.acknowledged === true) {
            res.status(200).json({ status: 'success', message: 'Appointment booked successfully', bookingId: newId });
        } else {
            res.status(400).json({ status: 'error', message: 'Failed to book appointment' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to book appointment', error: error.message });
    } finally {
        // await client.close();
    }
}

module.exports = bookAppointment;

async function registerDoctor(req, res) {
    const { name, hospital, about, type, patients, experience, rating, location, specialist, videoFee, appointmentFee, email, password,workinghours } = req.body;
    let validations = [];
    let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;
    let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    let passwordMessage = '';

    if (password) {
        if (password.length < 8 || password.length > 20) {
            passwordMessage = 'Password should be between 8 to 20 characters.';
        } else {
            if (!regex.test(password)) {
                passwordMessage = 'Password should contain at least one number, one special character, and one uppercase letter.';
            }
        }
    } else {
        passwordMessage = 'Password is required.';
    }

    if (passwordMessage) {
        validations.push({ key: 'password', message: passwordMessage });
    }

    if (!password) validations.push({ key: 'password', message: 'Password is required' });
    if (!req.file || !req.file.buffer) validations.push({ key: 'img', message: 'Image is required' });
    if (!email) validations.push({ key: 'email', message: 'Email is required' });
    else if (!emailRegex.test(email)) validations.push({ key: 'email', message: 'Email is not valid' });
    if (!name) validations.push({ key: 'name', message: 'Name is required' });
    if (!hospital) validations.push({ key: 'hospital', message: 'Hospital is required' });
    if (!about) validations.push({ key: 'about', message: 'About is required' });
    if (!type) validations.push({ key: 'type', message: 'Type is required' });
    if (!patients) validations.push({ key: 'patients', message: 'Patients is required' });
    if (!experience) validations.push({ key: 'experience', message: 'Experience is required' });
    if (!specialist) validations.push({ key: 'specialist', message: 'specialist is required' });
    if (!videoFee) validations.push({ key: 'videoFee', message: 'Video Fee is required' });
    if (!appointmentFee) validations.push({ key: 'appointmentFee', message: 'Appointment Fee is required' });
    if (!location) validations.push({ key: 'location', message: 'Location is required' });
    if (!workinghours) validations.push({ key: 'workinghours', message: 'Working Hours is required' });

    if (validations.length) {
        res.status(400).json({ status: 'error', validations: validations });
        return;
    }

    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Doctors");
        const countersCollection = db.collection("Counters");
        const workingHoursCollection = db.collection("WorkingHours");
        const workingDaysCollection = db.collection("Weekdays");

        const existingUser = await collection.findOne({ email });

        if (existingUser) {
            res.status(400).json({ status: 'error', message: 'Email already exists' });
        } else {
            const filePath = path.join('uploads/doctor', req.file.originalname);
            if (!fs.existsSync('uploads/doctor')) {
                fs.mkdirSync('uploads/doctor', { recursive: true });
            }
            fs.writeFileSync(filePath, req.file.buffer);
            const hashedPassword = await bcrypt.hash(password, 10);

            const counter = await countersCollection.findOneAndUpdate(
                { _id: "doctorId" },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
            const newId = counter.seq;

            // Parse workinghours and workingDays as arrays of integers
            // const parsedWorkingHours = workinghours.split(',').map(Number);
            // const parsedWorkingDays = workingDays.split(',').map(Number);
            // const parsedAvailableSlots = availableSlots.split(',').map(Number);

            // const workingHoursData = await workingHoursCollection.find({ _id: { $in: parsedWorkingHours } }).toArray();
            // const workingDaysData = await workingDaysCollection.find({ _id: { $in: parsedWorkingDays } }).toArray();

            // const workingHoursNames = workingHoursData.map(item => item.name);
            // const workingDaysIndexes = workingDaysData.map(item => item.name);

            const result = await collection.insertOne({
                password: hashedPassword,
                name, hospital, about, type, patients, experience, rating, location, specialist, videoFee, appointmentFee, email,workinghours,
                _id: newId
            });

            if (result.acknowledged === true) {
                return res.status(200).json({ status: 'success', message: 'Doctor registered successfully' });
            } else {
                res.status(400).json({ status: 'error', message: 'Registration failed' });
            }
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred during registration', reason: error.message });
    } finally {
        //await client.close();
    }
}

async function createSchedule(req, res) {
    try {
        await connectToDatabase();
        await client.connect();
        const { doctorId, date, workingHours, availableSlots } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("doctoravailabilities");
        const countersCollection = db.collection("Counters");

        // Validations
        let validations = [];
        if (!doctorId) validations.push({ key: 'doctorId', message: 'Doctor ID is required' });
        if (!date) validations.push({ key: 'date', message: 'Date is required' });
        if (!workingHours || !Array.isArray(workingHours) || !workingHours.length) validations.push({ key: 'workingHours', message: 'Working hours are required and should be a non-empty array' });
        if (!availableSlots || !Array.isArray(availableSlots) || !availableSlots.length) validations.push({ key: 'availableSlots', message: 'Available slots are required and should be a non-empty array' });
        if (workingHours && availableSlots && workingHours.length !== availableSlots.length) validations.push({ key: 'mismatch', message: 'Working hours and available slots arrays must have the same length' });

        if (validations.length) {
            res.status(400).json({ status: 'error', validations: validations });
            return;
        }
        const incrementAmount = workingHours.length;
        const counter = await countersCollection.findOneAndUpdate(
            { _id: "scheduleId" },
            { $inc: { seq: incrementAmount  } },
            { upsert: true, returnDocument: 'after' }
        );
        const newId = counter.seq;
        const baseId = counter.seq - incrementAmount + 1;

        // Create schedule records
        const scheduleRecords = workingHours.map((time, index) => ({
            _id: baseId + index,
            doctorId,
            date: new Date(date),
            time,
            availableSlots: availableSlots[index],
            totalslots:  availableSlots[index],
            bookedClinic: 0,
            bookedVideo: 0,
        }));

        // Insert records into the database
        const result = await collection.insertMany(scheduleRecords);

        if (result.acknowledged === true) {
            res.status(200).json({ status: 'success', message: 'Schedule created successfully' });
        } else {
            res.status(400).json({ status: 'error', message: 'Creation failed' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to create schedule', error: error.message });
    } finally {
        //await client.close();
    }
    // dummyJSON:{
    //     "doctorId": 67,
    //     "date": "2024-06-21T04:25:56.731+00:00",
    //     "workingHours": ["10:30", "11:00", "11:30"],
    //     "availableSlots": [10, 5, 2]
    // }
    
}
async function filterSchedules(req, res) {
    try {
        await connectToDatabase();
        await client.connect();
        const { doctorId, date, time } = req.query;
        const db = client.db("ImmunePlus");
        const collection = db.collection("doctoravailabilities");

        // Build the query object
        let query = {};
        if (doctorId) query.doctorId = parseInt(doctorId);
        if (date) {
            const start = new Date(date);
            const end = new Date(date);
            end.setDate(end.getDate() + 1);
            query.date = { $gte: start, $lt: end };
        }
        if (time) query.time = time;

        // Debugging output

        // Fetch filtered records from the database
        const result = await collection.find(query).toArray();

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Failed to filter schedules', error: error.message });
    } finally {
        //await client.close();
    }
}


async function loginDoctor(req, res) {
    const { email, password } = req.body;
    let validations = [];

    if (!password) validations.push({ key: 'password', message: 'Password is required' });
    if (!email) validations.push({ key: 'email', message: 'Email is required' });


    if (validations.length) {
        res.status(400).json({ status: 'error', validations: validations });
        return;
    }

    try {
        await connectToDatabase();
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Doctors");
        const user = await collection.findOne({ email: email });

        if (user) {
            const result = await bcrypt.compare(password, user.password);
            if (result) {
                const userInfo = {
                    name: user.name,
                    id: user._id,
                    hospital: user.hospital,
                    location: user.location,
                    about: user.about,
                    patients: user.patients,
                    img: user.img,
                    experience: user.experience,
                    workinghours: user.workinghours,
                    totalslots: user.totalslots,
                    availableSlots: user.availableSlots,
                    type: user.type,
                    specialist: user.specialist,
                    workingDays: user.workingDays,
                    videoFee: user.videoFee,
                    appointmentFee: user.appointmentFee,
                };

                res.json({ status: 'success', message: 'Login successfull!', user: userInfo });
            } else {
                res.status(400).json({ status: 'error', message: 'Invalid Email or password' });
            }
        } else {
            res.status(400).json({ status: 'error', message: 'Invalid Email or password' });
        }
    } finally {
        //await client.close();
    }
}

async function updateDoctor(req, res) {
    try {
    const {id, name, hospital, about, type, patients, experience, rating, workinghours, totalslots, availableSlots, location, specialist, workingDays, videoFee, appointmentFee, email, password } = req.body;
    let validations = [];
    let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;
    let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!id) validations.push({ key: 'id', message: 'id is required' });

    if (password && (password.length < 8 || password.length > 20 || !regex.test(password))) {
        validations.push({ key: 'password', message: 'Password should be between 8 to 20 characters, contain at least one number, one special character, and one uppercase letter.' });
    }

    if (email && !emailRegex.test(email)) validations.push({ key: 'email', message: 'Email is not valid' });

    if (validations.length) {
        res.status(400).json({ status: 'error', validations: validations });
        return;
    }

    try {
        await connectToDatabase();
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Doctors");
        const user = await collection.findOne({_id: parseInt(id)});
        if (!user) {
            res.status(400).json({ status: 'error', message: 'Doctor not found' });
            return;
        }
        

        const updatedFields = {};
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updatedFields.password = hashedPassword;
        }
        if (location) updatedFields.location = location;
        if (name) updatedFields.name = name;
        if (hospital) updatedFields.hospital = hospital;
        if (email) updatedFields.email = email;
        if (about) updatedFields.about = about;
        if (patients) updatedFields.patients = patients;
        if (experience) updatedFields.experience = experience;
        if (workinghours) updatedFields.workinghours = workinghours;
        if (totalslots) updatedFields.totalslots = totalslots;
        if (availableSlots) updatedFields.availableSlots = availableSlots;
        if (workingDays) updatedFields.workingDays = workingDays;
        if (videoFee) updatedFields.videoFee = videoFee;
        if (appointmentFee) updatedFields.appointmentFee = appointmentFee;
        if (req.file && req.file.buffer) {
            const filePath = path.join('uploads/doctor', req.file.originalname);
            if (!fs.existsSync('uploads/doctor')) {
                fs.mkdirSync('uploads/category', { recursive: true });
            }
            fs.writeFileSync(filePath, req.file.buffer);
            updatedFields.img = filePath;
        }

        const result = await collection.updateOne({ _id: parseInt(id) }, { $set: updatedFields });

        if (result.modifiedCount > 0) {
            res.status(200).json({ status: 'success', message: 'Doctor updated successfully' });
        } else {
            res.status(400).json({ status: 'error', message: 'Failed to update Doctor' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred during update', reason: error });
    } finally {
        //await client.close();
    }
} catch (error) {
    res.status(500).json({ message: 'Failed to update Doctor', error: error.message });
}
}

// Delete Doctor controller
async function deleteDoctor(req, res) {
    const { id } = req.body;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'Doctor ID is required' });
        return;
    }

    try {
        await connectToDatabase();
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Doctors");

        const user = await collection.findOne({_id: parseInt(id) });

        if (!user) {
            res.status(400).json({ status: 'error', message: 'Doctor not found' });
            return;
        }

        const result = await collection.deleteOne({_id: parseInt(id) });

        if (result.deletedCount > 0) {
            res.status(200).json({ status: 'success', message: 'Doctor deleted successfully' });
        } else {
            res.status(400).json({ status: 'error', message: 'Failed to delete user' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred during deletion', reason: error });
    } finally {
        //await client.close();
    }
}

async function getAll(req, res) {
    try {
        await connectToDatabase();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Doctors");
        
        const doctors = await collection.find().toArray();
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch doctors', error: error.message });
    }
}

async function getAllAvailableDocter(req, res) {
    try {
        await connectToDatabase();
        const db = client.db("ImmunePlus");
        const collection = db.collection("doctoravailabilities");
        
        const doctors = await collection.find().toArray();
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch doctors', error: error.message });
    }
}
async function getDocterbyId(req, res) {
    const { id } = req.query;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'Docter ID is required' });
        return;
    }
    try {
        await connectToDatabase();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Doctors");
        const doctors = await collection.find({ _id: parseInt(id) }).toArray();
        if (doctors.length === 0) {
            res.status(404).json({ status: 'error', message: 'Doctor not found' });
        } else {
            res.json(doctors);
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch doctors', error: error.message });
    }
}

async function getSchedulebyId(req, res) {
    const { id } = req.query;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'Docter ID is required' });
        return;
    }
    try {
        await connectToDatabase();
        const db = client.db("ImmunePlus");
        const collection = db.collection("doctoravailabilities");
        const schedule = await collection.find({ doctorId: parseInt(id) }).toArray();

        if (schedule.length === 0) {
            res.status(404).json({ status: 'error', message: 'No Data found' });
            return;
        }

        // Group and format the schedule by date
        const formattedSchedule = schedule.reduce((acc, curr) => {
            const dateStr = new Date(curr.date).toDateString(); // Format date
            const existingDate = acc.find(item => item.date === dateStr);

            if (existingDate) {
                existingDate.info.push(curr);
            } else {
                acc.push({ date: dateStr, info: [curr] });
            }

            return acc;
        }, []);

        res.json(formattedSchedule);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch Data', error: error.message });
    }
}

async function getAppointmentbyId(req, res) {
    const { id } = req.query;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'Docter ID is required' });
        return;
    }
    try {
        await connectToDatabase();
        const db = client.db("ImmunePlus");
        const collection = db.collection("appointments");
        const appointments = await collection.find({ doctorId: parseInt(id) }).toArray();

        if (appointments.length === 0) {
            res.status(404).json({ status: 'error', message: 'No Data found' });
            return;
        }

        // Group and format the appointments by date
        const formattedAppointments = appointments.reduce((acc, curr) => {
            const dateStr = new Date(curr.date).toDateString(); // Format date
            const existingDate = acc.find(item => item.date === dateStr);
            console.log(existingDate, dateStr);
            if (existingDate) {
                existingDate.info.push(curr);
            } else {
                acc.push({ date: dateStr, info: [curr] });
            }

            return acc;
        }, []);

        res.json(formattedAppointments);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch Data', error: error.message });
    }
}


async function getTopRatedDoctors(req, res) {
    try {
        await connectToDatabase();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Doctors");
        
        // Fetch doctors with a rating and sort them by rating in descending order
        const doctors = await collection.find({ rating: { $ne: null } }).sort({ rating: -1 }).toArray();
        
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch top-rated doctors', error: error.message });
    }
}

async function Dashboard(req, res) {
    const { id } = req.query;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'Docter ID is required' });
        return;
    }
    try {
        await connectToDatabase();
        const db = client.db("ImmunePlus");
        const collection = db.collection("doctoravailabilities");
        
        // Fetch doctors with a rating and sort them by rating in descending order
        const data = await collection.find({ doctorId: parseInt(id) }).toArray();
        
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch top-rated doctors', error: error.message });
    }
}


module.exports = {
    loginDoctor,
    registerDoctor,
    updateDoctor,
    deleteDoctor,
    getAll,
    getAllAvailableDocter,
    getDocterbyId,
    bookAppointment,
    createSchedule,
    filterSchedules,
    upload,
    getTopRatedDoctors,
    getSchedulebyId,
    getAppointmentbyId,
    Dashboard
};
