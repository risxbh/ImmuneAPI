const express = require('express');
const {
    changeDocter,
    changePharmacy,
    changeDeliveryPartner, login
} = require('../controllers/adminController');

const router = express.Router();

router.post('/changeDocterStatus', changeDocter);
router.get('/changePharmaStatus', changePharmacy);
router.post('/changeDelParStatus', changeDeliveryPartner);
router.post('/login', login);

module.exports = router;
