const bcrypt = require("bcrypt");
const { MongoClient, ServerApiVersion } = require("mongodb");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const url =
  "mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/?retryWrites=true&w=majority&appName=ImmunePlus";

let client = new MongoClient(url, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
});
const fast2sms = require("fast-two-sms");

const OTP_EXPIRY_TIME = 5 * 60 * 1000;
let otpStorage = {};
const crypto = require("crypto");
async function sendOTP(phoneNumber, otp) {
  const apiKey =
    "30YlkFZVrtRHCnOIs7PDUajxwEB4evX1SfmW8cMQiGJhLTpbz6FaB3tfYDXniMQNkThgoylJPA8VH15E";

  try {
    const options = {
      authorization: apiKey,
      message: `Your OTP is ${otp}. It is valid for 5 minutes.`,
      numbers: [phoneNumber],
      sender_id: "IMMPLUS",
    };
    await fast2sms
      .sendMessage(options)
      .then((res) => {
        console.log(res);
      })
      .catch((err) => {
        console.log(err);
      });
  } catch (error) {
    console.error("Error sending OTP:", error.message);
  }
}

const storage = multer.memoryStorage();
const upload = multer({ storage });

async function registerDelivery(req, res) {
  const {
    fullname,
    phoneNumber,
    address,
    licenseNo,
    experience,
    city,
    password,
    accountNumber,
    ifscCode,
    accountHolderName,
    bankName,
  } = req.body;
  let validations = [];
  let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;

  let passwordMessage = "";
  let phoneNumMessage = "";

  if (password) {
    if (password.length < 8 || password.length > 20) {
      passwordMessage = "Password should be between 8 to 20 characters.";
    } else {
      if (!regex.test(password)) {
        passwordMessage =
          "Password should contain at least one number, one special character, and one uppercase letter.";
      }
    }
  } else {
    passwordMessage = "Password is required.";
  }

  if (passwordMessage) {
    validations.push({ key: "password", message: passwordMessage });
  }

  if (
    !req.files ||
    !req.files.licensePhoto ||
    !req.files.licensePhoto[0].buffer
  )
    validations.push({
      key: "licensePhoto",
      message: "licensePhoto is required",
    });
  if (!req.files || !req.files.rcPhoto || !req.files.rcPhoto[0].buffer)
    validations.push({ key: "rcPhoto", message: "rcPhoto is required" });
  if (!req.files || !req.files.profilePic || !req.files.profilePic[0].buffer)
    validations.push({
      key: "Profile Pic",
      message: "Profile Pic is required",
    });
  if (!fullname)
    validations.push({ key: "fullname", message: "Full Name is required" });
  if (!address)
    validations.push({ key: "address", message: "Address is required" });
  if (!licenseNo)
    validations.push({ key: "licenseNo", message: "License No is required" });
  if (!city) validations.push({ key: "city", message: "City is required" });
  if (!experience)
    validations.push({ key: "experience", message: "Experience is required" });
  if (!accountNumber)
    validations.push({
      key: "accountNumber",
      message: "Account Number is required",
    });
  if (!ifscCode)
    validations.push({ key: "ifscCode", message: "IFSC Code is required" });
  if (!accountHolderName)
    validations.push({
      key: "accountHolderName",
      message: "Account Holder Name is required",
    });
  if (!bankName)
    validations.push({ key: "bankName", message: "Bank Name is required" });
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

  if (validations.length) {
    res.status(400).json({ status: "error", validations: validations });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("DeliveryPartner");
    const countersCollection = db.collection("Counters");

    const existingUser = await collection.findOne({ phoneNumber });

    if (existingUser) {
      res
        .status(400)
        .json({ status: "error", message: "Phone Number already exists" });
    } else {
      const counter = await countersCollection.findOneAndUpdate(
        { _id: "deliveryPartnerId" },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after" }
      );
      const newId = counter.seq;

      const licenseFilePath = path.join("uploads/delivery/license", `${newId}`);
      const rcFilePath = path.join("uploads/delivery/rc", `${newId}`);
      const profileFilePath = path.join(
        "uploads/delivery/profilePic",
        `${newId}`
      );

      if (!fs.existsSync("uploads/delivery/license")) {
        fs.mkdirSync("uploads/delivery/license", { recursive: true });
      }

      if (!fs.existsSync("uploads/delivery/rc")) {
        fs.mkdirSync("uploads/delivery/rc", { recursive: true });
      }
      if (!fs.existsSync("uploads/delivery/profile")) {
        fs.mkdirSync("uploads/delivery/profilePic", { recursive: true });
      }

      fs.writeFileSync(licenseFilePath, req.files.licensePhoto[0].buffer);
      fs.writeFileSync(rcFilePath, req.files.rcPhoto[0].buffer);
      fs.writeFileSync(profileFilePath, req.files.profilePic[0].buffer);

      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await collection.insertOne({
        _id: newId,
        fullname,
        phoneNumber,
        address,
        licenseNo,
        licensePhoto: licenseFilePath,
        rcPhoto: rcFilePath,
        experience,
        city,
        password: hashedPassword,
        profilePic: profileFilePath,
        accountNumber,
        ifscCode,
        accountHolderName,
        bankName,
        isApproved: 0
      });

      if (result.acknowledged) {
        res.status(200).json({
          status: "success",
          message: "Delivery partner registered successfully",
        });
      } else {
        res
          .status(400)
          .json({ status: "error", message: "Registration failed" });
      }
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "An error occurred during registration",
      reason: error.message,
    });
  } finally {
    //await client.close();
  }
}

