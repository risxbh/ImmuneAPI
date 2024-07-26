const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');
const url = 'mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/?retryWrites=true&w=majority&appName=ImmunePlus';
const client = new MongoClient(url, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Pharma login controller

const storage = multer.memoryStorage();
const upload = multer({ storage });

async function registerUser(req, res) {
    const { name, password, address, phoneNumber, licenseNo, email } = req.body;
    let validations = [];
    let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;
    let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    let passwordMessage = '';
    let phoneNumMessage = '';

    if (phoneNumber) {
        if (phoneNumber.length !== 10) {
            phoneNumMessage = 'Phone Number should have 10 digits.';
        }
    } else {
        phoneNumMessage = 'Phone Number is required.';
    }
    if (phoneNumMessage) {
        validations.push({ key: 'Phone Number', message: phoneNumMessage });
    }

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

    if (!address) validations.push({ key: 'address', message: 'Address is required' });
    if (!name) validations.push({ key: 'name', message: 'Name is required' });
    if (!email) validations.push({ key: 'email', message: 'Email is required' });
    else if (!emailRegex.test(email)) validations.push({ key: 'email', message: 'Email is not valid' });
    if (!licenseNo) validations.push({ key: 'licenseNo', message: 'License No is required' });
    if (!req.file || !req.file.buffer) validations.push({ key: 'licenseImg', message: 'Image is required' });

    if (validations.length) {
        res.status(400).json({ status: 'error', validations: validations });
        return;
    }

    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Pharmacy");
        const countersCollection = db.collection("Counters");

        const existingUser = await collection.findOne({ phoneNumber });

        if (existingUser) {
            res.status(400).json({ status: 'error', message: 'Phone Number already exists' });
        } else {
            const filePath = path.join('uploads/pharmacy', req.file.originalname);
            if (!fs.existsSync('uploads/pharmacy')) {
                fs.mkdirSync('uploads/pharmacy', { recursive: true });
            }
            fs.writeFileSync(filePath, req.file.buffer);
            const hashedPassword = await bcrypt.hash(password, 10);

            const counter = await countersCollection.findOneAndUpdate(
                { _id: "pharmacyId" },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
            const newId = counter.seq;

            const result = await collection.insertOne({
                _id: newId,
                password: hashedPassword,
                address,
                name,
                phoneNumber,
                licenseNo,
                licenseImg: filePath
            });
           
            if (result.acknowledged === true) {
                return res.status(200).json({ status: 'success', message: 'Pharmacy registered successfully' });
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
async function loginUser(req, res) {
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
        const collection = db.collection("Pharmacy");
        const user = await collection.findOne({ phoneNumber: phoneNumber });

        if (user) {
            const result = await bcrypt.compare(password, user.password);
            if (result) {
                const userInfo = {
                    name: user.name,
                    id: user._id,
                    address: user.address,
                    licenseNo: user.licenseNo,
                    phoneNumber: user.phoneNumber,
                    previousHistory: user.previousHistory,
                    licenseImg: user.licenseImg
                };

                res.json({ status: 'success', message: 'Login successfull!', user: userInfo });
            } else {
                res.status(400).json({ status: 'error', message: 'Invalid Phone Number or password' });
            }
        } else {
            res.status(400).json({ status: 'error', message: 'Invalid email or password' });
        }
    } finally {
        await client.close();
    }
}

// User registration controller


async function updateUser(req, res) {
    const { name, password, address, phoneNumber, licenseNo, email, id } = req.body;
    let validations = [];
    let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;
    let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!id) validations.push({ key: 'id', message: 'Pharmacy ID is required' });

    if (password && (password.length < 8 || password.length > 20 || !regex.test(password))) {
        validations.push({ key: 'password', message: 'Password should be between 8 to 20 characters, contain at least one number, one special character, and one uppercase letter.' });
    }

    if (email && !emailRegex.test(email)) validations.push({ key: 'email', message: 'Email is not valid' });

    if (validations.length) {
        res.status(400).json({ status: 'error', validations: validations });
        return;
    }

    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Pharmacy");

        const user = await collection.findOne({ _id: parseInt(id) });

        if (!user) {
            res.status(400).json({ status: 'error', message: 'User not found' });
            return;
        }

        const updatedFields = {};
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updatedFields.password = hashedPassword;
        }
        if (address) updatedFields.address = address;
        if (name) updatedFields.name = name;
        if (email) updatedFields.email = email;
        if (licenseNo) updatedFields.licenseNo = licenseNo;
        if (phoneNumber) updatedFields.phoneNumber = phoneNumber;
        if (req.file && req.file.buffer) {
            const filePath = path.join('uploads/pharmacy', req.file.originalname);
            if (!fs.existsSync('uploads/pharmacy')) {
                fs.mkdirSync('uploads/pharmacy', { recursive: true });
            }
            fs.writeFileSync(filePath, req.file.buffer);
            updatedFields.licenseImg = filePath;
        }

        const result = await collection.updateOne({ _id: parseInt(id) }, { $set: updatedFields });

        if (result.modifiedCount > 0) {
            res.status(200).json({ status: 'success', message: 'User updated successfully' });
        } else {
            res.status(400).json({ status: 'error', message: 'Failed to update user' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred during update', reason: error });
    } finally {
        await client.close();
    }
}

// Delete user controller
async function deleteUser(req, res) {
    const { id } = req.body;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'User ID is required' });
        return;
    }

    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Pharmacy");

        const user = await collection.findOne({ _id: id });

        if (!user) {
            res.status(400).json({ status: 'error', message: 'User not found' });
            return;
        }

        const result = await collection.deleteOne({  _id: id });

        if (result.deletedCount > 0) {
            res.status(200).json({ status: 'success', message: 'User deleted successfully' });
        } else {
            res.status(400).json({ status: 'error', message: 'Failed to delete user' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred during deletion', reason: error });
    } finally {
        await client.close();
    }
}

async function getAll(req, res) {
    try {
        const db = client.db("ImmunePlus");
        const collection = db.collection("Pharmacy");
        
        const users = await collection.find().toArray();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch users', error: error.message });
    }
}

module.exports = {
    loginUser,
    registerUser,
    updateUser,
    deleteUser,
    getAll,
    upload
};
