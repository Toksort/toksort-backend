import express from "express";
import upload from "../utils/multerConfig.js";
import {
  uploadCSV,
  getCSVHistory,
  readCSV,
  deleteFile,
  getAllFiles,
  readLatestCSV
} from "../controllers/csvController.js";
router.get("/files", getAllFiles);
router.get("/read-latest", readLatestCSV);
import {
  deleteOldFiles,
  checkDailyLimit,
} from "../utils/fileCleaner.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: CSV
 *   description: CSV Management API
 */

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload file CSV
 *     tags: [CSV]
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
 *         description: CSV berhasil diupload
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: CSV processed successfully
 *               data:
 *                 rows: 100
 *                 preview: []
 */
router.post(
  "/upload",
  (req, res, next) => {
    deleteOldFiles();

    if (checkDailyLimit()) {
      return res.status(429).json({
        success: false,
        message: "Upload limit reached for today (max 10 files).",
      });
    }

    next();
  },
  upload.single("file"),
  uploadCSV
);

/**
 * @swagger
 * /api/history:
 *   get:
 *     summary: Ambil history upload CSV
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - "2026-04-13 - Uploaded data-130426-v1.csv"
 */
router.get("/history", getCSVHistory);

/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: Ambil semua file CSV
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: List file CSV
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - data-130426-v1.csv
 *                 - data-140426-v2.csv
 */
router.get("/files", getAllFiles);

/**
 * @swagger
 * /api/read/{filename}:
 *   get:
 *     summary: Ambil data CSV berdasarkan filename
 *     tags: [CSV]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         example: data-130426-v5.csv
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 filename: data-130426-v5.csv
 *                 totalRows: 100
 *                 rows: []
 */
router.get("/read/:filename", readCSV);

/**
 * @swagger
 * /api/read-latest:
 *   get:
 *     summary: Ambil data CSV terbaru
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Latest file fetched
 *               data:
 *                 filename: data-140426-v2.csv
 *                 totalRows: 120
 *                 rows: []
 */
router.get("/read-latest", readLatestCSV);

/**
 * @swagger
 * /api/delete/{filename}:
 *   delete:
 *     summary: Hapus file CSV
 *     tags: [CSV]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         example: data-130426-v5.csv
 *     responses:
 *       200:
 *         description: File berhasil dihapus
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: File deleted successfully
 */
router.delete("/delete/:filename", deleteFile);

export default router;