async function loginDelivery(req, res) {
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
      const storedOtp = otpStorage[phoneNumber];
      if (storedOtp && Date.now() < storedOtp.expiry) {
        if (storedOtp.value === otp) {
          await client.connect();
          const db = client.db("ImmunePlus");
          const collection = db.collection("DeliveryPartner");
          const user = await collection.findOne({ phoneNumber });

          if (user) {
            const result = await bcrypt.compare(password, user.password);
            if (result) {
              if (user.isApproved == 1) {
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
                  profilePic: user.profilePic,
                };
                res.json({
                  status: "success",
                  message: "Login successful!",
                  user: userInfo,
                });
              } else if (user.isApproved == 2) {
                res.json({ status: 'decline', message: 'Your Profile is been Declined' });
              } else {
                res.json({ status: 'pending', message: 'Your Profile is not been approved' });
              }
            } else {
              res.status(400).json({
                status: "error",
                message: "Invalid Phone Number",
              });
            }
          } client.close();
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
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

async function updateDelivery(req, res) {
  const {
    id,
    password,
    address,
    fullName,
    licenseNo,
    experience,
    city,
    phoneNumber,
    accountNumber,
    ifscCode,
    accountHolderName,
    bankName,
  } = req.body;
  let validations = [];
  let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;

  if (!id)
    validations.push({ key: "id", message: "Delivery Partner ID is required" });

  if (
    password &&
    (password.length < 8 || password.length > 20 || !regex.test(password))
  ) {
    validations.push({
      key: "password",
      message:
        "Password should be between 8 to 20 characters, contain at least one number, one special character, and one uppercase letter.",
    });
  }

  if (validations.length) {
    res.status(400).json({ status: "error", validations: validations });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("DeliveryPartner");

    const user = await collection.findOne({ _id: parseInt(id) });

    if (!user) {
      res
        .status(400)
        .json({ status: "error", message: "Delivery Partner not found" });
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
    if (bankName) updatedFields.bankName = bankName;

    if (req.files) {
      if (req.files.licensePhoto && req.files.licensePhoto[0]) {
        const licenseFilePath = path.join("uploads/delivery/license", `${id}`);
        fs.writeFileSync(licenseFilePath, req.files.licensePhoto[0].buffer);
        updatedFields.licensePhoto = licenseFilePath;
      }
      if (req.files.rcPhoto && req.files.rcPhoto[0]) {
        const rcFilePath = path.join("uploads/delivery/rc", `${id}`);
        fs.writeFileSync(rcFilePath, req.files.rcPhoto[0].buffer);
        updatedFields.rcPhoto = rcFilePath;
      }
      if (req.files.profilePic && req.files.profilePic[0]) {
        const profilePicFilePath = path.join(
          "uploads/delivery/profilePic",
          `${id}`
        );
        fs.writeFileSync(rcFilePath, req.files.profilePic[0].buffer);
        updatedFields.profilePic = profilePicFilePath;
      }
    }

    const result = await collection.updateOne(
      { _id: id },
      { $set: updatedFields }
    );
    console.log(result);
    if (result.modifiedCount > 0) {
      res.status(200).json({
        status: "success",
        message: "Delivery Partner updated successfully",
      });
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
    //await client.close();
  }
}

// Delete user controller
async function deleteDelivery(req, res) {
  const { id } = req.body;

  if (!id) {
    res
      .status(400)
      .json({ status: "error", message: "Delivery Partner ID is required" });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("DeliveryPartner");

    const user = await collection.findOne({ _id: parseInt(id) });

    if (!user) {
      res
        .status(400)
        .json({ status: "error", message: "Delivery Partner not found" });
      return;
    }

    const result = await collection.deleteOne({ _id: id });

    if (result.deletedCount > 0) {
      res.status(200).json({
        status: "success",
        message: "Delivery Partner deleted successfully",
      });
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
    //await client.close();
  }
}

async function getAll(req, res) {
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("DeliveryPartner");

    const users = await collection.find().toArray();
    res.json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch users", error: error.message });
  }
}

async function getAvailableOrders(req, res) {
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const ordersCollection = db.collection("acceptedOrders");
    const pharmacyCollection = db.collection("Pharmacy"); // Change the collection to "pharmacies"

    const orders = await ordersCollection.find({ assignedPartner: null }).toArray();

    // Enrich orders with pharmacy address
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const pharmacy = await pharmacyCollection.findOne({ _id: order.assignedPharmacy });
        return {
          ...order,
          pharmacyAddress: pharmacy?.address || "Address not found", // Add the address to the order
        };
      })
    );

    res.json(enrichedOrders);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch Orders", error: error.message });
  } finally {
    // await client.close(); // Ensure the client connection is closed after the operation
  }
}

