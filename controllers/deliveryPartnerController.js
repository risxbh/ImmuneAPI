const bcrypt = require('bcrypt');
const { MongoClient, ServerApiVersion } = require('mongodb');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
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

const storage = multer.memoryStorage();
const upload = multer({ storage });

async function registerDelivery(req, res) {
    const { fullname, phoneNumber, address, licenseNo, experience, city, password, accountNumber, ifscCode, accountHolderName } = req.body;
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

    if (!req.files || !req.files.licensePhoto || !req.files.licensePhoto[0].buffer) validations.push({ key: 'licensePhoto', message: 'licensePhoto is required' });
    if (!req.files || !req.files.rcPhoto || !req.files.rcPhoto[0].buffer) validations.push({ key: 'rcPhoto', message: 'rcPhoto is required' });
    if (!req.files || !req.files.profilePic || !req.files.profilePic[0].buffer) validations.push({ key: 'Profile Pic', message: 'Profile Pic is required' });
    if (!fullname) validations.push({ key: 'fullname', message: 'Full Name is required' });
    if (!address) validations.push({ key: 'address', message: 'Address is required' });
    if (!licenseNo) validations.push({ key: 'licenseNo', message: 'License No is required' });
    if (!city) validations.push({ key: 'city', message: 'City is required' });
    if (!experience) validations.push({ key: 'experience', message: 'Experience is required' });
    if (!accountNumber) validations.push({ key: 'accountNumber', message: 'Account Number is required' });
    if (!ifscCode) validations.push({ key: 'ifscCode', message: 'IFSC Code is required' });
    if (!accountHolderName) validations.push({ key: 'accountHolderName', message: 'Account Holder Name is required' });
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

            const licenseFilePath = path.join('uploads/delivery/license', `${newId}`);
            const rcFilePath = path.join('uploads/delivery/rc', `${newId}`);
            const profileFilePath = path.join('uploads/delivery/profilePic', `${newId}`);

            if (!fs.existsSync('uploads/delivery/license')) {
                fs.mkdirSync('uploads/delivery/license', { recursive: true });
            }

            if (!fs.existsSync('uploads/delivery/rc')) {
                fs.mkdirSync('uploads/delivery/rc', { recursive: true });
            }
            if (!fs.existsSync('uploads/delivery/profile')) {
                fs.mkdirSync('uploads/delivery/profilePic', { recursive: true });
            }

            fs.writeFileSync(licenseFilePath, req.files.licensePhoto[0].buffer);
            fs.writeFileSync(rcFilePath, req.files.rcPhoto[0].buffer);
            fs.writeFileSync(profileFilePath, req.files.profilePic[0].buffer);

            const hashedPassword = await bcrypt.hash(password, 10);

            const result = await collection.insertOne({
                _id: newId,
                fullname, phoneNumber, address, licenseNo, licensePhoto: licenseFilePath, rcPhoto: rcFilePath, experience, city, password: hashedPassword, profilePic: profileFilePath,
                accountNumber, ifscCode, accountHolderName
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
        const user = await collection.findOne({ phoneNumber });

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
                    rcPhoto: user.rcPhoto,
                    profilePic: user.profilePic
                };
                res.json({ status: 'success', message: 'Login successful!', user: userInfo });
            } else {
                res.status(400).json({ status: 'error', message: 'Invalid Phone Number or password' });
            }
        } else {
            res.status(400).json({ status: 'error', message: 'Invalid Phone Number or password' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred during login', reason: error.message });
    } finally {
        await client.close();
    }
}

async function updateDelivery(req, res) {
    const { id, password, address, fullName, licenseNo, experience, city, phoneNumber,accountNumber, ifscCode, accountHolderName  } = req.body;
    let validations = [];
    let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;

    if (!id) validations.push({ key: 'id', message: 'Delivery Partner ID is required' });

    if (password && (password.length < 8 || password.length > 20 || !regex.test(password))) {
        validations.push({ key: 'password', message: 'Password should be between 8 to 20 characters, contain at least one number, one special character, and one uppercase letter.' });
    }

    if (validations.length) {
        res.status(400).json({ status: 'error', validations: validations });
        return;
    }

    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("DeliveryPartner");

        const user = await collection.findOne({ _id: parseInt(id) });
  
        if (!user) {
            res.status(400).json({ status: 'error', message: 'Delivery Partner not found' });
            return;
        }

        const updatedFields = {};
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updatedFields.password = hashedPassword;
        }
        if (address) updatedFields.address = address;
        if (fullName) updatedFields.fullName = fullName;
        if (licenseNo) updatedFields.licenseNo = licenseNo;
        if (experience) updatedFields.experience = experience;
        if (city) updatedFields.city = city;
        if (phoneNumber) updatedFields.phoneNumber = phoneNumber;
        if (accountNumber) updatedFields.accountNumber = accountNumber;
        if (ifscCode) updatedFields.ifscCode = ifscCode;
        if (accountHolderName) updatedFields.accountHolderName = accountHolderName;

        if (req.files) {
            if (req.files.licensePhoto && req.files.licensePhoto[0]) {
                const licenseFilePath = path.join('uploads/delivery/license', `${id}`);
                fs.writeFileSync(licenseFilePath, req.files.licensePhoto[0].buffer);
                updatedFields.licensePhoto = licenseFilePath;
            }
            if (req.files.rcPhoto && req.files.rcPhoto[0]) {
                const rcFilePath = path.join('uploads/delivery/rc', `${id}`);
                fs.writeFileSync(rcFilePath, req.files.rcPhoto[0].buffer);
                updatedFields.rcPhoto = rcFilePath;
            }
            if (req.files.profilePic && req.files.profilePic[0]) {
                const profilePicFilePath = path.join('uploads/delivery/profilePic', `${id}`);
                fs.writeFileSync(rcFilePath, req.files.profilePic[0].buffer);
                updatedFields.profilePic = profilePicFilePath;
            }
        }

        const result = await collection.updateOne({ _id: id }, { $set: updatedFields });
        console.log(result);
        if (result.modifiedCount > 0) {
            res.status(200).json({ status: 'success', message: 'Delivery Partner updated successfully' });
        } else {
            res.status(400).json({ status: 'error', message: 'Failed to update user' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred during update', reason: error.message });
    } finally {
        await client.close();
    }
}

// Delete user controller
async function deleteDelivery(req, res) {
    const { id } = req.body;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'Delivery Partner ID is required' });
        return;
    }

    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("DeliveryPartner");

        const user = await collection.findOne({ _id: parseInt(id) });

        if (!user) {
            res.status(400).json({ status: 'error', message: 'Delivery Partner not found' });
            return;
        }

        const result = await collection.deleteOne({ _id: id });

        if (result.deletedCount > 0) {
            res.status(200).json({ status: 'success', message: 'Delivery Partner deleted successfully' });
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
        const collection = db.collection("DeliveryPartner");
        
        const users = await collection.find().toArray();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch users', error: error.message });
    }
}

