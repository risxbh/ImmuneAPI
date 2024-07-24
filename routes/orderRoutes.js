const express = require('express');
const { placeOrder, getOrderbyId,receivePharmacyResponse, changeOrderStatus } = require('../controllers/orderController');

const router = express.Router();

router.post('/create', async (req, res) => {
    try {
        const order = await placeOrder(req, res);

        // Emit a socket event to notify all connected clients about the new order
        global.io.emit('newOrder', order);
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Order placement failed', reason: error.message });
    }
});
router.get('/id', getOrderbyId);
router.post('/request', receivePharmacyResponse);
router.post('/status', changeOrderStatus);
module.exports = router;
