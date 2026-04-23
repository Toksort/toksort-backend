import express from "express";
import upload from "../utils/multerConfig.js";

import {
  uploadCSV,
  getOrders,
  getGroupedOrders,
  getSummary,
  completeGroup,
  getHistory,
  getAllFiles,
  deleteFile,
  deleteAllFiles,
  undoCompleteGroup 
} from "../controllers/csvController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Orders
 *     description: Order Management (PostgreSQL)
 *   - name: Uploads
 *     description: Upload & batch history
 *   - name: Files
 *     description: File system (optional)
 */

/**
 * =========================
 * 🔥 ORDERS
 * =========================
 */

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get orders (latest upload by default)
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: variation
 *         schema:
 *           type: string
 *         example: A5
 *       - in: query
 *         name: shipping_status
 *         schema:
 *           type: string
 *         example: today
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/orders", getOrders);

/**
 * @swagger
 * /api/grouped-orders:
 *   get:
 *     summary: Get grouped orders (variation + shipping)
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: upload_id
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/grouped-orders", getGroupedOrders);

/**
 * @swagger
 * /api/summary:
 *   get:
 *     summary: Summary quantity per variation
 *     tags: [Orders]
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/summary", getSummary);

/**
 * @swagger
 * /api/complete-group:
 *   post:
 *     summary: Complete 1 group (1 klik dari FE)
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - variation
 *               - shipping_status
 *             properties:
 *               upload_id:
 *                 type: integer
 *                 example: 1
 *               variation:
 *                 type: string
 *                 example: A5
 *               shipping_status:
 *                 type: string
 *                 example: Kirim Hari ini
 *     responses:
 *       200:
 *         description: Group completed
 */
router.post("/complete-group", completeGroup);

/**
 * =========================
 * 🚀 UPLOAD
 * =========================
 */

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload CSV → insert ke database (multi batch)
 *     tags: [Uploads]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Upload success
 */
router.post("/upload", upload.single("file"), uploadCSV);

/**
 * @swagger
 * /api/uploads:
 *   get:
 *     summary: Get upload history (batch list)
 *     tags: [Uploads]
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/uploads", getHistory);

/**
 * =========================
 * 📁 FILE SYSTEM (OPTIONAL)
 * =========================
 */

/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: List CSV files (optional debug)
 *     tags: [Files]
 */
router.get("/files", getAllFiles);

/**
 * @swagger
 * /api/delete/{filename}:
 *   delete:
 *     summary: Delete specific CSV file
 *     tags: [Files]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 */
router.delete("/delete/:filename", deleteFile);

/**
 * @swagger
 * /api/delete-all:
 *   delete:
 *     summary: Delete all CSV files
 *     tags: [Files]
 */
router.delete("/delete-all", deleteAllFiles);

/**
 * @swagger
 * /api/undo-group:
 *   post:
 *     summary: Undo group (balikin ke pending)
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - upload_id
 *               - variation
 *               - shipping_status
 *             properties:
 *               upload_id:
 *                 type: integer
 *                 example: 1
 *               variation:
 *                 type: string
 *                 example: A5
 *               shipping_status:
 *                 type: string
 *                 example: Kirim Hari ini
 *     responses:
 *       200:
 *         description: Undo success
 */
router.post("/undo-group", undoCompleteGroup);

export default router;