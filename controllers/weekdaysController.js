
const { MongoClient, ServerApiVersion } = require('mongodb');
const url = 'mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/?retryWrites=true&w=majority&appName=ImmunePlus';
const client = new MongoClient(url, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Controller function to create a new age group
async function create(req, res) {
    try {
        await client.connect();
        const { name } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("Weekdays");
        const countersCollection = db.collection("Counters");

        let validations = [];
       
        if (!name) validations.push({ key: 'name', message: 'Name is required' });

        let existing = await collection.findOne({ name });

        if (validations.length) {
            res.status(400).json({ status: 'error', validations: validations });
            return;
        }

        if (existing) {
            res.status(400).json({ status: 'error', message: 'Weekday already exists' });
        } else {

            // Get and increment the counter for TypeOfTreatment
            const counter = await countersCollection.findOneAndUpdate(
                { _id: "weekdayId" },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
            const newId = counter.seq;
         
            const result = await collection.insertOne({
                _id: newId,
                name,
            });

            if (result.acknowledged === true) {
                return res.status(200).json({ status: 'success', message: 'Weekdays Saved' });
            } else {
                res.status(400).json({ status: 'error', message: 'Creation failed' });
            }
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to create Weekdays', error: error.message });
    }
}

// Controller function to get all age groups
async function getAll(req, res) {
    try {
        const db = client.db("ImmunePlus");
        const collection = db.collection("Weekdays");
        
        const weekday = await collection.find().toArray();
        res.json(weekday);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch age groups', error: error.message });
    }
}

async function update(req, res) {
    try {
 // Ensure the client is connected

        const { id,  name } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("Weekdays");

        let updateFields = {  name, description };

        
        let existing = await collection.findOne({ name });

        if (existing) {
            res.status(400).json({ status: 'error', message: 'Weekday already exists' });
        } else {


        const result = await collection.updateOne(
            { _id: parseInt(id) },
            { $set: updateFields }
        );

        if (result.modifiedCount === 1) {
            res.status(200).json({ status: 'success', message: 'Weekday Updated' });
        } else {
            res.status(400).json({ status: 'error', message: 'Update failed' });
        }
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to update Weekday', error: error.message });
    }
}

// Controller function to delete a TypeOfTreatment
async function remove(req, res) {
    try {
        const { id } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("Weekdays");

        const result = await collection.deleteOne({ _id: id });
        if (result.deletedCount> 0) {
            res.status(200).json({ status: 'success', message: 'Weekday Deleted' });
        } else {
            res.status(400).json({ status: 'error', message: 'Delete failed'  });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete Weekday', error: error });
    }
}




module.exports = {
    create,
    getAll,
    update,
    remove
};
