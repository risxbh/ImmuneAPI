const express = require("express");
const {
  create,
  getAllCategories,
  upload,
  update,
  remove,checkCategory,
  getSubCategoryByCategory,
} = require("../controllers/subCategoryController");

const router = express.Router();

router.post("/create", upload.single("img"), create);
router.get("/records", getAllCategories);
router.post("/update", upload.single("img"), update);
router.post("/delete", remove);
router.get("/getByCategory", getSubCategoryByCategory);
router.post('/check', checkCategory);

module.exports = router;