async function getUserbyId(req, res) {
  const { id } = req.query;

  if (!id) {
    res
      .status(400)
      .json({ status: "error", message: "Delivery Partner ID is required" });
    return;
  }
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("DeliveryPartner");
    const user = await collection.find({ _id: parseInt(id) }).toArray();
    if (user.length === 0) {
      res
        .status(404)
        .json({ status: "error", message: "Delivery Partner not found" });
    } else {
      res.json(user);
    }
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch Delivery Partner",
      error: error.message,
    });
  }
}

async function assignOrderToPartner(req, res) {
  const { orderId, id } = req.body;
  if (!orderId) {
    res.status(400).json({ status: "error", message: "Order ID is required" });
    return;
  }
  if (!id) {
    res.status(400).json({ status: "error", message: "User ID is required" });
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
      res.status(404).json({ status: "error", message: "Order not found" });
      return;
    }

    if (order.assignedPartner) {
      res.status(400).json({ status: "error", message: "Order already taken" });
      return;
    }

    // Update order with assigned partner
    await ordersCollection.updateOne(
      { _id: orderId },
      { $set: { assignedPartner: id, status: 3 } }
    );

    // Generate new payment ID
    const counter = await countersCollection.findOneAndUpdate(
      { _id: "paymentId" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    const newPaymentId = counter.seq;
    const dateInIST = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });

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
      res.status(200).json({
        status: "success",
        message: "Payment created successfully",
        paymentId: newPaymentId,
      });
    } else {
      throw new Error("Failed to create payment");
    }
  } catch (error) {
    console.error("Error assigning order to pharmacy:", error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  } finally {
    await client.close();
  }
}

async function getUserbyId(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ status: "error", message: "User ID is required" });
    return;
  }
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("DeliveryPartner");
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

let isConnected = false;
async function connectToDatabase() {
  if (!isConnected) {
    try {
      await client.connect();
      isConnected = true;
    } catch (err) {
      throw err;
    }
  }
}
async function Dashboard(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ status: "error", message: "User ID is required" });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const ordersCollection = db.collection("Orders");
    const paymentsCollection = db.collection("paymentDelivery");

    const today = new Date().toISOString().split("T")[0];

    // Fetch all orders assigned to the partner
    const ordersData = await ordersCollection
      .find({ assignedPartner: parseInt(id) })
      .toArray();

    // Calculate stats from orders
    const stats = ordersData.reduce(
      (acc, order) => {
        const orderDate = new Date(order.date).toISOString().split("T")[0]; // Extract date in YYYY-MM-DD forma

        if (orderDate === today) {
          acc.todayOrder += 1;
          acc.money += 50;
          if (order.status > 3 && order.status < 7) {
            acc.runningOrder += 1;
          } else if (order.status >= 7) {
            acc.totalOrderDelivered += 1;
          }
        }

        return acc;
      },
      {
        totalOrderDelivered: 0,
        todayOrder: 0,
        runningOrder: 0,
        money: 0,
      }
    );

    // Calculate total payments due
    const paymentsDue = await paymentsCollection
      .aggregate([
        { $match: { userId: parseInt(id), status: { $in: [0, 1] } } },
        { $group: { _id: null, totalDue: { $sum: "$amount" } } },
      ])
      .toArray();

    const totalPaymentsDue =
      paymentsDue.length > 0 ? paymentsDue[0].totalDue : 0;

    // Include total payments due in the response
    res.json({
      totalOrderDelivered: stats.totalOrderDelivered,
      todayOrder: stats.todayOrder,
      runningOrder: stats.runningOrder,
      moneyMadeToday: stats.money,
      totalPaymentsDue: totalPaymentsDue,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch data", error: error.message });
  } finally {
    //await client.close();
  }
}

async function getOrderHistoryById(req, res) {
  const { id } = req.query;

  if (!id) {
    res
      .status(400)
      .json({ status: "error", message: "Delivery Partner ID is required" });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const ordersCollection = db.collection("Orders");

    // Find orders assigned to the delivery partner
    const orders = await ordersCollection.find({ assignedPartner: parseInt(id) }).toArray();

    if (orders.length === 0) {
      res
        .status(404)
        .json({ status: "error", message: "No orders found for this Delivery Partner" });
    } else {
      res.json({ status: "success", orders });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching order history",
      reason: error.message,
    });
  } finally {
    //await client.close();
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
  Dashboard,
  getOrderHistoryById,
  upload,
};
