import express from "express";
import upload from "../utils/multerConfig.js";
import {
  uploadCSV,
  getCSVHistory,
  readCSV,
  deleteFile,
  deleteAllFiles,
  getAllFiles,
  getOrders,
  getSummary,
  completeGroup
} from "../controllers/csvController.js";
import { deleteOldFiles, checkDailyLimit } from "../utils/fileCleaner.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order Management API (CSV + SQLite)
 */

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Ambil semua order (dari database)
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
 * /api/upload:
 *   post:
 *     summary: Upload file CSV ke database
 *     tags: [Orders]
 */
router.post(
  "/upload",
  (req, res, next) => {
    deleteOldFiles();

    if (checkDailyLimit()) {
      return res.status(429).json({
        success: false,
        message: "Upload limit reached (max 10 files/day)",
      });
    }

    next();
  },
  upload.single("file"),
  uploadCSV
);

/**
 * @swagger
 * /api/summary:
 *   get:
 *     summary: Summary order (group by variation)
 *     tags: [Orders]
 */
router.get("/summary", getSummary);

/**
 * @swagger
 * /api/complete-group:
 *   post:
 *     summary: Tandai group sebagai selesai
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
 *               variation:
 *                 type: string
 *                 example: A5
 *               shipping_status:
 *                 type: string
 *                 example: today
 *     responses:
 *       200:
 *         description: Berhasil update status
 */
router.post("/complete-group", completeGroup);

/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: List file CSV (opsional)
 *     tags: [Files]
 */
router.get("/files", getAllFiles);

/**
 * @swagger
 * /api/delete/{filename}:
 *   delete:
 *     summary: Hapus file CSV
 *     tags: [Files]
 */
router.delete("/delete/:filename", deleteFile);

/**
 * @swagger
 * /api/delete-all:
 *   delete:
 *     summary: Hapus semua file CSV
 *     tags: [Files]
 */
router.delete("/delete-all", deleteAllFiles);

/**
 * @swagger
 * /api/history:
 *   get:
 *     summary: History upload CSV
 *     tags: [Files]
 */
router.get("/history", getCSVHistory);

export default router;