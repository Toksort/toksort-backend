import express from "express";
import upload from "../utils/multerConfig.js";
import {completeGroup} from "../controllers/csvController.js";
import {
  uploadCSV,
  getCSVHistory,
  readCSV,
  deleteFile,
  deleteAllFiles,
  getAllFiles,
  readLatestCSV,
  getSummary
} from "../controllers/csvController.js";
import { deleteOldFiles, checkDailyLimit } from "../utils/fileCleaner.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: CSV
 *   description: CSV Management API
 */

/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: Ambil semua file CSV
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: List file
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
 *               data:
 *                 filename: data-140426-v2.csv
 *                 totalRows: 120
 *                 rows: []
 */
router.get("/read-latest", readLatestCSV);

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
 *         description: Upload berhasil
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
 * /api/history:
 *   get:
 *     summary: Ambil history upload CSV
 *     tags: [CSV]
 */
router.get("/history", getCSVHistory);

/**
 * @swagger
 * /api/read/{filename}:
 *   get:
 *     summary: Ambil data CSV berdasarkan filename
 *     tags: [CSV]
 */
router.get("/read/:filename", readCSV);

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

/**
 * @swagger
 * /api/summary:
 *   get:
 *     summary: Get summary analytics from latest CSV
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Summary data
 */
router.get("/summary", getSummary);

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
 */
router.delete("/delete/:filename", deleteFile);

/**
 * @swagger
 * /api/delete-all:
 *   delete:
 *     summary: Delete all CSV files
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: All files deleted
 */
router.delete("/delete-all", deleteAllFiles);

/**
 * @swagger
 * /api/complete-group:
 *   post:
 *     summary: Tandai group (variation + shipping) sebagai selesai
 *     tags: [CSV]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - filename
 *               - variation
 *               - shipping_status
 *             properties:
 *               filename:
 *                 type: string
 *                 example: data-180426-v1.csv
 *               variation:
 *                 type: string
 *                 example: A5
 *               shipping_status:
 *                 type: string
 *                 example: Kirim Hari ini
 *     responses:
 *       200:
 *         description: Group berhasil ditandai selesai
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: A5 (Kirim Hari ini) marked as done
 *       400:
 *         description: Request tidak valid
 *       404:
 *         description: File tidak ditemukan
 */
router.post("/complete-group", completeGroup);

export default router;