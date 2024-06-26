const express = require('express');
const { loginUser, registerUser, updateUser, deleteUser,getAll, upload } = require('../controllers/pharmaController');

const router = express.Router();

router.post('/login', loginUser);
router.post('/register', upload.single('licenseImg'), registerUser);
router.post('/update', upload.single('licenseImg'), updateUser);
router.post('/delete', deleteUser);
router.get('/records', getAll);

module.exports = router;
