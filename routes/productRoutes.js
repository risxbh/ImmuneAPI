const express = require("express");
const {
  create,
  getAllProducts,
  upload,
  update,
  remove,
  getProductById,
  searchProducts,
} = require("../controllers/productsController");

const router = express.Router();

router.post("/create", create);
router.get("/records", getAllProducts);
router.post("/update", upload.single("img"), update);
router.post("/delete", remove);
router.get("/getById", getProductById);
router.post("/search", searchProducts);

module.exports = router;
