const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');
const url = 'mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/?retryWrites=true&w=majority&appName=ImmunePlus';
const wss = require('./webSocket');
const client = new MongoClient(url, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
const Order = require('../models/Order');
const Pharmacy = require('../models/Pharmacy');
const responses = new Map();

// Multer configuration for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

async function placeOrder(req, res) {
    const { userId, products, location } = req.body;

    if (!userId || !Array.isArray(products) || products.length === 0 || !location) {
        return res.status(400).json({ status: 'error', message: 'userId, products, and location are required' });
    }

    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const ordersCollection = db.collection("Orders");
        const countersCollection = db.collection("Counters");
        const pharmacyCollection = db.collection("Pharmacy");

        // Validate the product details
        let validations = [];
        products.forEach((product, index) => {
            if (!product.productId) validations.push({ key: `products[${index}].productId`, message: 'Product ID is required' });
            if (!product.price) validations.push({ key: `products[${index}].price`, message: 'Price is required' });
            if (!product.pieces) validations.push({ key: `products[${index}].pieces`, message: 'Pieces are required' });
            if (!product.dose) validations.push({ key: `products[${index}].dose`, message: 'Dose is required' });
            if (!product.quantity) validations.push({ key: `products[${index}].quantity`, message: 'Quantity is required' });
            if (!product.name) validations.push({ key: `products[${index}].name`, message: 'Product Name is required' });
        });

        if (validations.length > 0) {
            return res.status(400).json({ status: 'error', validations });
        }

        // Get and increment the counter for Orders
        const counter = await countersCollection.findOneAndUpdate(
            { _id: "orderId" },
            { $inc: { seq: 1 } },
            { upsert: true, returnDocument: 'after' }
        );
        const newOrderId = counter.seq; // Generate a new ObjectId for the order

        // Insert the order
        const order = {
            _id: newOrderId,
            userId,
            products: products.map(product => ({
                productId: parseFloat(product.productId),
                name: product.name,
                price: parseFloat(product.price),
                pieces: parseFloat(product.pieces),
                dose: parseFloat(product.dose),
                quantity: parseInt(product.quantity),
            })),
            location,
            status: 0,
            date: new Date(),
        };

        const result = await ordersCollection.insertOne(order);

        if (result.acknowledged) {
            
            evaluateResponses(newOrderId);
            const pharmacies = await pharmacyCollection.find().toArray();
            pharmacies.forEach(pharmacy => {
                return global.io.emit('newOrder', { orderId: newOrderId, pharmacyId: pharmacy._id });
            });
            // Send success response to client
           // return res.status(200).json({ status: 'success', message: 'Order placed successfully', orderId: newOrderId });
        } else {
            throw new Error('Failed to place order');
        }
        
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred during order placement', reason: error.message });
    }
}



async function getOrderbyId(req, res) {
    const { id } = req.body;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'Order ID is required' });
        return;
    }
    try {
        const db = client.db("ImmunePlus");
        const collection = db.collection("Orders");
        const order = await collection.findOne({_id: parseInt(id) });
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch order', error: error.message });
    }
}


async function evaluateResponses(orderId) {
    setTimeout(async () => {
        console.log(responses);
        if (responses.has(orderId)) {
            const orderResponses = responses.get(orderId);
            let bestPharmacy = null;
            let maxAvailableProducts = -1;

            orderResponses.forEach(response => {
                const availableProducts = response.products.filter(product => product.available).length;
                if (availableProducts > maxAvailableProducts) {
                    maxAvailableProducts = availableProducts;
                    bestPharmacy = response.pharmacyId;
                }
                console.log(availableProducts, maxAvailableProducts, response.pharmacyId);
            });

            if (bestPharmacy) {
                await assignOrderToPharmacy(orderId, bestPharmacy);
            } else {
                // Handle case where no suitable pharmacy is found
                console.log(`No suitable pharmacy found for order ${orderId}`);
                global.io.emit('noSuitablePharmacy', { orderId });
            }

            responses.delete(orderId);
        } else {
            // Handle case where no responses were received
            console.log(`No responses received for order ${orderId}`);
            global.io.emit('noResponses', { orderId });
        }
    }, 30000);
}

