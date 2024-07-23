const bcrypt = require('bcrypt');
const { MongoClient, ServerApiVersion } = require('mongodb');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const DoctorAvailability = require('../models/Availability');
const Appointment = require('../models/Appointments')
const url = 'mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/?retryWrites=true&w=majority&appName=ImmunePlus';
let client = new MongoClient(url, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
        useNewUrlParser: true, useUnifiedTopology: true
    }
});
const storage = multer.memoryStorage();
const upload = multer({ storage });

async function registerDelivery(req, res) {
    const { fullname, phoneNumber, address, licenseNo, experience, city, password } = req.body;
    let validations = [];
    let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;

    let passwordMessage = '';
    let phoneNumMessage = '';

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

    if (!req.files || !req.files.licenseImg || !req.files.licenseImg[0].buffer) validations.push({ key: 'licensePhoto', message: 'licensePhoto is required' });
    if (!req.files || !req.files.rcImg || !req.files.rcImg[0].buffer) validations.push({ key: 'rcPhoto', message: 'rcPhoto is required' });
    if (!fullname) validations.push({ key: 'fullname', message: 'Full Name is required' });
    if (!address) validations.push({ key: 'address', message: 'Address is required' });
    if (!licenseNo) validations.push({ key: 'licenseNo', message: 'License No is required' });
    if (!city) validations.push({ key: 'city', message: 'City is required' });
    if (!experience) validations.push({ key: 'experience', message: 'Experience is required' });
    if (phoneNumber) {
        if (phoneNumber.length !== 10) {
            phoneNumMessage = 'Phone Number should have 10 digits.';
        }
    } else {
        phoneNumMessage = 'Phone Number is required.';
    }
    if (phoneNumMessage) {
        validations.push({ key: 'phoneNumber', message: phoneNumMessage });
    }

    if (validations.length) {
        res.status(400).json({ status: 'error', validations: validations });
        return;
    }

    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("DeliveryPartner");
        const countersCollection = db.collection("Counters");

        const existingUser = await collection.findOne({ phoneNumber });

        if (existingUser) {
            res.status(400).json({ status: 'error', message: 'Phone Number already exists' });
        } else {
            const counter = await countersCollection.findOneAndUpdate(
                { _id: "deliveryPartnerId" },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
            const newId = counter.seq;

            const licenseFilePath = path.join('uploads/delivery/license',  `${newId}`);
            const rcFilePath = path.join('uploads/delivery/rc',  `${newId}`);

            if (!fs.existsSync('uploads/delivery')) {
                fs.mkdirSync('uploads/delivery', { recursive: true });
            }

            fs.writeFileSync(licenseFilePath, req.files.licenseImg[0].buffer);
            fs.writeFileSync(rcFilePath, req.files.rcImg[0].buffer);

            const hashedPassword = await bcrypt.hash(password, 10);

            const result = await collection.insertOne({
                _id: newId,
                fullname, phoneNumber, address, licenseNo, licensePhoto: licenseFilePath, rcPhoto: rcFilePath, experience, city, password: hashedPassword
            });

            if (result.acknowledged) {
                res.status(200).json({ status: 'success', message: 'Delivery partner registered successfully' });
            } else {
                res.status(400).json({ status: 'error', message: 'Registration failed' });
            }
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred during registration', reason: error.message });
    } finally {
        await client.close();
    }
}

async function loginDelivery(req, res) {
    const { phoneNumber, password } = req.body;
    let validations = [];
    let phoneNumMessage = '';

    if (!password) validations.push({ key: 'password', message: 'Password is required' });
    if (phoneNumber) {
        if (phoneNumber.length < 10 || phoneNumber.length > 10) {
            phoneNumMessage = 'Phone Number should habe 10 digits.';
        }
    } else {
        phoneNumMessage = 'Phone Number is required.';
    }
    if (phoneNumMessage) {
        validations.push({ key: 'Phone Number', message: phoneNumMessage });
    }


    if (validations.length) {
        res.status(400).json({ status: 'error', validations: validations });
        return;
    }

    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("DeliveryPartner");
        const user = await collection.findOne({ phoneNumber: phoneNumber });

        if (user) {
            const result = await bcrypt.compare(password, user.password);
            if (result) {
                const userInfo = {
                    fullName: user.fullName,
                    id: user._id,
                    city: user.city,
                    licenseNo: user.licenseNo,
                    licensePhoto: user.licensePhoto,
                    address: user.address,
                    experience: user.experience,
                    phoneNumber: user.phoneNumber,
                };
                res.json({ status: 'success', message: 'Login successfull!', user: userInfo });
            } else {
                res.status(400).json({ status: 'error', message: 'Invalid Phone Number or password' });
            }
        } else {
            res.status(400).json({ status: 'error', message: 'Invalid email or password' });
        }
    } finally {
        // await client.close();
    }
}

module.exports = {
    registerDelivery,
    loginDelivery,
    upload
};