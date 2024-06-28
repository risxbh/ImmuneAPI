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

async function getAllProducts(req, res) {
    try {
        const db = client.db("ImmunePlus");
        const collection = db.collection("Products");

        const categories = await collection.find().toArray();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch product', error: error.message });
    }
}

async function update(req, res) {
    try {
        await client.connect();

        const { id, name, description, price, pieces, dose, category } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("Products");

        let existing = await collection.findOne({ name });

        if (existing) {
            return res.status(400).json({ status: 'error', message: 'Product already exists' });
        }

        let updateFields = { name, description, price };

        if (typeof pieces === 'string') {
            updateFields.pieces = pieces.split(',').map(item => parseFloat(item.trim()));
        } else if (Array.isArray(pieces)) {
            updateFields.pieces = pieces.map(item => parseFloat(item));
        }

        if (typeof dose === 'string') {
            updateFields.dose = dose.split(',').map(item => parseFloat(item.trim()));
        } else if (Array.isArray(dose)) {
            updateFields.dose = dose.map(item => parseFloat(item));
        }

        if (typeof category === 'string') {
            updateFields.category = category.split(',').map(item => parseFloat(item.trim()));
        } else if (Array.isArray(category)) {
            updateFields.category = category.map(item => parseFloat(item));
        }

        if (req.file && req.file.buffer) {
            const filePath = path.join('uploads/product', req.file.originalname);
            if (!fs.existsSync('uploads/product')) {
                fs.mkdirSync('uploads/product', { recursive: true });
            }
            fs.writeFileSync(filePath, req.file.buffer);
            updateFields.img = filePath;
        }

        const result = await collection.updateOne(
            { _id: parseInt(id) },
            { $set: updateFields }
        );

        if (result.modifiedCount === 1) {
            res.status(200).json({ status: 'success', message: 'Product Updated' });
        } else {
            res.status(400).json({ status: 'error', message: 'Update failed' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to update Product', error: error.message });
    } finally {
        await client.close();
    }
}

// Controller function to delete a TypeOfTreatment
async function remove(req, res) {
    try {
        const { id } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("Products");

        const user = await collection.findOne({ _id: parseInt(id) });
        console.log(user);
        const result = await collection.deleteOne({ _id: parseInt(id) });
        console.log(result);
        if (result.deletedCount > 0) {
            res.status(200).json({ status: 'success', message: 'Product Deleted' });
        } else {
            res.status(400).json({ status: 'error', message: 'Delete failed' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete Product', error: error });
    }
}

module.exports = {
    placeOrder,
    getAllProducts,
    upload,
    update,
    remove,
    getOrderbyId
};
