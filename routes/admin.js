const express = require('express');
const {
    changeDocter,
    changePharmacy,
    changeDeliveryPartner
} = require('../controllers/adminController');

const router = express.Router();

router.post('/changeDocterStatus', changeDocter);
router.get('/changePharmaStatus', changePharmacy);
router.post('/changeDelParStatus', changeDeliveryPartner);

module.exports = router;
