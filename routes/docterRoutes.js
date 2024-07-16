const express = require('express');
const { loginDoctor, registerDoctor, updateDoctor,upload, deleteDoctor,getAll,getAllAvailableDocter,getDocterbyId,bookAppointment,createSchedule,filterSchedules } = require('../controllers/doctersController');

const router = express.Router();

router.post('/login', loginDoctor);
router.post('/register', upload.single('img'), registerDoctor);
router.post('/update',upload.single('img'), updateDoctor);
router.post('/delete', deleteDoctor);
router.get('/records', getAll);
router.get('/getAllAvailable', getAllAvailableDocter);
router.get('/getById', getDocterbyId);
router.post('/book', bookAppointment);
router.post('/schedule', createSchedule);
router.get('/filterSchedules', filterSchedules);

module.exports = router;
