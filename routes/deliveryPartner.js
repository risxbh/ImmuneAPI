const express = require('express');
const { loginDelivery, registerDelivery, upload, updateDelivery, deleteDelivery, getAll, } = require('../controllers/deliveryPartnerController');

const router = express.Router();

router.post('/login', loginDelivery);
router.post('/register', upload.fields([{ name: 'licensePhoto', maxCount: 1 }, { name: 'rcPhoto', maxCount: 1 }]), registerDelivery);
router.post('/update',  upload.fields([{ name: 'licensePhoto', maxCount: 1 }, { name: 'rcPhoto', maxCount: 1 }]), updateDelivery);
router.post('/delete', deleteDelivery);
router.get('/records', getAll);
// router.get('/getById', getUserbyId);

module.exports = router;
