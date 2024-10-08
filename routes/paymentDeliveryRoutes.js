const express = require('express');
const {
    createPayment,
    getAllPayments,
    update,
    remove
} = require('../controllers/paymentDeliveryController');

const router = express.Router();

router.post('/create', createPayment);
router.get('/records', getAllPayments);
router.post('/update', update);
router.post('/delete', remove);

module.exports = router;
