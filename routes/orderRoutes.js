const express = require('express');
const { placeOrder, getAllProducts, upload, update,remove, getOrders } = require('../controllers/orderController');

const router = express.Router();

router.post('/create', async (req, res) => {
    try {
        const order = await placeOrder(req, res);

        // Emit a socket event to notify all connected clients about the new order
        global.io.emit('newOrder', order);

        res.status(200).json({ status: 'success', message: 'Order placed successfully', order });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Order placement failed', reason: error.message });
    }
});
router.get('/records', getAllProducts);
router.post('/update',upload.single('img'), update);
router.post('/delete', remove);
router.get('/:pharmacyId', getOrders);
module.exports = router;
