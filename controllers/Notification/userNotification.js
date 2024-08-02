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

// Multer configuration for memory storage
// type
// 1= order Received;
// 2= Order Confirmed;
// 3= rider on its way to medical store
// 4= rider checked meds;
// 5= rider left;
// 6= rider reached destination
// 7= order delivered

async function create(req, res) {
   
    try {
        await client.connect();
        const { userId, message, type } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("userNotification");
        const countersCollection = db.collection("Counters");
       
        const validations = [];
        if (!userId) validations.push({ key: 'userId', message: 'User ID is required' });
        if (!message) validations.push({ key: 'message', message: 'Message is required' });
        if (!type) validations.push({ key: 'type', message: 'Type is required' });

        if (validations.length) {
            res.status(400).json({ status: 'error', validations: validations });
            return;
        }



            // Get and increment the counter for TypeOfTreatment
            const counter = await countersCollection.findOneAndUpdate(
                { _id: "userNotificationId" },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
            const newId = counter.seq;
            const dateInIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
            const notification = {
                userId: parseInt(userId),
                userType: 1,
                message,
                date: dateInIST,
                read: false,
                type,
                status: 'pending',
                _id: newId
            };
         
            const result = await collection.insertOne(notification);

            if (result.acknowledged === true) {
                return res.status(200).json({ status: 'success', message: 'Notification Saved' });
            } else {
                res.status(400).json({ status: 'error', message: 'Creation failed' });
            }
        
    } catch (error) {
        res.status(500).json({ message: 'Failed to create Notification', error: error.message });
    }
}

async function getAllNotification(req, res) {
    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("userNotification");

        const categories = await collection.find().toArray();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
    }
}

async function update(req, res) {
    try {
 // Ensure the client is connected

 const { userId, message, type, id } = req.body;
 await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("userNotification");

        let updateFields = {   userId, message, type};
      
        const result = await collection.updateOne(
            { _id: parseInt(id) },
            { $set: updateFields }
        );

        if (result.modifiedCount === 1) {
            res.status(200).json({ status: 'success', message: 'Notification Updated' });
        } else {
            res.status(400).json({ status: 'error', message: 'Update failed' });
        }
    
    } catch (error) {
        res.status(500).json({ message: 'Failed to update Notification', error: error.message });
    }
}

// Controller function to delete a TypeOfTreatment
async function remove(req, res) {
    try {
        await client.connect();
        const { id } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("userNotification");

        const result = await collection.deleteOne({ _id: parseInt(id) });

        if (result.deletedCount> 0) {
            res.status(200).json({ status: 'success', message: 'Notification Deleted' });
        } else {
            res.status(400).json({ status: 'error', message: 'Delete failed'  });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete Notification', error: error });
    }
}

async function getNotificationbyId(req, res) {
    const { id } = req.query;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'User ID is required' });
        return;
    }
    try {
         await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("userNotification");
        const noti = await collection.find({ userId: parseInt(id) }).toArray();
        res.json(noti);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch notification', error: error.message });
    }
}

async function sendUserNotification(userId,orderId, type) {
    console.log(userId,orderId, type);
    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const notificationsCollection = db.collection("userNotification");
        const countersCollection = db.collection("Counters");

        // Generate new notification ID
        const counter = await countersCollection.findOneAndUpdate(
            { _id: "userNotificationId" },
            { $inc: { seq: 1 } },
            { upsert: true, returnDocument: 'after' }
        );
        const newNotificationId = counter.seq;

        let message;
        if (type == 1) {
            message = `Your Order ${orderId} has been recorded. We will try to find the best suitable pharmacy to get your Medicines.`;
        } else if (type == 2) {
            message = `Your Order ${orderId} has been confirmed. We will try to find the best suitable pharmacy to get your Medicines.`;
        } else if (type == 3) {
            message = `Our Rider is on its way to the medical store to pick your Medicines for Order ${orderId}`;
        } else if (type == 4) {
            message = `Rider checked your Medicines & left for your destination for order ${orderId}`;
        } else if (type == 5) {
            message = `Rider reached destination for order ${orderId}`;
        } else if (type == 6) {
            message = `Your Order ${orderId} has been delivered`;
        }

        const dateInIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const notification = {
            userId: parseInt(userId),
            userType: 1,
            message: message,
            date: dateInIST,
            read: false,
            type: type,
            status: 'pending',
            _id: newNotificationId
        };
     
        const result = await notificationsCollection.insertOne(notification);

        if (result.acknowledged) {

            
        } else {
            throw new Error('Failed to insert notification');
        }
    } catch (error) {
        console.error('Error sending notification:', error.message);
    } finally {
        await client.close();
    }
}

module.exports = {
    create,
    getAllNotification,
    update,
    remove,
    getNotificationbyId,
    sendUserNotification
};
