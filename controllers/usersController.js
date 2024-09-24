const bcrypt = require("bcrypt");
const { MongoClient, ServerApiVersion } = require("mongodb");
const User = require("../models/User");
const url =
  "mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/?retryWrites=true&w=majority&appName=ImmunePlus";
const client = new MongoClient(url, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const fast2sms = require("fast-two-sms");

const OTP_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes
let otpStorage = {}; // Temporary in-memory storage for OTPs
const crypto = require("crypto");
async function sendOTP(phoneNumber, otp) {
  const apiKey =
    "30YlkFZVrtRHCnOIs7PDUajxwEB4evX1SfmW8cMQiGJhLTpbz6FaB3tfYDXniMQNkThgoylJPA8VH15E";
  // var options = {authorization : apiKey , message : `Your OTP is ${otp}. It is valid for 5 minutes.` ,  numbers : ['7477367855']}
  // fast2sms.sendMessage(options).then(response=>{
  //     console.log(response)
  //   })

  try {
    const options = {
      authorization: apiKey,
      message: `Your OTP is ${otp}. It is valid for 5 minutes.`,
      numbers: [phoneNumber], // Pass numbers as an array
      sender_id: "IMMPLUS", // Specify the sender ID here
    };
    await fast2sms
      .sendMessage(options)
      .then((res) => {
        console.log(res);
      })
      .catch((err) => {
        console.log(err);
      });
    // console.log('OTP sent successfully:', response);
  } catch (error) {
    console.error("Error sending OTP:", error.message);
  }
}

async function loginUser(req, res) {
  const { phoneNumber, otp } = req.body;
  let validations = [];
  let phoneNumMessage = "";

  if (!phoneNumber) {
    phoneNumMessage = "Phone Number is required.";
  } else if (phoneNumber.length < 10 || phoneNumber.length > 10) {
    phoneNumMessage = "Phone Number should habe 10 digits.";
  }

  if (phoneNumMessage) {
    validations.push({ key: "Phone Number", message: phoneNumMessage });
  }

  if (validations.length) {
    res.status(400).json({ status: "error", validations: validations });
    return;
  }

  try {
    if (otp) {
      // OTP verification
      const storedOtp = otpStorage[phoneNumber];
      if (storedOtp && Date.now() < storedOtp.expiry) {
        if (storedOtp.value === otp) {
          // Successful OTP verification
          await client.connect();
          const db = client.db("ImmunePlus");
          const collection = db.collection("Users");

          const user = await collection.findOne({ phoneNumber: phoneNumber });
          if (user) {
            const userInfo = {
              fullName: user.fullName,
              id: user._id,
              gender: user.gender,
              address: user.address,
              state: user.state,
              ageGroup: user.ageGroup,
              email: user.email,
              pincode: user.pincode,
              phoneNumber: user.phoneNumber,
              previousHistory: user.previousHistory,
            };

            res.json({
              status: "success",
              message: "Login successful!",
              user: userInfo,
            });
          } else {
            res
              .status(400)
              .json({ status: "error", message: "Invalid Phone Number" });
          }

          client.close();
        } else {
          res.status(400).json({ status: "error", message: "Invalid OTP" });
        }
      } else {
        res
          .status(400)
          .json({ status: "error", message: "OTP expired or invalid" });
      }
    } else {
      // Generate and send OTP
      const otp = crypto.randomInt(100000, 999999).toString();
      otpStorage[phoneNumber] = {
        value: otp,
        expiry: Date.now() + OTP_EXPIRY_TIME,
      };

      await sendOTP(phoneNumber, otp);
      res.json({ status: "success", message: "OTP sent to your phone number" });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

// User registration controller
async function registerUser(req, res) {
  // {
  //   "id": "123",
  //   "addresses": [
  //     { "street": "123 New St", "city": "City A", "pincode": "123456" },
  //     { "street": "456 Old St", "city": "City B", "pincode": "654321" }
  //   ],
  //   "fullName": "John Doe",
  //   "email": "john.doe@example.com",
  //   "gender": "male",
  //   "state": "NY",
  //   "pincode": "10001",
  //   "phoneNumber": "1234567890"
  // }

  const {
    addresses, // Change to addresses (an array)
    fullName,
    ageGroup,
    email,
    gender,
    state,
    pincode,
    phoneNumber,
    previousHistory,
    otp, // Added for OTP verification
  } = req.body;

  let validations = [];
  let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;
  let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let phoneNumMessage = "";

  if (phoneNumber) {
    if (phoneNumber.length !== 10) {
      phoneNumMessage = "Phone Number should have 10 digits.";
    }
  } else {
    phoneNumMessage = "Phone Number is required.";
  }

  if (phoneNumMessage) {
    validations.push({ key: "phoneNumber", message: phoneNumMessage });
  }

  if (!addresses || addresses.length === 0)
    validations.push({
      key: "addresses",
      message: "At least one address is required",
    });
  if (!fullName)
    validations.push({ key: "fullName", message: "Full name is required" });
  if (email && !emailRegex.test(email))
    validations.push({ key: "email", message: "Email is not valid" });
  if (!gender)
    validations.push({ key: "gender", message: "Gender is required" });
  if (!state) validations.push({ key: "state", message: "State is required" });
  if (!pincode)
    validations.push({ key: "pincode", message: "Pincode is required" });
  if (!phoneNumber)
    validations.push({
      key: "phoneNumber",
      message: "Phone number is required",
    });
  if (!ageGroup)
    validations.push({ key: "ageGroup", message: "Age Group is required" });

  if (validations.length) {
    res.status(400).json({ status: "error", validations: validations });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Users");
    const countersCollection = db.collection("Counters");

    const existingUser = await collection.findOne({ phoneNumber });
    if (existingUser) {
      res
        .status(400)
        .json({ status: "error", validations: "Phone Number already exists." });
      return;
    }

    if (otp) {
      const storedOtp = otpStorage[phoneNumber];
      if (storedOtp && Date.now() < storedOtp.expiry) {
        if (storedOtp.value === otp) {
          const counter = await countersCollection.findOneAndUpdate(
            { _id: "userId" },
            { $inc: { seq: 1 } },
            { upsert: true, returnDocument: "after" }
          );
          const newId = counter.value.seq;

          const result = await collection.insertOne({
            addresses, // Storing multiple addresses
            fullName,
            ageGroup,
            email,
            gender,
            state,
            pincode,
            phoneNumber,
            previousHistory,
            _id: newId,
          });

          if (result.acknowledged === true) {
            res.status(200).json({
              status: "success",
              message: "User registered successfully",
              userInfo: result,
            });
          } else {
            res
              .status(400)
              .json({ status: "error", message: "Registration failed" });
          }
        } else {
          res.status(400).json({ status: "error", message: "Invalid OTP" });
        }
      } else {
        res
          .status(400)
          .json({ status: "error", message: "OTP expired or invalid" });
      }
    } else {
      const otp = crypto.randomInt(100000, 999999).toString();
      otpStorage[phoneNumber] = {
        value: otp,
        expiry: Date.now() + OTP_EXPIRY_TIME,
      };

      await sendOTP(phoneNumber, otp);
      res.json({ status: "success", message: "OTP sent to your phone number" });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "An error occurred during registration",
      reason: error.message,
    });
  }
}

async function addEditAddressById(req, res) {
  const { userId } = req.params; // Get userId from request params
  const { newAddress, index } = req.body; // `newAddress` is the address to add/edit, `index` is optional

  if (!userId) {
    res.status(400).json({ status: "error", message: "User ID is required" });
    return;
  }

  if (!newAddress) {
    res.status(400).json({ status: "error", message: "Address is required" });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Users");

    // Find the user by userId
    const user = await collection.findOne({ _id: parseInt(userId) });

    if (!user) {
      res.status(404).json({ status: "error", message: "User not found" });
      return;
    }

    let updatedAddresses = [...user.addresses]; // Copy existing addresses

    // If an index is provided, update that specific address
    if (index !== undefined && index >= 0 && index < updatedAddresses.length) {
      updatedAddresses[index] = newAddress; // Edit the address at the specified index
    } else {
      // Otherwise, add the new address to the array
      updatedAddresses.push(newAddress);
    }

    // Update the user's addresses in the database
    const result = await collection.updateOne(
      { _id: parseInt(userId) },
      { $set: { addresses: updatedAddresses } }
    );

    if (result.modifiedCount === 1) {
      res.status(200).json({
        status: "success",
        message: "Address updated successfully",
        updatedAddresses,
      });
    } else {
      res
        .status(400)
        .json({ status: "error", message: "Failed to update address" });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "An error occurred while updating the address",
      reason: error.message,
    });
  } finally {
    //await client.close();
  }
}

async function updateUser(req, res) {
  const {
    id,
    addresses, // Now expects addresses as an array
    fullName,
    ageGroup,
    email,
    gender,
    state,
    pincode,
    phoneNumber,
    previousHistory,
  } = req.body;

  let validations = [];
  let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Validate ID
  if (!id) validations.push({ key: "id", message: "User ID is required" });

  // Validate email format if provided
  if (email && !emailRegex.test(email))
    validations.push({ key: "email", message: "Email is not valid" });

  // Return validation errors if any
  if (validations.length) {
    res.status(400).json({ status: "error", validations: validations });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Users");

    // Find user by id
    const user = await collection.findOne({ _id: id });

    if (!user) {
      res.status(400).json({ status: "error", message: "User not found" });
      return;
    }

    // Prepare fields for update
    const updatedFields = {};

    if (addresses && Array.isArray(addresses))
      updatedFields.addresses = addresses;
    if (fullName) updatedFields.fullName = fullName;
    if (ageGroup) updatedFields.ageGroup = ageGroup;
    if (email) updatedFields.email = email;
    if (gender) updatedFields.gender = gender;
    if (state) updatedFields.state = state;
    if (pincode) updatedFields.pincode = pincode;
    if (phoneNumber) updatedFields.phoneNumber = phoneNumber;
    if (previousHistory) updatedFields.previousHistory = previousHistory;

    // Update the user
    const result = await collection.updateOne(
      { _id: id },
      { $set: updatedFields }
    );

    if (result.modifiedCount > 0) {
      res
        .status(200)
        .json({ status: "success", message: "User updated successfully" });
    } else {
      res
        .status(400)
        .json({ status: "error", message: "Failed to update user" });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "An error occurred during update",
      reason: error.message,
    });
  } finally {
    // await client.close();
  }
}

// Delete user controller
async function deleteUser(req, res) {
  const { id } = req.body;

  if (!id) {
    res.status(400).json({ status: "error", message: "User ID is required" });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Users");

    const user = await collection.findOne({ _id: id });

    if (!user) {
      res.status(400).json({ status: "error", message: "User not found" });
      return;
    }

    const result = await collection.deleteOne({ _id: id });

    if (result.deletedCount > 0) {
      res
        .status(200)
        .json({ status: "success", message: "User deleted successfully" });
    } else {
      res
        .status(400)
        .json({ status: "error", message: "Failed to delete user" });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "An error occurred during deletion",
      reason: error,
    });
  } finally {
    // await client.close();
  }
}