async function assignOrderToPharmacy(orderId, pharmacyId) {
    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const ordersCollection = db.collection("Orders");

        await ordersCollection.updateOne({ _id: orderId }, { $set: { assignedPharmacy: pharmacyId, status: 1 } });

        global.io.emit('orderAssigned', { orderId, pharmacyId });
        console.log(`Order ${orderId} assigned to pharmacy ${pharmacyId}`);

        // Send order confirmation notification
        await sendOrderConfirmationNotification(orderId, pharmacyId);
    } catch (error) {
        console.error("Error assigning order to pharmacy:", error);
    }
}


async function receivePharmacyResponse(req, res) {
    const { orderId, pharmacyId, products } = req.body;

    if (!orderId || !pharmacyId || !Array.isArray(products)) {
        return res.status(400).json({ status: 'error', message: 'orderId, pharmacyId, and products are required' });
    }
    
    try {
        if (!responses.has(orderId)) {
            responses.set(orderId, []);
        }
        responses.get(orderId).push({ pharmacyId, products });

        const canFulfillEntireOrder = products.every(product => product.available);

        if (canFulfillEntireOrder) {
            await assignOrderToPharmacy(orderId, pharmacyId);
            return res.status(200).json({ status: 'success', message: 'Order assigned immediately', orderId });
        }

        res.status(200).json({ status: 'success', message: 'Response recorded' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to record response', reason: error.message });
    }
}

async function sendOrderConfirmationNotification(orderId, pharmacyId) {
    try {
        // Connect to the database to get pharmacy details if needed
        await client.connect();
        const db = client.db("ImmunePlus");
        const pharmacyCollection = db.collection("Pharmacy");

        // Fetch the pharmacy details
        const pharmacy = await pharmacyCollection.findOne({ _id: pharmacyId });

        if (!pharmacy) {
            console.error(`Pharmacy with ID ${pharmacyId} not found`);
            return;
        }

        // Emit the notification
        global.io.emit('orderConfirmed', { orderId, pharmacyId, pharmacyName: pharmacy.name });
        console.log(`Notification sent: Order ${orderId} confirmed for pharmacy ${pharmacy.name}`);
    } catch (error) {
        console.error("Error sending order confirmation notification:", error);
    }
}

function removeCircularReferences(obj) {
    const seen = new WeakSet();
    function internalRemove(obj) {
        if (obj && typeof obj === 'object') {
            if (seen.has(obj)) {
                return;
            }
            seen.add(obj);
            for (const key in obj) {
                if (typeof obj[key] === 'object') {
                    internalRemove(obj[key]);
                }
            }
        }
    }
    internalRemove(obj);
    return obj;
}

async function changeOrderStatus(req, res) {
    try {
        const { orderId, status } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("Orders");

        let updateFields = { status };

        const result = await collection.updateOne(
            { _id: parseInt(orderId) },
            { $set: updateFields }
        );

        if (result.modifiedCount === 1) {
            // Fetch the updated order details
            const updatedOrder = await collection.findOne({ _id: parseInt(orderId) });

            // Emit the status change event to notify about the change
            global.io.emit('orderStatusChanged', { orderId, status, updatedOrder });

            console.log(`Order ${orderId} status changed to ${status}`);

            // Send a confirmation notification to the user
            await sendOrderStatusNotificationToUser(orderId, updatedOrder.userId, status);

            // Send success response
            res.status(200).json({ status: 'success', message: 'Status Updated' });
        } else {
            res.status(400).json({ status: 'error', message: 'Status update failed' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to update status', error: error.message });
    }
}

async function sendOrderStatusNotificationToUser(orderId, userId, newStatus) {
    try {
        const db = client.db("ImmunePlus");
        const usersCollection = db.collection("Users");

        // Fetch the user details
        const user = await usersCollection.findOne({ _id: userId });

        if (!user) {
            console.error(`User with ID ${userId} not found`);
            return;
        }

        // Emit the notification
        global.io.emit('orderStatusNotification', { orderId, userId, newStatus, userName: user.name });
        console.log(`Notification sent: Order ${orderId} status changed to ${newStatus} for user ${user.fullName}`);
    } catch (error) {
        console.error("Error sending order status notification:", error);
    }
}




module.exports = {
    placeOrder,
    getOrderbyId,
    receivePharmacyResponse,
    changeOrderStatus
};
