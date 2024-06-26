const express = require('express');
const { create, getAllProducts, upload, update,remove } = require('../controllers/productsController');

const router = express.Router();

router.post('/create', upload.single('img'), create);
router.get('/records', getAllProducts);
router.post('/update',upload.single('img'), update);
router.post('/delete', remove);

module.exports = router;