async function getAll(req, res) {
  try {
    const db = client.db("ImmunePlus");
    const collection = db.collection("Users");

    const users = await collection.find().toArray();
    res.json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch users", error: error.message });
  }
}

async function getUserbyId(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ status: "error", message: "User ID is required" });
    return;
  }
  try {
    const db = client.db("ImmunePlus");
    const collection = db.collection("Users");
    const user = await collection.find({ _id: parseInt(id) }).toArray();
    if (user.length === 0) {
      res.status(404).json({ status: "error", message: "User not found" });
    } else {
      res.json(user);
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch User", error: error.message });
  }
}

async function getUserAppointment(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ status: "error", message: "Docter ID is required" });
    return;
  }
  try {
    const db = client.db("ImmunePlus");
    const collection = db.collection("appointments");
    const user = await collection.find({ patientId: parseInt(id) }).toArray();
    if (user.length === 0) {
      res.status(404).json({ status: "error", message: "User not found" });
    } else {
      res.json(user);
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch User", error: error.message });
  }
}

async function dummyLoginUser(req, res) {
  const { phoneNumber } = req.body;
  let validations = [];
  let phoneNumMessage = "";

  if (!phoneNumber) {
    phoneNumMessage = "Phone Number is required.";
  } else if (phoneNumber.length < 10 || phoneNumber.length > 10) {
    phoneNumMessage = "Phone Number should habe 10 digits.";
  }

  if (phoneNumMessage) {
    validations.push({ key: "Phone Number", message: phoneNumMessage });
  }

  if (validations.length) {
    res.status(400).json({ status: "error", validations: validations });
    return;
  }

  try {
    // Successful OTP verification
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Users");

    const user = await collection.findOne({ phoneNumber: phoneNumber });
    if (user) {
      const userInfo = {
        fullName: user.fullName,
        id: user._id,
        gender: user.gender,
        address: user.address,
        state: user.state,
        ageGroup: user.ageGroup,
        email: user.email,
        pincode: user.pincode,
        phoneNumber: user.phoneNumber,
        previousHistory: user.previousHistory,
      };

      res.json({
        status: "success",
        message: "Login successful!",
        user: userInfo,
      });
    } else {
      res
        .status(400)
        .json({ status: "error", message: "Invalid Phone Number" });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
}
module.exports = {
  loginUser,
  registerUser,
  updateUser,
  deleteUser,
  getAll,
  getUserbyId,
  getUserAppointment,
  dummyLoginUser,
  addEditAddressById,
};
