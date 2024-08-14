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
const {sendPharmaNotification} = require('./Notification/pharmaNotification');
const {sendUserNotification} = require('./Notification/userNotification');
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
        const paymentCollection = db.collection("paymentOrder");
        const availableOrderCollection = db.collection("ongoingOrders");

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

        const session = client.startSession();
        let newOrderId, newPayementId;
        await session.withTransaction(async () => {
            const counter = await countersCollection.findOneAndUpdate(
                { _id: "orderId" },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
            newOrderId = counter.seq;
            
            const counter2 = await countersCollection.findOneAndUpdate(
                { _id: "payementId" },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
            newPayementId = counter2.seq;
            
            let totalPrice = products.reduce((total, item) => total + item.price, 0);
            let amountToBePaid = totalPrice - (totalPrice * 15) / 100;
            const dateInIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
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
                date: dateInIST,
                assignedPharmacy: null,
                totalPrice: totalPrice,
                assignedPartner: null
            };

            const paymentInfo = {
                _id: newPayementId,
                userId,
                orderId: newOrderId,
                totalPrice: totalPrice,
                type: 1,
                date: dateInIST,
                PartnerId: null,
                status: 0,
                amountToBePaid: amountToBePaid
            };

            await ordersCollection.insertOne(order, { session });
            await availableOrderCollection.insertOne(order, { session });
            await paymentCollection.insertOne(paymentInfo, { session });
            
        });

        responses.set(newOrderId, { responses: [], createdAt: Date.now() });

        evaluateResponses(newOrderId);

        global.io.emit('newOrder', { orderId: newOrderId });
        sendPharmaNotification(0,newOrderId, 1)
        return res.status(200).json({ status: 'success', message: 'Order placed successfully', orderId: newOrderId });

    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred during order placement', reason: error.message });
    }
}

async function receivePharmacyResponse(req, res) {
    const { orderId, pharmacyId, products } = req.body;

    if (!orderId || !pharmacyId || !Array.isArray(products)) {
        return res.status(400).json({ status: 'error', message: 'orderId, pharmacyId, and products are required' });
    }

    try {
        const orderData = responses.get(orderId);

        if (!orderData) {
            return res.status(400).json({ status: 'error', message: 'Invalid order ID or order has expired' });
        }

        const timeElapsed = Date.now() - orderData.createdAt;

        if (timeElapsed > 60000) {
            return res.status(400).json({ status: 'error', message: 'Response time exceeded' });
        }

        orderData.responses.push({ pharmacyId, products });
        responses.set(orderId, orderData);

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

async function evaluateResponses(orderId) {
    setTimeout(async () => {
        const orderData = responses.get(orderId);

        if (!orderData) {
            console.log(`Order ${orderId} not found or already processed.`);
            return;
        }

        const orderResponses = orderData.responses;
        let bestPharmacy = null;
        let maxAvailableProducts = -1;

        orderResponses.forEach(response => {
            const availableProducts = response.products.filter(product => product.available).length;
            if (availableProducts > maxAvailableProducts) {
                maxAvailableProducts = availableProducts;
                bestPharmacy = response.pharmacyId;
            }
        });

        if (bestPharmacy) {
            await assignOrderToPharmacy(orderId, bestPharmacy);
        } else {
            console.log(`No suitable pharmacy found for order ${orderId}`);
            global.io.emit('noSuitablePharmacy', { orderId });
        }

        responses.delete(orderId);
        deleteOrder(orderId)
    }, 60000);
}

async function assignOrderToPharmacy(orderId, pharmacyId) {
    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const ordersCollection = db.collection("Orders");
        const paymentCollection = db.collection("paymentOrder");
        const availableOrderCollection = db.collection("ongoingOrders");

        await ordersCollection.updateOne({ _id: orderId }, { $set: { assignedPharmacy: pharmacyId, status: 1 } });
        await paymentCollection.updateOne({ orderId: orderId }, { $set: { PartnerId: pharmacyId } });
        //await availableOrderCollection.deleteOne({ _id: orderId });

        const order = await ordersCollection.findOne({ _id: parseInt(orderId) });
        if (!order) {
            throw new Error(`Order with ID ${orderId} not found`);
        }
        let userId = order.userId;

        //let message =`Order ${orderId} assigned to your Pharmacy. Please pack the order accordingly. Our rider is on the way.`
        sendPharmaNotification(pharmacyId,orderId,2)
        sendUserNotification(userId,orderId,2)
        global.io.emit('orderStatusChanged', { orderId, status: 2, userId, pharmacyId });   

        global.io.emit('GetDeliveryPartner', { orderId });
    } catch (error) {
        console.error("Error assigning order to pharmacy:", error);
    }
}

async function getOrderbyId(req, res) {
    const { id } = req.query;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'Order ID is required' });
        return;
    }
    try {
        const db = client.db("ImmunePlus");
        const collection = db.collection("Orders");
        const order = await collection.findOne({ _id: parseInt(id) });
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch order', error: error.message });
    }
}

async function changeOrderStatus(req, res) {
    try {
        const { orderId, status } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("Orders");
        const paymentCollection = db.collection("paymentOrder");

        let updateFields = { status };

        const result = await collection.updateOne(
            { _id: parseInt(orderId) },
            { $set: updateFields }
        );
        const order = await collection.findOne({ _id: parseInt(orderId) });

        if(status == 7){
            await paymentCollection.updateOne({ orderId: orderId }, { $set: { PartnerId: order.assignedPharmacy, status: 7 } });
        }
        if (result.modifiedCount === 1) {
            let userId= order.userId
            let pharmacyId = order.pharmacyId
            global.io.emit('orderStatusChanged', { orderId, status, userId, pharmacyId  });            
           sendPharmaNotification(order.assignedPharmacy, order._id, status)
           sendUserNotification(order.userId, order._id, status)

            // Send success response
            res.status(200).json({ status: 'success', message: 'Status Updated' });
        } else {
            res.status(400).json({ status: 'error', message: 'Status update failed' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to update status', error: error.message });
    }
}

async function getAll(req, res) {
    try {
        const db = client.db("ImmunePlus");
        const collection = db.collection("Orders");

        const orders = await collection.find().toArray();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch Orders', error: error.message });
    }
}
async function getAvailableOrders(req, res) {
    try {
        const db = client.db("ImmunePlus");
        const collection = db.collection("ongoingOrders");

        const orders = await collection.find({ assignedPharmacy: null }).toArray();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch Orders', error: error.message });
    }
}

async function deleteOrder(id) {
    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("ongoingOrders");

        const result = await collection.deleteOne({ _id: id });

        if (result.deletedCount > 0) {
            res.status(200).json({ message: `order deleted ${id}`, status: "Success" });
        }
    } catch (error) {
                   console.log('An error occurred during deletion');
    } finally {
        //await client.close();
    }
}





module.exports = {
    placeOrder,
    getOrderbyId,
    receivePharmacyResponse,
    changeOrderStatus,
    getAll,
    getAvailableOrders
};
