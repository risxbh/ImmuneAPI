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
const storage = multer.memoryStorage();
const upload = multer({ storage });

async function create(req, res) {
    try {
        await client.connect();
        const { name, description, price, pieces, dose, category } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("Products");
        const countersCollection = db.collection("Counters");

        let validations = [];

        if (!description) validations.push({ key: 'description', message: 'Description is required' });
        if (!name) validations.push({ key: 'name', message: 'Name is required' });
        if (!price) validations.push({ key: 'price', message: 'Price is required' });
        if (!pieces) validations.push({ key: 'pieces', message: 'Pieces is required' });
        if (!dose) validations.push({ key: 'dose', message: 'Dose is required' });
        if (!category) validations.push({ key: 'category', message: 'At least 1 Category is required' });
        if (!req.file || !req.file.buffer) validations.push({ key: 'img', message: 'Image is required' });

        if (validations.length) {
            return res.status(400).json({ status: 'error', validations: validations });
        }

        let existing = await collection.findOne({ name });

        if (existing) {
            return res.status(400).json({ status: 'error', message: 'Product already exists' });
        } else {
            const filePath = path.join('uploads/product', req.file.originalname);
            if (!fs.existsSync('uploads/product')) {
                fs.mkdirSync('uploads/product', { recursive: true });
            }
            fs.writeFileSync(filePath, req.file.buffer);

            // Ensure pieces and dose are strings before attempting to split them
            let piecesArray, doseArray, categoryArray;

            if (typeof pieces === 'string') {
                piecesArray = pieces.split(',').map(item => parseFloat(item.trim()));
            } else if (Array.isArray(pieces)) {
                piecesArray = pieces.map(item => parseFloat(item));
            } else {
                piecesArray = [];
            }

            if (typeof dose === 'string') {
                doseArray = dose.split(',').map(item => parseFloat(item.trim()));
            } else if (Array.isArray(dose)) {
                doseArray = dose.map(item => parseFloat(item));
            } else {
                doseArray = [];
            }

            if (typeof category === 'string') {
                categoryArray = category.split(',').map(item => parseFloat(item.trim()));
            } else if (Array.isArray(category)) {
                categoryArray = dose.map(item => parseFloat(item));
            } else {
                categoryArray = [];
            }

            if (!Array.isArray(piecesArray) || piecesArray.length === 0) {
                return res.status(400).json({ status: 'error', message: 'Pieces should be a non-empty array' });
            }

            if (!Array.isArray(doseArray) || doseArray.length === 0) {
                return res.status(400).json({ status: 'error', message: 'Dose should be a non-empty array' });
            }

            
            if (!Array.isArray(categoryArray) || categoryArray.length === 0) {
                return res.status(400).json({ status: 'error', message: 'Dose should be a non-empty array' });
            }

            // Get and increment the counter for TypeOfTreatment
            const counter = await countersCollection.findOneAndUpdate(
                { _id: "productId" },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
            const newId = counter.seq;

            const result = await collection.insertOne({
                _id: newId,
                name,
                description,
                img: filePath,
                price,
                pieces: piecesArray,
                dose: doseArray,
                category: categoryArray
            });

            if (result.acknowledged === true) {
                return res.status(200).json({ status: 'success', message: 'Product Saved' });
            } else {
                return res.status(400).json({ status: 'error', message: 'Creation failed' });
            }
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to create product', error: error.message });
    } finally {
        await client.close();
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
    create,
    getAllProducts,
    upload,
    update,
    remove
};
