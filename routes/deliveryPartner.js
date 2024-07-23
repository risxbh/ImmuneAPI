const express = require('express');
const { loginDelivery, registerDelivery, upload } = require('../controllers/deliveryPartnerController');

const router = express.Router();

router.post('/login', loginDelivery);
router.post('/register', upload.fields([{ name: 'licenseImg' }, { name: 'rcImg' }]), registerDelivery);


module.exports = router;
