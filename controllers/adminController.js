const AgeGroup = require('../models/AgeGroup');
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
async function changeDocter(req, res) {
    try {
      const { id, isApproved,  } = req.body;
      const db = client.db("ImmunePlus");
      const collection = db.collection("Doctors");
  
      let updateFields = { isApproved };
  
      const result = await collection.updateOne(
        { _id: parseInt(id) },
        { $set: updateFields }
      );
  
      if (result.modifiedCount === 1) {
        // Send success response
        res.status(200).json({ status: "success", message: "Status Updated" });
      } else {
        res
          .status(400)
          .json({ status: "error", message: "Status update failed" });
      }
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to update status", error: error.message });
    }
  }

  async function changeDeliveryPartner(req, res) {
    try {
      const { id, isApproved,  } = req.body;
      const db = client.db("ImmunePlus");
      const collection = db.collection("DeliveryPartner");
  
      let updateFields = { isApproved };
  
      const result = await collection.updateOne(
        { _id: parseInt(id) },
        { $set: updateFields }
      );
  
      if (result.modifiedCount === 1) {
        // Send success response
        res.status(200).json({ status: "success", message: "Status Updated" });
      } else {
        res
          .status(400)
          .json({ status: "error", message: "Status update failed" });
      }
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to update status", error: error.message });
    }
  }

  async function changePharmacy(req, res) {
    try {
      const { id, isApproved,  } = req.body;
      const db = client.db("ImmunePlus");
      const collection = db.collection("Pharmacy");
  
      let updateFields = { isApproved };
  
      const result = await collection.updateOne(
        { _id: parseInt(id) },
        { $set: updateFields }
      );
  
      if (result.modifiedCount === 1) {
        // Send success response
        res.status(200).json({ status: "success", message: "Status Updated" });
      } else {
        res
          .status(400)
          .json({ status: "error", message: "Status update failed" });
      }
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to update status", error: error.message });
    }
  }



module.exports = {
    changeDocter,
    changePharmacy,
    changeDeliveryPartner,
};