async function getAvailableOrders(req, res) {
    try {
        const db = client.db("ImmunePlus");
        const collection = db.collection("ongoingOrders");

        const orders = await collection.find({ assignedPartner: null, assignedPharmacy: { $ne: null } }).toArray();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch Orders', error: error.message });
    }
}

async function getUserbyId(req, res) {
    const { id } = req.query;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'Delivery Partner ID is required' });
        return;
    }
    try {
        const db = client.db("ImmunePlus");
        const collection = db.collection("DeliveryPartner");
        const user = await collection.find({ _id: parseInt(id) }).toArray();
        if (user.length === 0) {
            res.status(404).json({ status: 'error', message: 'Delivery Partner not found' });
        } else {
            res.json(user);
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch Delivery Partner', error: error.message });
    }
}

async function assignOrderToPartner(req, res) {
    const { orderId, id } = req.body;
    if (!orderId) {
        res.status(400).json({ status: 'error', message: 'Order ID is required' });
        return;
    }
    if (!id) {
        res.status(400).json({ status: 'error', message: 'User ID is required' });
        return;
    }
    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const ordersCollection = db.collection("Orders");
        const paymentCollection = db.collection("paymentDelivery");
        const countersCollection = db.collection("Counters");

        // Check if the order has an assigned partner
        const order = await ordersCollection.findOne({ _id: orderId });
        if (!order) {
            res.status(404).json({ status: 'error', message: 'Order not found' });
            return;
        }

        if (order.assignedPartner) {
            res.status(400).json({ status: 'error', message: 'Order already taken' });
            return;
        }

        // Update order with assigned partner
        await ordersCollection.updateOne({ _id: orderId }, { $set: { assignedPartner: id, status: 3 } });

        // Generate new payment ID
        const counter = await countersCollection.findOneAndUpdate(
            { _id: "paymentId" },
            { $inc: { seq: 1 } },
            { upsert: true, returnDocument: 'after' }
        );
        const newPaymentId = counter.seq;
        const dateInIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

        // Create payment info
        const paymentInfo = {
            _id: newPaymentId,
            userId: id,
            orderId: orderId,
            totalPrice: 500,
            type: 3,
            date: dateInIST,
            status: 0,
        };

        // Insert payment info
        const result = await paymentCollection.insertOne(paymentInfo);

        if (result.acknowledged) {
            res.status(200).json({ status: 'success', message: 'Payment created successfully', paymentId: newPaymentId });
        } else {
            throw new Error('Failed to create payment');
        }
    } catch (error) {
        console.error("Error assigning order to pharmacy:", error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    } finally {
        // await client.close();
    }
}
async function getUserbyId(req, res) {
    const { id } = req.query;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'User ID is required' });
        return;
    }
    try {
        const db = client.db("ImmunePlus");
        const collection = db.collection("DeliveryPartner");
        const user = await collection.find({ _id: parseInt(id) }).toArray();
        if (user.length === 0) {
            res.status(404).json({ status: 'error', message: 'User not found' });
        } else {
            res.json(user);
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch User', error: error.message });
    }
}





module.exports = {
    registerDelivery,
    loginDelivery,
    updateDelivery,
    deleteDelivery,
    assignOrderToPartner,
    getAll,
    getAvailableOrders,
    getUserbyId,
    upload
};
