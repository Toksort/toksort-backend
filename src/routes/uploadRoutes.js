import express from "express";
import upload from "../utils/multerConfig.js";
import {
  uploadCSV,
  getCSVHistory,
  readCSV,
  deleteFile,
} from "../controllers/csvController.js";
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
 */
router.post(
  "/upload",
  (req, res, next) => {
    deleteOldFiles();

    if (checkDailyLimit()) {
      return res.status(429).json({
        error: "Upload limit reached for today (max 10 files).",
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
 */
router.get("/history", getCSVHistory);

/**
 * @swagger
 * /api/read/{filename}:
 *   get:
 *     summary: Ambil data CSV dalam bentuk JSON
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
 */
router.get("/read/:filename", readCSV);

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

export default router;