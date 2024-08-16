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
    const { name, password, address, phoneNumber, licenseNo, email, accountHolderName, accountNumber, ifscCode,bankName } = req.body;
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
    if (!accountNumber) validations.push({ key: 'accountNumber', message: 'Account Number is required' });
    if (!ifscCode) validations.push({ key: 'ifscCode', message: 'IFSC Code is required' });
    if (!accountHolderName) validations.push({ key: 'accountHolderName', message: 'Account Holder Name is required' });
    if (!bankName) validations.push({ key: 'bankName', message: 'Bank Name is required' });


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

            const counter = await countersCollection.findOneAndUpdate(
                { _id: "pharmacyId" },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
            const newId = counter.seq;
            const filePath = path.join('uploads/pharmacy', `${newId}`);
            if (!fs.existsSync('uploads/pharmacy')) {
                fs.mkdirSync('uploads/pharmacy', { recursive: true });
            }
            fs.writeFileSync(filePath, req.file.buffer);
            const hashedPassword = await bcrypt.hash(password, 10);



            const result = await collection.insertOne({
                _id: newId,
                password: hashedPassword,
                address,
                name,
                phoneNumber,
                licenseNo,
                bankName,
                licenseImg: filePath,
                accountHolderName,
                accountNumber,
                ifscCode
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
        // await client.close();
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
        // await client.close();
    }
}

// User registration controller


async function updateUser(req, res) {
    const { name, password, address, phoneNumber, licenseNo, email, id, accountHolderName, accountNumber, ifscCode, bankName } = req.body;
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
        if (accountNumber) updatedFields.accountNumber = accountNumber;
        if (ifscCode) updatedFields.ifscCode = ifscCode;
        if (accountHolderName) updatedFields.accountHolderName = accountHolderName;
        if (bankName) updatedFields.bankName = bankName;
        if (req.file && req.file.buffer) {
            const filePath = path.join('uploads/pharmacy', `${id}`);
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
        // await client.close();
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
        // await client.close();
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

async function Dashboard(req, res) {
    const { id } = req.query;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'Pharamcy ID is required' });
        return;
    }
    try {
        await connectToDatabase();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Orders");

        const data = await collection.find({ assignedPharmacy: parseInt(id) }).toArray();

        const today = new Date().toISOString().split('T')[0];

        const stats = data.reduce((acc, order) => {
            // Ensure date is in string format
            const orderDate = new Date(order.date).toISOString().split('T')[0]; // Extract date in YYYY-MM-DD format

            acc.totalOrders += 1;

            if (order.status > 0 && order.status <= 7) {
                acc.runingOrder += 1;
            }
            if (orderDate === today) {
                acc.todayOrder += 1;

            }
        
            if (Array.isArray(order.products)) {
                acc.money += order.products.reduce((total, item) => total + item.price, 0);
            }
            return acc;
        }, {
            totalOrders: 0,
            todayOrder: 0,
            runingOrder: 0,
            money: 0
        });

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch data', error: error.message });
    }
}

async function getOngoingOrder(req, res) {
    const { id } = req.query;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'Pharamcy ID is required' });
        return;
    }
    try {
        await connectToDatabase();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Orders");

        const orders = await collection.find({ 
            status: { $gte: 1, $lte: 4 },
            assignedPharmacy: parseInt(id)
        }).toArray();

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch data', error: error.message });
    }
}
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

async function getOrderbyId(req, res) {
    const { id } = req.query;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'Order ID is required' });
        return;
    }
    try {
        await connectToDatabase();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Orders");
        const orders = await collection.find({ assignedPharmacy: parseInt(id) }).toArray();

        if (orders.length === 0) {
            res.status(404).json({ status: 'error', message: 'No Data found' });
            return;
        }

        // Group and format the orders by date
        const formattedOrders = orders.reduce((acc, curr) => {
            const dateStr = new Date(curr.date).toDateString(); // Format date
            const existingDate = acc.find(item => item.date === dateStr);

            if (existingDate) {
                existingDate.info.push(curr);
            } else {
                acc.push({ date: dateStr, info: [curr] });
            }

            return acc;
        }, []);

        res.json(formattedOrders);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch Data', error: error.message });
    }
}

async function getPharmabyId(req, res) {
    const { id } = req.query;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'Pharmacy ID is required' });
        return;
    }
    try {
        await connectToDatabase();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Pharmacy");
        const pharmacy = await collection.find({ _id: parseInt(id) }).toArray();
        if (pharmacy.length === 0) {
            res.status(404).json({ status: 'error', message: 'Pharmacy not found' });
        } else {
            res.json(pharmacy);
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch Pharmacy', error: error.message });
    }
}

module.exports = {
    loginUser,
    registerUser,
    updateUser,
    deleteUser,
    getAll,
    Dashboard,
    upload,
    getOngoingOrder,
    getOrderbyId,
    getPharmabyId
};
