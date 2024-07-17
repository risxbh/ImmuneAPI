const express = require('express');
const { loginDelivery, registerDelivery, upload } = require('../controllers/deliveryPartnerController');

const router = express.Router();

router.post('/login', loginDelivery);
router.post('/register', upload.single('licenseNo'), registerDelivery);

module.exports = router;
