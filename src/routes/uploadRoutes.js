import express from "express";
import upload from "../utils/multerConfig.js";

import {
  uploadCSV,
  getOrders,
  getGroupedOrders,
  getUploadSummary,
  completeGroup,
  completePartial,
  getHistoryOrders,
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
router.get("/summary", getUploadSummary);

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
 * @swagger
 * /api/complete-partial:
 *   post:
 *     summary: Complete order sebagian (partial completion)
 *     description: Memproses sebagian quantity dari group (variation + shipping_status)
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
 *               - quantity
 *             properties:
 *               upload_id:
 *                 type: integer
 *                 example: 1
 *               variation:
 *                 type: string
 *                 example: A5
 *               shipping_status:
 *                 type: string
 *                 example: besok
 *               quantity:
 *                 type: integer
 *                 example: 8
 *     responses:
 *       200:
 *         description: Partial complete success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 processed:
 *                   type: integer
 *                   example: 8
 *                 message:
 *                   type: string
 *                   example: Partial complete success 🔥
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post("/complete-partial", completePartial);

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
 * /api/history:
 *   get:
 *     summary: Get upload history (batch list)
 *     tags: [History]
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/history", getHistoryOrders);

/**
 * @swagger
 * /api/undo-group:
 *   post:
 *     summary: Undo group (balikin ke pending)
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:8
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